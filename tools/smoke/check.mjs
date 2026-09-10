// Loads both games in real headless Chrome, plays a round of each, and fails on
// any console error or uncaught exception. Run before pushing.
//
//   python3 -m http.server 8000 --directory public
//   node tools/smoke/check.mjs                     # local
//   BASE=https://games.speaknigeria.org node tools/smoke/check.mjs
//
// This lives in the repo on purpose. Equivalent checks were written three times
// into a scratch directory and lost with the session each time; the version
// that survived was the one that got committed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.env.BASE || 'http://localhost:8000').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9944;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--window-size=430,932', 'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 80 && !wsUrl; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
  } catch { /* not up yet */ }
  if (!wsUrl) await sleep(250);
}
if (!wsUrl) { chrome.kill(); throw new Error('Chrome did not expose a debug target'); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
let errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('uncaught: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const ev = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

const failures = [];
const ok = (cond, msg) => cond ? console.log('  ok  ' + msg) : failures.push(msg);

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });

async function open(url) {
  errors = [];
  await send('Page.navigate', { url });
  for (let i = 0; i < 80; i++) {
    if (await ev(`typeof gameData !== 'undefined' && gameData.length > 0`).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

// --- tone game ----------------------------------------------------------
console.log(`\n${BASE}/tones/`);
ok(await open(`${BASE}/tones/`), 'loads and fetches its data');
ok(await ev(`[...document.querySelectorAll('.playlist-btn')].every(b => !b.disabled)`), 'all playlists enabled');
ok(await ev(`gameData.filter(l => l.category === 'tone_pattern').length`) > 0, 'tone-pattern sets generated');
await ev(`document.querySelector('.playlist-btn').click()`);
await sleep(500);
ok(await ev(`document.querySelectorAll('#syllable-cards .card').length > 0`), 'syllable cards render');
ok(await ev(`document.querySelectorAll('#tone-bank .tone-line polyline').length`) === 3, 'three pitch lines drawn');
ok(await ev(`[...document.querySelectorAll('.tone-btn-label')].map(e => e.textContent).join(' ')`) === 'Dò Re Mí',
   'tone buttons read Dò Re Mí, low to high');
// Every tone must build a graph without throwing, on all supported speakers.
ok(await ev(`
  (() => {
    const out = [];
    for (const sp of ['speaker2','speaker3']) for (const t of ['low','mid','high']) {
      const ctx = new OfflineAudioContext(1, 4410, 44100);
      const n = buildToneGraph(ctx, t, sp, 0);
      if (!n) out.push(sp + ' ' + t);
    }
    return out.length === 0;
  })()`), 'every tone builds a node graph for both speakers');
const solved = await ev(`
  (async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const want = [...document.querySelectorAll('#syllable-cards .card')]
      .map(c => ['high','mid','low'].find(t => c.classList.contains('tone-' + t)));
    for (const t of want) { document.querySelector('.tone-group-' + t + ' .tone-btn').click(); await wait(60); }
    await wait(300);
    return document.getElementById('syllable-cards').classList.contains('correct');
  })()`);
ok(solved, 'a correct answer is accepted');
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);

// --- phonics game -------------------------------------------------------
console.log(`\n${BASE}/phonics/`);
ok(await open(`${BASE}/phonics/`), 'loads and fetches its data');
ok(await ev(`[...document.querySelectorAll('.playlist-btn')].every(b => !b.disabled)`), 'all playlists enabled');
ok(await ev(`gameData.filter(l => l.category === 'tone_pattern').length`) >= 8, 'tone-pattern sets generated');
ok(!(await ev(`gameData.some(l => l.category === 'syllable_reinforcement')`)), 'Syllable Practice not offered');
await ev(`selectPlaylist('tone_pattern')`);
await sleep(500);
ok(await ev(`document.querySelectorAll('.bank-row button').length > 0`), 'syllable bank renders');
// Every word in every level must have a button for each of its syllables, or
// it cannot be completed.
ok(await ev(`
  gameData.every(l => l.words.every(w => w.targetSyllables.every(sy =>
    l.syllablePool.some(p => p.text.normalize('NFC') === sy.normalize('NFC')))))`),
   'every word is solvable - all its syllables have buttons');
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);

console.log('');
ws.close();
chrome.kill();
if (failures.length) { console.log('FAILURES:'); failures.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
console.log('smoke checks passed');
