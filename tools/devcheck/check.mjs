// Loads a dev game in real headless Chrome at phone size, taps the start button, optionally runs a
// scripted play-through, saves screenshots, and fails on any console error or uncaught exception.
//
//   node tools/devcheck/serve.mjs dev/games 8000            (from the repo root)
//   node tools/devcheck/check.mjs river [script.js] [--landscape]
//
// script.js (optional) is evaluated in the page after start; it may be async and return a summary
// string. It can call `window.__shot(name)` to request a screenshot, which this tool saves as
// tools/devcheck/out/<game>-<name>.png. A final screenshot is always saved as <game>-end.png.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [game, scriptPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const landscape = process.argv.includes('--landscape');
// --query=<query string> opens the game with it (e.g. a learning-path step: path=..&focus=..&level=1).
const QUERY = process.argv.find((a) => a.startsWith('--query='))?.slice(8) ?? '';
const TAG = process.argv.find((a) => a.startsWith('--tag='))?.slice(6) ?? '';
const BASE = (process.env.BASE || 'http://localhost:8000').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9300 + Math.floor(Math.random() * 600);
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), 'out');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [w, h] = landscape ? [932, 430] : [430, 932];

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'devcheck-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required', `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { chrome.kill(); throw new Error('Chrome did not expose a debug target'); }
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
const errors = [];
const shots = [];
const bursts = [];
// A flipbook: frames every `every` ms for `ms` ms, tiled into one contact sheet (<game>-<tag>-<name>-flip.png),
// so a reviewer can see motion (does the character move, does progress show) that one screenshot cannot.
async function burst(name, ms = '3000', every = '250') {
  const frames = [], t0 = Date.now();
  while (Date.now() - t0 < +ms) {
    const t = Date.now();
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    frames.push(data);
    await sleep(Math.max(0, +every - (Date.now() - t)));
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flip-'));
  frames.forEach((d, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(2, '0')}.png`), Buffer.from(d, 'base64')));
  const cols = Math.min(6, frames.length), rows = Math.ceil(frames.length / cols);
  const file = path.join(OUT, `${game}${TAG ? '-' + TAG : ''}-${name}-flip.png`);
  const res = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(dir, 'f%02d.png'), '-vf', `scale=200:-1,tile=${cols}x${rows}:padding=4`, '-frames:v', '1', file]);
  if (res.status !== 0) console.log('  flipbook failed: ' + String(res.stderr || res.error));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('  flipbook ' + file + ' (' + frames.length + ' frames, ' + every + ' ms apart)');
}
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push('uncaught: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled') {
    const text = m.params.args.map((a) => a.value ?? a.description).join(' ');
    if (m.params.type === 'error') errors.push('console.error: ' + text);
    else if (text.startsWith('__shot:')) shots.push(text.slice(7));
    else if (text.startsWith('__burst:')) bursts.push(burst(...text.slice(8).split(':')));
    else console.log('  [page] ' + text);
  }
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) errors.push('load failed: ' + m.params.errorText);
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400 && !m.params.response.url.endsWith('/favicon.ico')) errors.push(`HTTP ${m.params.response.status}: ${m.params.response.url}`);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, `${game}${TAG ? '-' + TAG : ''}-${name}.png`);
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('  screenshot ' + file);
}

let failed = false;
try {
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `${BASE}/${game}/${QUERY ? '?' + QUERY : ''}` });
  await sleep(2500);
  await shot('start');
  await ev(`window.__burst = (n, ms = 3000, every = 250) => console.log('__burst:' + n + ':' + ms + ':' + every); window.__shot = (n) => console.log('__shot:' + n); document.querySelector('.start-btn')?.click(); true`);
  await sleep(3000);
  if (scriptPath) {
    const script = fs.readFileSync(scriptPath, 'utf8');
    const watcher = setInterval(async () => { while (shots.length) await shot(shots.shift()); }, 200);
    const result = await ev(`(async () => { ${script} })()`);
    clearInterval(watcher);
    while (shots.length) await shot(shots.shift());
    await Promise.all(bursts);
    console.log('  script result: ' + JSON.stringify(result));
  } else {
    await sleep(4000);
  }
  await shot('end');
} catch (e) {
  errors.push('check: ' + e.message);
} finally {
  if (errors.length) { failed = true; console.log('FAIL\n  ' + errors.join('\n  ')); } else console.log('PASS (no console errors)');
  ws.close(); chrome.kill();
  process.exit(failed ? 1 : 0);
}
