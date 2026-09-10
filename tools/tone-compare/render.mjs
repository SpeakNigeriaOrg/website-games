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

// Voices rendered through the GAME's own buildToneGraph. `current` passes no
// override, so it is exactly what ships - if the game's synthesis changes, this
// row changes with it and cannot go stale. Add a row to audition a variation on
// whatever the current design is; the object is passed as the `voice` argument.
const VOICES = {
  current: null,
  softer: { modes: [{ mult: 1, gain: 1, decay: 0.62 }, { mult: 3.932, gain: 0.22, decay: 0.14 }, { mult: 9.538, gain: 0.05, decay: 0.05 }],
            attack: 0.003, gain: 0.42, mallet: { length: 0.006, gain: 0.025, hz: 2600, q: 0.7 } },
  woodier: { modes: [{ mult: 1, gain: 1, decay: 0.42 }, { mult: 3.932, gain: 0.42, decay: 0.2 }, { mult: 9.538, gain: 0.14, decay: 0.09 }],
            attack: 0.002, gain: 0.42, mallet: { length: 0.01, gain: 0.06, hz: 3600, q: 0.7 } },
};

// Instrument-style voices live in instruments.js and are injected into the
// page; they need whole node graphs of their own rather than a `voice` preset,
// because what distinguishes them is time evolution, not spectrum.
const INSTRUMENTS = ['voice', 'hum', 'piano', 'pluck', 'bell', 'flute', 'bowed'];
const VARIANTS = ['original', ...Object.keys(VOICES), ...INSTRUMENTS];

// The speakers' own nasal murmurs, pulled straight out of the recording corpus
// as a reference: the truest imitation of someone humming is them humming.
// speaker3/n_high.wav is an isolated syllabic nasal - literally a hum. For
// speaker2 the murmur is the tail of a nasal-final syllable. Absent corpus =
// skipped, since it lives outside this repo.
const CORPUS = process.env.CORPUS ||
  '/Users/breallis/Dev/yoruba-student-dict/content/staged/syllables';
// Source recordings for the `voice` row. Key = the id instruments.js looks the
// buffer up by (an R2-relative path, so the same key works in the game);
// value = the path within CORPUS, which already points at .../syllables.
const VOICE_SOURCES = {
  'syllables/speaker3/n_high.wav': 'speaker3/n_high.wav',
  'syllables/speaker2/un.wav': 'speaker2/un.wav',
};
const REAL_HUM = {
  speaker3: { file: 'speaker3/n_high.wav', where: 'all' },
  speaker2: { file: 'speaker2/un.wav', where: 'tail' },
};
const SPEAKERS = ['speaker2', 'speaker3'];
const CLIPS = ['melody', 'low', 'mid', 'high'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- real-recording reference -------------------------------------------
function readWav(file) {
  const b = fs.readFileSync(file);
  const sr = b.readUInt32LE(24);
  let off = 12;
  while (off < b.length - 8) {                       // walk chunks to find data
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'data') return { sr, pcm: b.subarray(off + 8, off + 8 + size) };
    off += 8 + size + (size % 2);
  }
  throw new Error(`no data chunk in ${file}`);
}

function writeWav(file, samples, sr) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i]))), 44 + i * 2);
  fs.writeFileSync(file, b);
}

// Cuts the murmur portion out of a clip. Where it sits depends on the syllable:
// for a nasal-FINAL one it is the tail, for a nasal-INITIAL one the head.
// Getting that backwards is what made the first attempt at this measure an open
// vowel and call it a hum.
function extractMurmur(file, where) {
  const { sr, pcm } = readWav(file);
  const x = new Float32Array(pcm.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = pcm.readInt16LE(i * 2) / 32768;

  const step = Math.floor(sr * 0.02);
  const frames = [];
  for (let i = 0; i + step < x.length; i += step) {
    let sq = 0;
    for (let j = i; j < i + step; j++) sq += x[j] * x[j];
    frames.push(Math.sqrt(sq / step));
  }
  const peak = Math.max(...frames) || 1;
  const voiced = frames.map((e, i) => (e > 0.15 * peak ? i : -1)).filter((i) => i >= 0);
  if (voiced.length < 4) return null;
  const a = voiced[0] * 0.02, b = voiced[voiced.length - 1] * 0.02, span = b - a;
  const [lo, hi] = where === 'tail' ? [a + 0.6 * span, b]
                 : where === 'head' ? [a, a + 0.35 * span]
                 : [a + 0.2 * span, b - 0.05 * span];

  const seg = Array.from(x.subarray(Math.floor(lo * sr), Math.floor(hi * sr)));
  if (seg.length < sr * 0.05) return null;
  const max = Math.max(...seg.map(Math.abs)) || 1;
  const gain = (0.75 * 32767) / max;
  const fade = Math.floor(sr * 0.02);
  const out = seg.map((v) => v * gain);
  for (let i = 0; i < Math.min(fade, out.length); i++) {   // no click on a trimmed edge
    out[i] *= i / fade;
    out[out.length - 1 - i] *= i / fade;
  }
  return { samples: out, sr };
}


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
  const inst = (window.INSTRUMENTS || {})[variant];
  const voiceDur = inst ? inst.duration : TONE_DURATION;
  const seq = what === 'melody' ? ['low', 'mid', 'high'] : [what];
  const gap = TONE_DURATION - 0.14;               // same spacing the hint melody uses
  const dur = (what === 'melody' ? gap * 2 : 0) + voiceDur + 0.3;
  const ctx = new OfflineAudioContext(1, Math.ceil(SR * dur), SR);
  const bus = ctx.createGain(); bus.connect(ctx.destination);
  seq.forEach((t, i) => {
    const at = what === 'melody' ? i * gap : 0;
    const node = inst ? inst.build(ctx, t, speaker, at)
      : variant === 'original' ? renderOriginal(ctx, t, speaker, at)
      : VOICES[variant] ? buildToneGraph(ctx, t, speaker, at, VOICES[variant])
      : buildToneGraph(ctx, t, speaker, at);
    node.connect(bus);
  });
  const pcm = (await ctx.startRendering()).getChannelData(0);

  // Normalise every clip to the same average level before writing it. Without
  // this the loudest option wins the listening test regardless of timbre, and
  // these envelopes differ enormously - a marimba puts its energy in 50 ms, a
  // bowed note spreads it over 550.
  let rawSq = 0;
  for (let i = 0; i < pcm.length; i++) rawSq += pcm[i] * pcm[i];
  const rawRms = Math.sqrt(rawSq / pcm.length) || 1e-9;
  const gain = Math.min(6, 0.055 / rawRms);
  for (let i = 0; i < pcm.length; i++) pcm[i] *= gain;

  let sq = 0, peak = 0;
  for (let i = 0; i < pcm.length; i++) { sq += pcm[i] * pcm[i]; peak = Math.max(peak, Math.abs(pcm[i])); }
  const rms = Math.sqrt(sq / pcm.length);

  // Spectral centroid: a single number for "brightness". Measured shortly AFTER
  // ONSET, not at the clip's midpoint. That matters once decaying voices are in
  // the comparison: the midpoint of a 0.95 s piano note is 400 ms after the
  // hammer, by which time every high partial has gone, and the number would say
  // "very dark" about a sound whose attack is bright. 60 ms in catches the part
  // of the sound the ear actually uses to identify it.
  const N = 8192, mid = Math.min(Math.max(0, pcm.length - N - 1), Math.floor(SR * 0.06)), bins = [];
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
    wav: toWav(pcm, SR), rms, peak, crest: peak / rms, levelGain: gain,
    centroid: bins.reduce((a, f, i) => a + f * mag[i], 0) / tot, f95,
    note: inst ? inst.note : null,
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

  await evaluate(fs.readFileSync(path.join(HERE, 'instruments.js'), 'utf8') + '\ntrue');
  await evaluate(PAGE_HELPERS);
  // The `voice` row plays real recorded audio. Read it here and hand the bytes
  // to the page: R2 sends no CORS header, so the page cannot fetch it itself.
  const sources = {};
  for (const [key, rel] of Object.entries(VOICE_SOURCES)) {
    const file = path.join(CORPUS, rel);
    if (!fs.existsSync(file)) { console.log(`  (no ${rel} - the voice row will be silent)`); continue; }
    sources[key] = fs.readFileSync(file).toString('base64');
  }
  const loaded = await evaluate(`preloadVoice(new OfflineAudioContext(1, 1, 44100), ${JSON.stringify(sources)})`);
  console.log(`  source audio decoded: ${(loaded || []).length} file(s)`);
  // Wipe stale output: variants come and go from the lists above, and a leftover
  // WAV from a previous run is worse than a missing one - it plays, and it is
  // not what the page says it is.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const stats = {};
  const notes = {};
  for (const speaker of SPEAKERS) {
    for (const clip of CLIPS) {
      for (const variant of VARIANTS) {
        const r = await evaluate(`renderClip(${JSON.stringify(variant)}, ${JSON.stringify(speaker)}, ${JSON.stringify(clip)})`);
        fs.writeFileSync(path.join(OUT, `${speaker}-${clip}-${variant}.wav`), Buffer.from(r.wav, 'base64'));
        // Melodies are excluded from the stats: three tones overlap in one, so
        // the peak (and therefore crest) is inflated for every variant equally
        // and the comparison stops meaning anything.
        if (r.note) notes[variant] = r.note;
        if (clip !== 'melody') (stats[variant] ||= []).push(r);
      }
    }
  }

  // Reference clips first: the page needs to know which ones exist.
  const realHum = [];
  for (const [speaker, spec] of Object.entries(REAL_HUM)) {
    const file = path.join(CORPUS, spec.file);
    if (!fs.existsSync(file)) { console.log(`  (no corpus at ${file} - skipping real-hum reference)`); continue; }
    const got = extractMurmur(file, spec.where);
    if (!got) { console.log(`  (could not find a murmur in ${spec.file})`); continue; }
    writeWav(path.join(OUT, `${speaker}-real-hum.wav`), got.samples, got.sr);
    realHum.push(speaker);
    console.log(`  reference: ${speaker}-real-hum.wav (${(got.samples.length / got.sr * 1000).toFixed(0)} ms from ${spec.file})`);
  }

  fs.writeFileSync(path.join(OUT, 'index.html'),
    fs.readFileSync(path.join(HERE, 'page.html'), 'utf8')
      .replace('__VARIANTS__', JSON.stringify(VARIANTS))
      .replace('__NOTES__', JSON.stringify(notes))
      .replace('__REALHUM__', JSON.stringify(realHum))
      .replace('__STATS__', JSON.stringify(Object.fromEntries(
        Object.entries(stats).map(([k, a]) => [k, {
          centroid: a.reduce((s, r) => s + r.centroid, 0) / a.length,
          crest: a.reduce((s, r) => s + r.crest, 0) / a.length,
          rms: a.reduce((s, r) => s + r.rms, 0) / a.length,
          f95: a.reduce((s, r) => s + r.f95, 0) / a.length,
        }])))));

  console.log('single tones only (melodies excluded - overlap inflates peak)\n');
  console.log('variant    brightness   95% below    crest    level-matched by');
  for (const v of VARIANTS) {
    const a = stats[v]; const m = (k) => a.reduce((s, r) => s + r[k], 0) / a.length;
    console.log(`${v.padEnd(10)} ${m('centroid').toFixed(0).padStart(6)} Hz  ${m('f95').toFixed(0).padStart(7)} Hz   ${m('crest').toFixed(2)}    x${m('levelGain').toFixed(2)}`);
  }
  console.log('\nAll clips are level-matched, so these compare timbre and not loudness.');
  console.log('Crest is NOT comparable across envelope types: a struck sound is meant to peak');
  console.log('hard and decay, so 9-14 there is normal, not harsh. Compare it within a family.');
  console.log(`\n${VARIANTS.length * SPEAKERS.length * CLIPS.length} clips written to ${OUT}`);
  console.log('open: python3 -m http.server 8010 --directory tools/tone-compare/build');
} finally {
  ws.close();
  chrome.kill();
}
