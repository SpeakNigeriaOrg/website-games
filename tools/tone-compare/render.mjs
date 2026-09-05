// Renders the tone game's synthetic tones to WAV files and measures them, so a
// change to the synthesis can be listened to side by side instead of guessed at.
//
//   python3 -m http.server 8000 --directory public     # in another terminal
//   node tools/tone-compare/render.mjs
//   python3 -m http.server 8010 --directory tools/tone-compare/build
//
// Then open http://localhost:8010/ for a play-them-side-by-side page.
//
// It drives real headless Chrome over the DevTools Protocol and calls the
// game's own buildToneGraph, so what you hear is what the game plays - not a
// reimplementation that could drift. The one exception is `original` below,
// which is a frozen copy of the six-sine version, kept as a reference point.
//
// Why this exists: the tones went through four versions. Twice a change that
// looked obviously right by reasoning was wrong by ear (a sawtooth that was
// harsh, then an "improvement" that measured darker than what it replaced), and
// once a parameter sweep found the real cause where argument had not. Rendering
// and measuring takes a minute and settles it.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'build');
const GAME_URL = process.env.TONE_GAME_URL || 'http://localhost:8000/tones/';
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9933;

// Candidate voices. `original` is the frozen six-sine version; the rest are
// passed straight to the game's buildToneGraph as its `voice` argument, so they
// use whatever the current synthesis is. Add a row here to audition an idea.
const VOICES = {
  soft:  { harmonics: 12, rolloff: 1.45, formantHz: 600, formantQ: 1.0, formantGain: 3, lowpassHz: 1800, peakGain: 0.15 },
  warm:  { harmonics: 16, rolloff: 1.20, formantHz: 640, formantQ: 1.1, formantGain: 4, lowpassHz: 2400, peakGain: 0.20 },
  clear: { harmonics: 20, rolloff: 1.00, formantHz: 700, formantQ: 1.2, formantGain: 5, lowpassHz: 3000, peakGain: 0.20 },
};
const VARIANTS = ['original', ...Object.keys(VOICES)];
const SPEAKERS = ['speaker2', 'speaker3'];
const CLIPS = ['melody', 'low', 'mid', 'high'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tone-compare-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

  let wsUrl;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch { /* chrome not up yet */ }
    if (!wsUrl) await sleep(250);
  }
  if (!wsUrl) { chrome.kill(); throw new Error('Chrome did not expose a debug target'); }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  return { chrome, ws, send, evaluate };
}

const PAGE_HELPERS = `
window.SR = 44100;
window.VOICES = ${JSON.stringify(VOICES)};

// Frozen copy of the original six-sine synthesis, as a reference point. Do not
// "fix" this to match the current code - its whole purpose is to not change.
window.renderOriginal = function (ctx, tone, speaker, start) {
  const m = TONE_MODEL[speaker][tone];
  const curve = new Float32Array(m.glide.length);
  for (let i = 0; i < m.glide.length; i++) curve[i] = m.hz * Math.pow(2, m.glide[i] / 12);
  const H = 6; let wsum = 0; for (let n = 1; n <= H; n++) wsum += 1 / n;
  const bus = ctx.createGain();
  for (let n = 1; n <= H; n++) {
    const o = ctx.createOscillator(); o.type = 'sine';
    const hc = new Float32Array(curve.length);
    for (let i = 0; i < curve.length; i++) hc[i] = curve[i] * n;
    o.frequency.setValueCurveAtTime(hc, start, TONE_DURATION);
    const g = ctx.createGain(); const peak = (0.22 * (1 / n)) / wsum;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.025);
    g.gain.setValueAtTime(peak, start + TONE_DURATION - 0.06);
    g.gain.linearRampToValueAtTime(0.0001, start + TONE_DURATION);
    o.connect(g).connect(bus); o.start(start); o.stop(start + TONE_DURATION + 0.02);
  }
  return bus;
};

window.toWav = function (pcm, sr) {
  const n = pcm.length, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true); }
  let bin = ''; const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};

window.renderClip = async function (variant, speaker, what) {
  const seq = what === 'melody' ? ['low', 'mid', 'high'] : [what];
  const gap = TONE_DURATION - 0.14;               // same spacing the hint melody uses
  const dur = what === 'melody' ? gap * 2 + TONE_DURATION + 0.3 : TONE_DURATION + 0.3;
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * dur), SR);
  const bus = ctx.createGain(); bus.connect(ctx.destination);
  seq.forEach((t, i) => {
    const at = what === 'melody' ? i * gap : 0;
    const node = variant === 'original'
      ? renderOriginal(ctx, t, speaker, at)
      : buildToneGraph(ctx, t, speaker, at, VOICES[variant]);
    node.connect(bus);
  });
  const pcm = (await ctx.startRendering()).getChannelData(0);

  let sq = 0, peak = 0;
  for (let i = 0; i < pcm.length; i++) { sq += pcm[i] * pcm[i]; peak = Math.max(peak, Math.abs(pcm[i])); }
  const rms = Math.sqrt(sq / pcm.length);

  // Spectral centroid: a single number for "brightness". Coarse log-spaced DFT
  // over one window at the clip's midpoint - enough to compare variants, not
  // meant as analysis.
  const N = 8192, mid = Math.floor(pcm.length / 2) - N / 2, bins = [];
  for (let k = 0; k < 140; k++) bins.push(80 * Math.pow(8000 / 80, k / 139));
  const mag = bins.map((f) => {
    const w = 2 * Math.PI * f / SR; let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const s = pcm[mid + n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1)));
      re += s * Math.cos(w * n); im += s * Math.sin(w * n);
    }
    return Math.hypot(re, im) / N;
  });
  const tot = mag.reduce((a, b) => a + b, 0);
  let run = 0, f95 = bins[bins.length - 1];
  for (let i = 0; i < bins.length; i++) { run += mag[i]; if (run >= 0.95 * tot) { f95 = bins[i]; break; } }

  return {
    wav: toWav(pcm, SR), rms, peak, crest: peak / rms,
    centroid: bins.reduce((a, f, i) => a + f * mag[i], 0) / tot, f95,
  };
};
true`;

const { chrome, ws, send, evaluate } = await connect();
try {
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: GAME_URL });
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    ready = await evaluate(`typeof buildToneGraph !== 'undefined' && typeof TONE_MODEL !== 'undefined'`).catch(() => false);
    if (!ready) await sleep(250);
  }
  if (!ready) throw new Error(`${GAME_URL} did not load the game. Is the dev server running?`);

  await evaluate(PAGE_HELPERS);
  fs.mkdirSync(OUT, { recursive: true });

  const stats = {};
  for (const speaker of SPEAKERS) {
    for (const clip of CLIPS) {
      for (const variant of VARIANTS) {
        const r = await evaluate(`renderClip(${JSON.stringify(variant)}, ${JSON.stringify(speaker)}, ${JSON.stringify(clip)})`);
        fs.writeFileSync(path.join(OUT, `${speaker}-${clip}-${variant}.wav`), Buffer.from(r.wav, 'base64'));
        // Melodies are excluded from the stats: three tones overlap in one, so
        // the peak (and therefore crest) is inflated for every variant equally
        // and the comparison stops meaning anything.
        if (clip !== 'melody') (stats[variant] ||= []).push(r);
      }
    }
  }

  fs.writeFileSync(path.join(OUT, 'index.html'),
    fs.readFileSync(path.join(HERE, 'page.html'), 'utf8')
      .replace('__VARIANTS__', JSON.stringify(VARIANTS))
      .replace('__STATS__', JSON.stringify(Object.fromEntries(
        Object.entries(stats).map(([k, a]) => [k, {
          centroid: a.reduce((s, r) => s + r.centroid, 0) / a.length,
          crest: a.reduce((s, r) => s + r.crest, 0) / a.length,
          rms: a.reduce((s, r) => s + r.rms, 0) / a.length,
          f95: a.reduce((s, r) => s + r.f95, 0) / a.length,
        }])))));

  console.log('single tones only (melodies excluded - overlap inflates peak)\n');
  console.log('variant    brightness   95% below    crest    RMS');
  for (const v of VARIANTS) {
    const a = stats[v]; const m = (k) => a.reduce((s, r) => s + r[k], 0) / a.length;
    console.log(`${v.padEnd(10)} ${m('centroid').toFixed(0).padStart(6)} Hz  ${m('f95').toFixed(0).padStart(7)} Hz   ${m('crest').toFixed(2)}    ${m('rms').toFixed(4)}`);
  }
  console.log(`\n${VARIANTS.length * SPEAKERS.length * CLIPS.length} clips written to ${OUT}`);
  console.log('open: python3 -m http.server 8010 --directory tools/tone-compare/build');
} finally {
  ws.close();
  chrome.kill();
}
