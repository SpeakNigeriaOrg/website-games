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
let requests = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  // documentURL, not just url: gtag's ccm/collect calls fire seconds after
  // their page has been navigated away from, and counting by arrival time
  // blamed them on whatever page came next. Attribution has to come from the
  // document that made the request.
  if (m.method === 'Network.requestWillBeSent') {
    requests.push({ url: m.params.request.url, documentURL: m.params.documentURL || '' });
  }
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
// Required for the Ads-placement section: without it no Network events are
// delivered and every request count is trivially zero, which reads as "the tag
// did not load" for pages where it certainly did.
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });

// Navigate and wait for the game's data to be parsed. Polls rather than
// sleeping a fixed time: a cold server plus two or three JSON fetches is
// easily slower than any constant worth hardcoding, and a freshly deployed
// Pages site can be slower again for the first request.
async function open(url) {
  errors = [];
  requests = [];
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

// --- the Google Ads tag must not load on a page a child plays -----------
// COPPA treats cookies as personal information on a child-directed site, and
// its "support for internal operations" exception covers basic analytics but
// not advertising. PostHog is expected on every page; gtag is expected ONLY on
// the adult-facing landing page, where game_opened is the conversion.
// This regressed once already: track.js used to call loadAds() unconditionally.
console.log('\nGoogle Ads tag placement');
{
  const adsRe = /googletagmanager\.com\/gtag|googleads|doubleclick/;

  // Grant consent before the document runs, rather than clicking the notice.
  // The notice is geo-gated to the EEA/UK and its geo lookup is a network round
  // trip, so racing it is flaky - and what matters here is the question "with
  // consent given, which pages load the Ads tag", not how consent was given.
  const granted = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('sn-consent', 'granted'); } catch (e) {}`
  });

  const seen = async (url) => {
    await send('Page.navigate', { url: 'about:blank' });
    await sleep(800);
    requests = [];
    await send('Page.navigate', { url });
    await sleep(4500);           // consent resolve + tag fetch

    // Assert on the DOM, not on network attribution. loadAds() works by
    // appending a <script src="googletagmanager..."> to the head, so its
    // presence is exactly "this page loaded the Ads tag" - whereas request
    // counting proved unreliable: gtag's collect calls fire seconds late, and
    // requests were attributed to a game page that had no tag element on it at
    // all (verified: 0 script tags while a request carried its documentURL).
    const tagEls = await ev(`document.querySelectorAll('script[src*="googletagmanager.com/gtag"]').length`);
    // ADS_DEBUG=1 prints why a page loaded the tag when it should not have.
    // The usual answer is a stale cached script: this check first failed
    // against production because track.js and game-events.js had changed
    // without their ?v= being bumped, so browsers kept running the old ones.
    if (process.env.ADS_DEBUG && tagEls > 0 && !url.endsWith('.org/')) {
      console.log('       [debug] cached game-events has ads:false? ',
        await ev(`fetch('/analytics/game-events.js?v=1').then(r=>r.text()).then(t=>t.includes('ads: false')).catch(e=>'ERR')`));
      console.log('       [debug] no-store game-events has ads:false?',
        await ev(`fetch('/analytics/game-events.js?v=1',{cache:'no-store'}).then(r=>r.text()).then(t=>t.includes('ads: false')).catch(e=>'ERR')`));
      console.log('       [debug] cached track.js has opts.ads?     ',
        await ev(`fetch('/analytics/track.js?v=1').then(r=>r.text()).then(t=>t.includes('opts.ads')).catch(e=>'ERR')`));
      console.log('       [debug] scripts on page:',
        JSON.stringify(await ev(`[...document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src'))`)));
    }
    const mine = requests.filter((r) => r.documentURL === url || r.documentURL === url + '/');
    return {
      tagEls,
      adsRequests: mine.filter((r) => adsRe.test(r.url)).length,
      posthog: mine.filter((r) => /posthog/.test(r.url)).length,
    };
  };

  const landing = await seen(`${BASE}/`);
  ok(landing.tagEls > 0, `the landing page loads the Ads tag (${landing.tagEls} tag element(s))`);
  for (const game of ['phonics', 'tones', 'vocab']) {
    const r = await seen(`${BASE}/${game}/`);
    ok(r.tagEls === 0, `/${game}/ does NOT load the Ads tag${r.tagEls ? ` - ${r.tagEls} tag element(s), a COPPA problem` : ''}`);
    ok(r.posthog > 0, `/${game}/ still reports to PostHog (${r.posthog} request(s))`);
  }
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: granted.identifier });
}

console.log('');
ws.close();
chrome.kill();
if (failures.length) { console.log('FAILURES:'); failures.forEach((f) => console.log('  FAIL ' + f)); process.exit(1); }
console.log('smoke checks passed');
