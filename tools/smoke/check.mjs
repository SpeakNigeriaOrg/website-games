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

// Every playlist button is enabled AND there is at least one. Without the count
// this passed on a page that had not loaded at all: querySelectorAll returns an
// empty list and [].every() is true, which read as success. That is how a
// broken production check reported "ok all playlists enabled" for a page whose
// script had not run.
const allPlaylistsEnabled = async () => {
  const state = await ev(`[...document.querySelectorAll('.playlist-btn')].map(b => b.disabled)`);
  return Array.isArray(state) && state.length > 0 && state.every((d) => d === false);
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });

// Navigate and wait for the game's data to be parsed. Polls rather than
// sleeping a fixed time: a cold server plus two or three JSON fetches is
// easily slower than any constant worth hardcoding, and a freshly deployed
// Pages site can be slower again for the first request.
async function open(url) {
  errors = [];
  await send('Page.navigate', { url });
  for (let i = 0; i < 120; i++) {
    if (await ev(`typeof gameData !== 'undefined' && gameData.length > 0`).catch(() => false)) return true;
    await sleep(250);
  }
  return false;
}

// A page that never loaded cannot be checked further, and pressing on just
// throws on the next evaluate and aborts the whole run - losing the results
// for every other game. Report it and skip the section.
function skipSection(name) {
  failures.push(`${name}: never loaded its data, remaining checks skipped`);
  console.log(`  FAIL ${name} never loaded - skipping the rest of this section`);
}

// --- tone game ----------------------------------------------------------
console.log(`\n${BASE}/tones/`);
const tonesUp = await open(`${BASE}/tones/`);
ok(tonesUp, 'loads and fetches its data');
if (tonesUp) {
ok(await allPlaylistsEnabled(), 'all playlists enabled');
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
      if (!buildToneGraph(ctx, t, sp, 0)) out.push(sp + ' ' + t);
    }
    return out.length === 0;
  })()`), 'every tone builds a fallback graph for both speakers');
// The tone buttons play the speakers' own recordings; check they load, decode,
// and actually produce audio rather than silently falling back.
ok(await ev(`
  (async () => {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const got = {};
    for (const [sp, spec] of Object.entries(VOICE_SOURCES)) {
      const res = await fetch(spec.file);
      if (!res.ok) return false;
      got[sp] = await ctx.decodeAudioData(await res.arrayBuffer());
    }
    return Object.keys(got).length === 2 && Object.values(got).every(b => b.duration > 0.2);
  })()`), 'both hum recordings load and decode');
ok(await ev(`
  (async () => {
    for (const sp of ['speaker2','speaker3']) for (const t of ['low','mid','high']) {
      const ctx = new OfflineAudioContext(1, Math.ceil(44100 * 0.8), 44100);
      decodeVoiceSources(ctx);
      await new Promise(r => setTimeout(r, 120));
      const n = buildVoiceGraph(ctx, t, sp, 0);
      if (!n) return false;
      n.connect(ctx.destination);
      const pcm = (await ctx.startRendering()).getChannelData(0);
      let sq = 0; for (let i = 0; i < pcm.length; i++) sq += pcm[i] * pcm[i];
      if (Math.sqrt(sq / pcm.length) < 0.01) return false;   // not silent
    }
    return true;
  })()`), 'every tone renders real audio from the recording, not silence');
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
} else skipSection('tone game');

// --- phonics game -------------------------------------------------------
console.log(`\n${BASE}/phonics/`);
const phonicsUp = await open(`${BASE}/phonics/`);
ok(phonicsUp, 'loads and fetches its data');
if (phonicsUp) {
ok(await allPlaylistsEnabled(), 'all playlists enabled');
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
} else skipSection('phonics game');

// --- vocabulary game ----------------------------------------------------
console.log(`\n${BASE}/vocab/`);
const vocabUp = await open(`${BASE}/vocab/`);
ok(vocabUp, 'loads and fetches its data');
if (vocabUp) {
ok(await allPlaylistsEnabled(), 'all playlists enabled');
ok(await ev(`gameData.every(l => ['themed','endless_practice'].includes(l.category))`), 'only vocab-relevant categories');
ok(await ev(`englishOf('e_joo_please')`) === 'please', 'the English gloss splits on the last underscore');
ok(await ev(`gameData.every(l => l.words.length >= 2)`), 'every level can offer a choice');
{
  // The defining requirement: silent on load. This is a reading game, and
  // hearing the word first would turn it into the listening game the other
  // two already are.
  const before = errors.length;
  // Spy on Audio construction rather than on network requests: media fetched
  // once is served from cache, so a network-based check gives a false negative
  // the second time the same word plays.
  await ev(`window.__audioUrls = []; const _A = window.Audio;
            window.Audio = function (src) { window.__audioUrls.push(src); return new _A(src); };`);
  await ev(`document.querySelector('.playlist-btn').click()`);
  await sleep(700);
  ok((await ev(`window.__audioUrls.length`)) === 0, 'no audio plays on load');
  ok(errors.length === before, 'no errors while starting a round');
}
ok(await ev(`document.querySelectorAll('.choice').length`) >= 2, 'choices render');
ok(await ev(`document.querySelectorAll('.choice').length <= 4`), 'never more than four choices');
ok(await ev(`[...document.querySelectorAll('.choice')].filter(b => b.textContent === currentWord.displayText).length`) === 1,
   'exactly one choice is correct');
ok(await ev(`new Set([...document.querySelectorAll('.choice')].map(b => b.textContent)).size === document.querySelectorAll('.choice').length`),
   'no duplicate choices');
ok(await ev(`
  (() => { const b = [...document.querySelectorAll('.choice')].find(x => x.textContent !== currentWord.displayText);
    if (!b) return false; b.click();
    return document.querySelectorAll('.choice.ruled-out').length === 1 && !isSolved; })()`),
   'a wrong pick is ruled out and the round stays open');
// The picture must be silent until the word is got right. Hearing it earlier
// is not a hint, it is the answer - anyone who knows the word by ear is done.
{
  await ev(`window.__audioUrls = []`);
  await ev(`playWordAudio()`);
  await ev(`document.getElementById('prompt-container').click()`);
  await sleep(300);
  ok((await ev(`window.__audioUrls.length`)) === 0, 'tapping the picture plays nothing before the answer');
  ok(!(await ev(`document.getElementById('prompt-container').classList.contains('solved')`)),
     'the picture is not marked tappable before the answer');
}
ok(await ev(`
  (() => { const b = [...document.querySelectorAll('.choice')].find(x => x.textContent === currentWord.displayText);
    if (!b) return false; b.click(); return isSolved; })()`),
   'a correct pick is accepted');
await sleep(900);
ok(await ev(`document.getElementById('prompt-container').classList.contains('solved')`),
   'the picture becomes tappable once solved');
ok((await ev(`window.__audioUrls.filter(u => u.includes('/words/')).length`)) > 0,
   'the word is spoken once the answer is right');
{
  await ev(`window.__audioUrls = []`);
  await ev(`document.getElementById('prompt-container').click()`);
  await sleep(300);
  ok((await ev(`window.__audioUrls.filter(u => u.includes('/words/')).length`)) > 0,
     'and replays when the picture is tapped after solving');
}
ok(errors.length === 0, `no console errors${errors.length ? ': ' + errors[0] : ''}`);
} else skipSection('vocabulary game');

console.log('');
ws.close();
chrome.kill();
if (failures.length) { console.log('FAILURES:'); failures.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
console.log('smoke checks passed');
