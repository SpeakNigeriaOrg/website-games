// --- GLOBAL CONFIGURATION ---
// Audio/image bytes live in R2, not this deploy (same arrangement as the
// phonics game - publishToR2.mjs in the dictionary repo is what uploads
// them). Only the three JSON files ship same-origin, and this game reads
// the phonics game's copies of them rather than keeping its own: they're
// vendored by sync_dictionary_data.py, and one copy for both games means
// no drift and no change to that script. `../phonics/vocab.json` resolves
// to /phonics/vocab.json from /tones/ - the relative path is deliberate.
const BASE_URL = "https://gamemedia.speaknigeria.org/";
const DATA_DIR = "../phonics/";

// speaker1 is excluded on purpose. The tone study behind TONE_MODEL below
// rests on only 19 tokens for that speaker - 4 of them for high tone - which
// the analysis itself flags as too thin to anchor anything. speaker2 (female
// range) and speaker3 (male range) have 73 and 78 tokens.
const ALLOWED_SPEAKERS = ["speaker2", "speaker3"];

// Which playlists this game offers. `syllable_reinforcement` is deliberately
// absent even though sessions.json still defines it: those levels exist to
// drill the PHONICS game's tappable syllable bank - they pack the most words
// per level (9.8 vs 8.0 for random, 6.1 for themed) and reuse syllables most
// heavily (1.26 syllable tokens per distinct syllable, against 1.14-1.15
// everywhere else), so the player keeps re-tapping the same syllables. This
// game has no syllable bank; it has three tone buttons that are identical on
// every level. With that mechanism gone the category had no rationale left -
// 48 of its 75 words already appear in themed levels and 48 in random, only
// 6 were unique to it, and it carried MORE tonal variety than Random itself.
// It was a longer Random pile under a different name.
//
// Seven words appeared ONLY in that category. Two of them (gúáfà, ọba) land
// in a generated tone-pattern set; the other five have tone sequences too
// rare to form one (àlùbọ́sà LLHL, olóńgbò MHHL and gọ́ọ̀mù HLL are the only
// words with those shapes at all). absorbLeftoverWords puts those into the
// Random playlist so dropping the category costs no vocabulary.
const OFFERED_CATEGORIES = ["tone_pattern", "themed", "endless_practice"];

// Smallest tone-pattern set worth offering as its own level. Upstream's own
// tone_pattern levels used exact-sequence grouping with an effective floor of
// 5, which yielded 3 levels; dropping to 3 and including speaker3 (upstream's
// were speaker1/speaker2 only) takes it to 7 without changing the rule. The
// binding constraint is vocabulary, not this number - see
// buildTonePatternLevels.
const MIN_PATTERN_WORDS = 3;

// For level names: "mid-high", "high-high-low". Matches the naming upstream
// already used for its own tone_pattern levels.
const TONE_SEQUENCE_LABEL = (tones) => tones.join("-");

let CURRENT_IMAGE_STYLE = "cartoon";
// ----------------------------

// --- TONE MODEL ---------------------------------------------------------
// Data-driven, from the acoustic study in the sibling repo
// yoruba_student_dict_platform/analysis - specifically
// build/legacy-tone-report/tone-distributions.json, 170 Praat
// autocorrelation observations over isolated careful-syllable clips.
//
//   hz     = that speaker's median F0 for that tone (medianHz)
//   centre = the equal-weight H/M/L geometric centre used to normalise
//            (Hz = centre * 2^(st/12)); see analysis/src/tone_lab/tone_report.py
//   glide  = the measured median contour (medianContourShapeSemitones),
//            in semitones relative to that tone's own median, sampled at
//            evenly-spaced points across the syllable
//
// For HIGH the first two contour points are dropped: the report is explicit
// that the early dip is consonant onset undershoot, not part of the tone
// target. The remaining points are re-centred on their own median so the
// perceived pitch still lands on the measured median.
//
// There is deliberately NO downdrift/declination term. The corpus these
// numbers come from discarded each clip's source word and position
// ("source word/position unavailable"; every row is flagged
// provenance_ambiguous_origin), so there is no measured basis for making
// a tone's pitch depend on where it sits in the word. Every card of a
// given tone uses the same target. Please don't "fix" this without data.
const TONE_MODEL = {
    speaker2: {
        centreHz: 229.529,
        high: { hz: 252.5, glide: [-0.51, -0.10, -0.11,  0.00,  0.11,  0.34,  0.37] },              // +0.88 st rise
        mid:  { hz: 232.3, glide: [ 0.55, -0.13,  0.07,  0.06,  0.00, -0.06, -0.05,  0.03, -0.07] }, // level
        low:  { hz: 209.3, glide: [ 1.17,  0.28,  0.53,  0.63,  0.00, -0.58, -0.60, -0.24, -0.42] }  // -1.59 st fall
    },
    speaker3: {
        centreHz: 125.012,
        high: { hz: 138.8, glide: [-1.30, -0.42, -0.03,  0.10,  0.00,  0.14,  0.19] },              // +1.49 st rise
        mid:  { hz: 123.8, glide: [ 0.20,  0.18,  0.13,  0.11,  0.00, -0.06, -0.17, -0.03, -0.16] }, // level
        low:  { hz: 113.2, glide: [ 1.90,  0.81,  0.50,  0.48,  0.00, -0.24, -0.21, -0.36, -0.89] }  // -2.79 st fall
    }
};

// Measured median syllable duration, and it is tone-independent (speaker2
// 0.428-0.450 s, speaker3 0.394-0.443 s across the three tones) - so tone
// is never encoded as length here, only as pitch.
const TONE_DURATION = 0.43;

// 1.0 plays the contours exactly as measured. These came from isolated
// CAREFUL syllables; the one paired natural-speech study in that repo
// (39 words, 104 syllable pairs) found tone height essentially unchanged in
// connected speech but contour movement strongly damped - high's rise fell
// from +1.97 st to +0.19 st. Since this game plays each tone as an isolated
// note, careful-speech shapes are the right register. Raise this to
// exaggerate the glides for beginners without re-deriving anything.
const TONE_SPREAD = 1.0;

const TONES = ["high", "mid", "low"];
const TONE_GLYPH = { high: "↗", mid: "→", low: "↘" };

// --- TONE DERIVATION ----------------------------------------------------
// vocab.json stores tone-marked syllables ("a", "dì", "yẹ") but no tone
// field, so tone is read off the combining marks. This mirrors the canonical
// implementation at yoruba_student_dict_platform/shared/src/tone.ts.
//
// The phonics game instead looks tone up in syllables.json with a "mid"
// fallback for anything missing. That fallback is fine there (tone is only
// a colour hint) but here it would silently produce WRONG ANSWERS, so this
// game never uses it. Verified against the shipped data: the derivation
// agrees with all 168 syllables.json tone labels, and applyTone(stripTone(s))
// round-trips all 225 syllables in vocab.json.
const ACUTE = "́";   // high
const GRAVE = "̀";   // low
const MACRON = "̄";  // explicit mid, only ever on a syllabic nasal
const VOWELS = "aeiou";

function toneOf(syllable) {
    const decomposed = syllable.normalize("NFD");
    if (decomposed.includes(ACUTE)) return "high";
    if (decomposed.includes(GRAVE)) return "low";
    return "mid";
}

// Removes tone marks only. The dot below ẹ/ọ/ṣ (U+0323) is segmental, not
// tonal, and must survive - "yẹ" strips to "yẹ", never "ye".
function stripTone(syllable) {
    const decomposed = syllable.normalize("NFD");
    let out = "";
    for (const ch of decomposed) {
        if (ch === ACUTE || ch === GRAVE || ch === MACRON) continue;
        out += ch;
    }
    return out.normalize("NFC");
}

// Puts the mark back on the tone bearer: the last vowel if the syllable has
// one, otherwise the syllabic nasal ("ń", "ǹ"). Mid is unmarked on a vowel
// but takes a macron on a nasal - the current vocab has no such syllable,
// but the upstream corpus does, so the rule is implemented rather than
// assumed away.
function applyTone(bare, tone) {
    const decomposed = bare.normalize("NFD");
    let bearer = -1;
    let bearerIsNasal = false;

    for (let i = 0; i < decomposed.length; i++) {
        if (VOWELS.includes(decomposed[i].toLowerCase())) bearer = i;
    }
    if (bearer === -1) {
        for (let i = 0; i < decomposed.length; i++) {
            if ("mn".includes(decomposed[i].toLowerCase())) { bearer = i; bearerIsNasal = true; break; }
        }
    }
    if (bearer === -1) return bare;

    const mark = tone === "high" ? ACUTE
               : tone === "low"  ? GRAVE
               : (bearerIsNasal ? MACRON : "");
    if (!mark) return decomposed.normalize("NFC");

    // Insert after the bearer AND after any combining marks already on it,
    // so "gbọn" + high becomes "gbọ́n" and not a mis-ordered sequence.
    let at = bearer + 1;
    while (at < decomposed.length && isCombining(decomposed[at])) at++;
    return (decomposed.slice(0, at) + mark + decomposed.slice(at)).normalize("NFC");
}

// syllables.json is keyed by tone-marked syllable, and like vocab.json it
// isn't uniformly NFC-normalized. Re-keying it on NFC means the lookup can't
// miss just because two files spelled the same syllable with a different
// combining-mark order.
function indexSyllablesByNfc(raw) {
    const indexed = {};
    Object.keys(raw).forEach((speaker) => {
        indexed[speaker] = {};
        Object.keys(raw[speaker]).forEach((syllable) => {
            indexed[speaker][syllable.normalize("NFC")] = raw[speaker][syllable];
        });
    });
    return indexed;
}

function isCombining(ch) {
    const code = ch.codePointAt(0);
    return (code >= 0x0300 && code <= 0x036f) || (code >= 0x1ab0 && code <= 0x1aff);
}
// ------------------------------------------------------------------------

let gameData = [];     // every level, every category, unfiltered
let activeLevels = []; // the currently-chosen playlist's levels (see selectPlaylist)
let currentLevelIndex = 0;
let currentWordIndex = 0;

let currentLevel = null;
let currentWord = null;
let picks = [];        // one entry per syllable card: a tone name, or null
let activeCard = 0;    // which card the next tone pick lands on
let maxSlots = 0;
let isSolved = false;
let isTransitioning = false;
let currentPlayingAudio = null;

// Only read after a word is solved, to play the real recorded syllable for
// the correctly tone-marked syllable. Keyed { speaker: { NFC syllable: info } }
// - see indexSyllablesByNfc. Verified: every syllable of every word in every
// surviving level has audio for that level's speaker.
let syllableIndex = {};

// Transient overlay message (see #toast in style.css) - replaces a
// permanently-reserved text line with something that only takes up
// space while it's actually showing something.
let toastTimeout = null;
function showToast(text, variant = 'info', duration = 1400) {
    const el = document.getElementById('toast');
    clearTimeout(toastTimeout);
    el.textContent = text;
    el.className = 'show ' + variant;
    if (duration) {
        toastTimeout = setTimeout(() => el.classList.remove('show'), duration);
    }
}

// Optional browser fullscreen - must be called directly from a user
// gesture (this button's click), browsers won't allow it otherwise.
// Note: iOS Safari on iPhone does not support the Fullscreen API for
// arbitrary page content at all (a longstanding Apple platform
// limitation, only <video> supports it there) - this will silently
// no-op on that specific browser, nothing to fix on our end for it.
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch((err) => {
            console.warn('Fullscreen request failed or unsupported:', err);
        });
    } else {
        document.exitFullscreen?.();
    }
}

document.addEventListener('fullscreenchange', () => {
    document.getElementById('fullscreen-btn')?.classList.toggle('active', !!document.fullscreenElement);
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- AUDIO --------------------------------------------------------------
// One lazily-created AudioContext for everything synthesized: the three
// Yoruba tones and the two feedback sounds. resume() on every use because
// iOS suspends the context aggressively.
let audioCtx = null;
function getAudioCtx() {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
    return audioCtx;
}

// Short sine notes with a soft attack and exponential decay - lifted from
// the story game's playChime, which is the phonics correct-answer chime
// generalized. Used ONLY for feedback sounds, never for the tones: keeping
// the timbres apart is what makes "you got it right" unmistakably not a
// Yoruba tone.
function playChime(freqs, { gain = 0.25, noteGap = 0.12, decay = 0.3 } = {}) {
    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const start = now + i * noteGap;
            gainNode.gain.setValueAtTime(0, start);
            gainNode.gain.linearRampToValueAtTime(gain, start + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, start + decay);
            osc.connect(gainNode).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + decay + 0.02);
        });
    } catch (err) {
        console.warn("Could not play chime:", err);
    }
}

// Deliberately unlike the tones on all three of register, timbre and
// envelope: a bright bell arpeggio two-plus octaves above every synthesized
// tone (which top out at 252 Hz), pure sine, long decay.
const playSuccess = () => playChime([784, 1047, 1319], { gain: 0.22, noteGap: 0.11, decay: 0.6 });

// The wrong-answer sound does overlap the tones in register, so what keeps
// it distinct is the short percussive envelope and the descending pair.
// Kept quiet on purpose - there's no score and no penalty here, it just
// tells you to listen again.
const playWrong = () => playChime([196, 147], { gain: 0.14, noteGap: 0.09, decay: 0.18 });

// A Yoruba tone, synthesized in the pitch range of the speaker whose
// recording the player just heard.
//
// Three earlier attempts are recorded here because each one's fix caused the
// next one's problem, and the reasoning is not obvious from the result.
//
// v1: six sine harmonics at 1/n. Pitch-accurate but every tone sounded
// mournful whatever its pitch - six harmonics is a hard ceiling at six times
// the fundamental, about 1.5 kHz for speaker2 and only 833 Hz for speaker3,
// where a real vowel carries energy past 4 kHz. Muffled reads as sad.
//
// v2: a sawtooth through two sharp formant filters. Fixed the dullness, and
// was harsh and angry. Measured, it doubled brightness but nearly doubled
// crest factor (peak over RMS) too, 2.6 -> 4.2.
//
// v3: additive again with a steeper rolloff. Measured *darker* than v1. The
// brightness had been coming from the shallow rolloff all along, so softening
// that threw away the only thing v2 got right.
//
// v4, here. A parameter sweep showed brightness and crest were locked together
// - every setting brighter than v1 was harsher than v1 - which pointed at the
// real culprit: PHASE. Harmonics that all start at zero sum to a spike, and a
// spike is what a sawtooth is. Same spectrum, spread out in time, is far less
// edgy. So instead of stacking oscillators this builds one PeriodicWave, whose
// real/imag pairs set each harmonic's amplitude AND phase, using Schroeder
// phase (-pi*n^2/N), the classic crest-minimising choice. Measured: identical
// brightness at 435 Hz, crest 6.78 -> 3.59.
//
// It is also much cheaper - one oscillator per tone rather than twelve.
//
// Still deliberately untouched: the pitches and contours. Four of the six
// glides fall and the low-to-high span is 325-353 cents, between a minor and a
// major third. That is what was measured from the recordings, and it is why
// these sound plaintive - a fact about Yoruba tone, not a synthesis artifact.
//
// These are the "soft" settings, chosen by ear from a four-way listening
// comparison (current / soft / warm / clear) - see tools/tone-compare, which
// regenerates that comparison if this is ever revisited. Soft measured 306 Hz
// brightness against the old version's 301, so it is not brighter on paper;
// what it fixes is the hard spectral cliff at the 6th harmonic, which is what
// made the old one sound like a voice behind a door. Warm (363 Hz) and clear
// (439 Hz) were both brighter and both judged too edgy.
const TONE_VOICE = {
    harmonics: 12,
    rolloff: 1.45,       // amplitude proportional to 1/n^rolloff; 1.0 is a sawtooth
    formantHz: 600,      // one broad, shallow vowel-ish resonance
    formantQ: 1.0,       // broad on purpose - v2 used Q 6-8 and it rang
    formantGain: 3,      // dB
    lowpassHz: 1800,     // two poles of this, see below
    peakGain: 0.15       // set so overall level matches the version this replaced
};
const VIBRATO_HZ = 5.2;         // a voice is never perfectly still; dead-steady reads as lifeless
const VIBRATO_DEPTH_ST = 0.09;  // a tenth of a semitone - felt, not heard as wobble
const VIBRATO_ONSET = 0.18;     // real vibrato arrives after onset, it is not there at the start

// PeriodicWave is immutable and tied to its context, so build each distinct
// voice once and keep it. Cached on the context itself, which keeps offline
// rendering in the tests independent of the live one.
function toneWave(ctx, voice) {
    const key = `${voice.harmonics}|${voice.rolloff}`;
    ctx.__toneWaves = ctx.__toneWaves || {};
    if (ctx.__toneWaves[key]) return ctx.__toneWaves[key];

    const real = new Float32Array(voice.harmonics + 1);
    const imag = new Float32Array(voice.harmonics + 1);
    for (let n = 1; n <= voice.harmonics; n++) {
        const amplitude = 1 / Math.pow(n, voice.rolloff);
        const phase = -Math.PI * n * n / voice.harmonics; // Schroeder
        real[n] = amplitude * Math.cos(phase);
        imag[n] = amplitude * Math.sin(phase);
    }
    ctx.__toneWaves[key] = ctx.createPeriodicWave(real, imag);
    return ctx.__toneWaves[key];
}

// Builds the node graph for one tone on any context and returns its output.
// Split out from playTone so the tests can render it offline and measure it:
// brightness and harshness are the whole point of this code and neither can be
// judged by eye. `voice` is overridable so candidates can be rendered and
// compared side by side without editing this file.
function buildToneGraph(ctx, tone, speaker, start, voice = TONE_VOICE) {
    const model = TONE_MODEL[speaker]?.[tone];
    if (!model) return null;

    // The measured contour, as an absolute Hz curve.
    const curve = new Float32Array(model.glide.length);
    for (let i = 0; i < model.glide.length; i++) {
        curve[i] = model.hz * Math.pow(2, (model.glide[i] * TONE_SPREAD) / 12);
    }

    const osc = ctx.createOscillator();
    osc.setPeriodicWave(toneWave(ctx, voice));
    osc.frequency.setValueCurveAtTime(curve, start, TONE_DURATION);

    // Vibrato adds to the frequency param on top of the glide automation (an
    // AudioParam sums its automation with any connected node output), so the
    // measured contour is untouched - this only puts life on top of it.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = VIBRATO_HZ;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(model.hz * (Math.pow(2, VIBRATO_DEPTH_ST / 12) - 1), start + VIBRATO_ONSET);
    lfo.connect(depth).connect(osc.frequency);

    const formant = ctx.createBiquadFilter();
    formant.type = "peaking";
    formant.frequency.value = voice.formantHz;
    formant.Q.value = voice.formantQ;
    formant.gain.value = voice.formantGain;
    osc.connect(formant);

    // Two poles rather than one. A single biquad rolls off at 12 dB/octave,
    // which leaves audible energy well into 3-5 kHz - the band the ear is most
    // sensitive to and where "harsh" lives. Cascading two gets 24 dB/octave, so
    // the low harmonics that carry brightness survive and the ones that bite
    // do not.
    const lowpassA = ctx.createBiquadFilter();
    lowpassA.type = "lowpass";
    lowpassA.frequency.value = voice.lowpassHz;
    lowpassA.Q.value = 0.54;
    const lowpassB = ctx.createBiquadFilter();
    lowpassB.type = "lowpass";
    lowpassB.frequency.value = voice.lowpassHz;
    lowpassB.Q.value = 1.31;
    formant.connect(lowpassA); lowpassA.connect(lowpassB);

    // Curved rather than straight: a linear fade to silence sounds like someone
    // pulling a fader, an exponential one sounds like a note ending. The slight
    // droop across the sustain is there for the same reason as the vibrato - a
    // perfectly flat level is the sound of a machine.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(voice.peakGain, start + 0.025);
    env.gain.exponentialRampToValueAtTime(voice.peakGain * 0.82, start + TONE_DURATION - 0.07);
    env.gain.exponentialRampToValueAtTime(0.0001, start + TONE_DURATION);
    lowpassB.connect(env);

    osc.start(start);
    osc.stop(start + TONE_DURATION + 0.02);
    lfo.start(start);
    lfo.stop(start + TONE_DURATION + 0.02);

    return env;
}

function playTone(tone, speaker, whenOffset = 0) {
    try {
        const ctx = getAudioCtx();
        const out = buildToneGraph(ctx, tone, speaker, ctx.currentTime + whenOffset);
        if (out) out.connect(ctx.destination);
    } catch (err) {
        console.warn("Could not play tone:", err);
    }
}

// The word's correct tones played in order - the tone game's equivalent of
// hearing the syllables, and the most useful teaching affordance here.
function playToneMelody(tones, speaker) {
    tones.forEach((tone, i) => playTone(tone, speaker, i * (TONE_DURATION - 0.14)));
}
// ------------------------------------------------------------------------

// Enables each playlist button once we know which categories actually
// have levels for the current data - avoids offering a playlist that
// would open into an empty game.
function initializePlaylistMenu() {
    const counts = {};
    gameData.forEach((level) => { counts[level.category] = (counts[level.category] || 0) + 1; });
    document.querySelectorAll('.playlist-btn').forEach((btn) => {
        btn.disabled = !counts[btn.dataset.category];
    });
}

// Every level carries a `category` - straight from sessions.json for themed
// and random levels, set by buildTonePatternLevels for the generated ones -
// and this filters to just that category and starts play, rather than mixing
// the playlists together in one dropdown.
function selectPlaylist(category) {
    activeLevels = gameData.filter((level) => level.category === category);
    if (activeLevels.length === 0) return; // shouldn't happen - button would be disabled
    document.getElementById('start-overlay').style.display = 'none';
    initializeThemeSelector();
    loadLevel(0);
}

function showPlaylistMenu() {
    document.getElementById('start-overlay').style.display = 'flex';
}

// Clicking the translucent backdrop itself (not a button inside the
// menu) dismisses it WITHOUT changing the playlist - but only once a
// game is already loaded, so the very first, mandatory choice can't be
// skipped by an accidental backdrop tap. That first tap is also what
// unlocks audio, which is what lets loadWord() autoplay the word.
document.getElementById('start-overlay').addEventListener('click', (event) => {
    if (event.target.id === 'start-overlay' && currentLevel) {
        document.getElementById('start-overlay').style.display = 'none';
    }
});

async function loadGame() {
    try {
        const [wordsResponse, syllablesResponse, sessionsResponse] = await Promise.all([
            fetch(DATA_DIR + 'vocab.json'),
            fetch(DATA_DIR + 'syllables.json'),
            fetch(DATA_DIR + 'sessions.json')
        ]);

        const dictionaryWords = await wordsResponse.json();
        syllableIndex = indexSyllablesByNfc(await syllablesResponse.json());
        const sessions = await sessionsResponse.json();

        // Two gates here. A level with no validSpeakers has no
        // guaranteed-complete audio for any speaker - the exporter only ever
        // emits levels it has verified, so an empty list means hand-edited or
        // stale data, and playing it anyway would mean silently missing audio.
        // On top of that this game only supports speaker2 and speaker3 (see
        // ALLOWED_SPEAKERS), so levels recorded solely by speaker1 are skipped
        // - 24 of the 30 levels survive the speaker gate.
        const playableSessions = sessions.filter(session =>
            session.validSpeakers &&
            session.validSpeakers.some(speaker => ALLOWED_SPEAKERS.includes(speaker))
        );
        const skippedCount = sessions.length - playableSessions.length;
        if (skippedCount > 0) {
            console.info(`[Skipped] ${skippedCount} level(s) with no audio from a supported speaker.`);
        }

        // Every playable (word, speaker) pair, deduped, gathered from ALL
        // sessions - including categories this game doesn't offer, since audio
        // validity is per-speaker and has nothing to do with which playlist a
        // word happens to sit in. This is what the generated tone-pattern
        // levels draw from.
        const wordPool = new Map();

        const sessionLevels = playableSessions.map(session => {
            const levelSpeaker = session.validSpeakers.find(speaker => ALLOWED_SPEAKERS.includes(speaker));
            const sessionWords = [];

            session.words.forEach(wordId => {
                const word = buildWord(wordId, dictionaryWords[wordId], levelSpeaker);
                if (!word) return;
                sessionWords.push(word);
                wordPool.set(`${levelSpeaker}|${wordId}`, word);
            });

            return {
                levelId: session.levelId,
                category: session.category,
                speaker: levelSpeaker,
                words: shuffleArray(sessionWords)
            };
        });

        // sessions.json's own tone_pattern levels are replaced wholesale by
        // the generated ones - same grouping rule, lower threshold, both
        // speakers (the generated set is a strict superset of the three
        // upstream levels, which it reproduces exactly).
        gameData = [
            ...buildTonePatternLevels(wordPool),
            ...sessionLevels.filter(level =>
                level.category !== 'tone_pattern' && OFFERED_CATEGORIES.includes(level.category))
        ];

        absorbLeftoverWords(gameData, wordPool);

        initializePlaylistMenu();

    } catch (error) {
        showToast("Error loading game data.", 'error', 0); // 0 = stays until reload, this isn't transient
        console.error("Failed to load game data:", error);
    }
}

// One playable word for one speaker, or null if it can't be played.
//
// sessions.json hard-gates every word on having a real image (same as audio
// coverage) - a placeholder graphic standing in for missing art is fabricated
// content, not an acceptable degrade. The image check here is defense-in-depth
// only: it should never trigger against correctly-generated content, but if it
// ever does, skip the word entirely rather than show a placeholder.
//
// Everything text-shaped is normalized to NFC. vocab.json is not uniformly
// normalized - 5 of its 225 syllables store a precomposed accented vowel plus
// a trailing combining dot below ("bọ́" as b + U+00F3 + U+0323), which renders
// identically but is a different string from the NFC form. Normalizing once
// here keeps every comparison and lookup downstream working on one form.
function buildWord(wordId, wordData, speaker) {
    const imageStyles = wordData?.imageStyles || [];
    if (wordData && imageStyles.length === 0) {
        console.error(`[Missing Image] "${wordId}" has no labeled image - excluding it.`);
    }
    if (!wordData || imageStyles.length === 0) return null;

    const chosenStyle = imageStyles.includes(CURRENT_IMAGE_STYLE)
        ? CURRENT_IMAGE_STYLE
        : imageStyles[0];

    return {
        id: wordId,
        targetWord: wordData.displayText.normalize("NFC"),                 // "adìyẹ" - revealed on success
        markedSyllables: wordData.syllables.map(s => s.normalize("NFC")),  // ["a","dì","yẹ"] - for the real syllable audio
        bareSyllables: wordData.syllables.map(stripTone),                  // ["a","di","yẹ"] - what the cards show
        targetTones: wordData.syllables.map(toneOf),                       // ["mid","low","mid"] - the answer
        speaker,
        fullAudioUrl: `${BASE_URL}words/${speaker}/${wordId}.wav`,
        imageUrl: `${BASE_URL}images/${chosenStyle}/${wordId}.png`
    };
}

// Builds the Tone Patterns playlist by grouping every playable word by its
// EXACT tone sequence, per speaker.
//
// Exact is the point. Grouping by, say, the first two tones would yield more
// and larger levels (12 instead of 7), but it would file "Okúdù" (mid-high-low)
// under a level called "mid-high", and a level whose name doesn't describe its
// answers is worse than no level. Exact grouping means once you've heard two
// words in a set you genuinely know the shape of the rest.
//
// Grouping is per-speaker because word audio is per-speaker (words/<speaker>/
// <id>.wav) - a level plays one voice, so a pattern with two words from each
// speaker is two thin sets, not one good one. That, plus the fact that exact
// patterns fragment by syllable count, is why only 7 sets clear
// MIN_PATTERN_WORDS out of 36 (pattern, speaker) groups. The ceiling here is
// vocabulary: 67 playable word/speaker pairs. More sets need more words with
// images and speaker2/speaker3 audio, not a looser rule.
//
// Ordered easiest first: fewest distinct tones (a word that is all one tone
// asks the player to hear no contrast at all), then fewest syllables, then
// alphabetically for stability.
function buildTonePatternLevels(wordPool) {
    const groups = new Map();

    wordPool.forEach((word) => {
        const key = `${word.speaker}|${word.targetTones.join("-")}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(word);
    });

    const levels = [];
    groups.forEach((words) => {
        if (words.length < MIN_PATTERN_WORDS) return;
        const tones = words[0].targetTones;
        levels.push({
            levelId: `Tone Pattern (${TONE_SEQUENCE_LABEL(tones)}) — ${words[0].speaker}`,
            category: 'tone_pattern',
            speaker: words[0].speaker,
            distinctTones: new Set(tones).size,
            length: tones.length,
            words: shuffleArray(words.slice())
        });
    });

    levels.sort((a, b) =>
        a.distinctTones - b.distinctTones ||
        a.length - b.length ||
        a.levelId.localeCompare(b.levelId));

    console.info(`[Tone Patterns] ${levels.length} generated set(s): ` +
        levels.map(l => `${l.levelId} (${l.words.length})`).join(', '));

    return levels;
}

// Any playable word that no offered level happens to contain gets added to
// the Random playlist, so the words that were only reachable through the
// dropped syllable_reinforcement category aren't silently lost with it.
// Random is the honest home for them: unlike Themed or Tone Patterns it makes
// no claim about what its levels have in common.
//
// Preference is to append to an existing Random level for the same speaker -
// a level has one voice, and a one-word level would be a silly thing to put in
// a menu. Only if a speaker has no Random level at all does this create one.
function absorbLeftoverWords(levels, wordPool) {
    const covered = new Set(levels.flatMap(level => level.words.map(word => `${word.speaker}|${word.id}`)));
    const leftovers = [];
    wordPool.forEach((word, key) => { if (!covered.has(key)) leftovers.push(word); });
    if (leftovers.length === 0) return;

    leftovers.forEach((word) => {
        const host = levels.filter(level => level.category === 'endless_practice' && level.speaker === word.speaker).pop();
        if (host) {
            host.words.push(word);
        } else {
            levels.push({
                levelId: `Random Mix — ${word.speaker}`,
                category: 'endless_practice',
                speaker: word.speaker,
                words: [word]
            });
        }
    });

    // Re-shuffle any level that grew, so the added words aren't always last.
    levels.forEach((level) => { if (level.category === 'endless_practice') shuffleArray(level.words); });

    console.info(`[Leftovers] ${leftovers.length} word(s) added to Random: ` +
        leftovers.map(w => `${w.targetWord} (${w.speaker})`).join(', '));
}

// Rebuilt each time selectPlaylist() runs, so it only ever lists levels
// from the currently-chosen playlist, not every playlist mixed together.
function initializeThemeSelector() {
    const selector = document.getElementById('theme-selector');
    selector.innerHTML = '';
    selector.onchange = null;

    activeLevels.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.innerText = level.levelId;
        selector.appendChild(option);
    });

    selector.onchange = (event) => {
        loadLevel(parseInt(event.target.value));
    };
}

function loadLevel(levelIndex) {
    if (levelIndex >= activeLevels.length) {
        showToast("You've completed this playlist!", 'info', 0);
        return;
    }

    currentLevelIndex = levelIndex;
    currentLevel = activeLevels[currentLevelIndex];
    document.getElementById('theme-selector').value = currentLevelIndex;
    document.getElementById('theme-selector').title = currentLevel.levelId;

    // The pitch lines on the tone buttons are drawn from the current
    // speaker's own measured contours, so they change with the level.
    renderTonePitchLines(currentLevel.speaker);
    loadWord(0);
}

function loadWord(wordIndex) {
    currentWordIndex = wordIndex;
    currentWord = currentLevel.words[currentWordIndex];

    maxSlots = currentWord.bareSyllables.length;
    picks = new Array(maxSlots).fill(null);
    activeCard = 0;
    isSolved = false;

    const imgElement = document.getElementById('prompt-image');
    imgElement.onerror = function () {
        this.onerror = null;
        this.src = 'images/placeholder.png';
    };
    imgElement.src = currentWord.imageUrl;

    clearTimeout(toastTimeout);
    document.getElementById('toast').classList.remove('show');
    document.getElementById('syllable-cards').classList.remove('correct', 'show-hint');
    document.getElementById('correct-badge').classList.remove('show');
    document.getElementById('word-reveal').classList.remove('show');
    document.getElementById('word-reveal').textContent = '';
    showingHint = false;
    document.getElementById('hint-btn').classList.remove('active');

    renderCards();
    isTransitioning = false;

    // Unlike the phonics game, the word plays by itself: picking the tones IS
    // the task here, so making the player tap to hear it first would just be
    // a step in the way. Legal because the mandatory playlist-menu tap has
    // already unlocked audio. Touching the AudioContext here too so the
    // first synthesized tone isn't swallowed on iOS.
    getAudioCtx();
    playFullWordAudio();
}

// Toggle the per-card tone-hint dots (see style.css's .card::before) on or
// off, and play the correct tone melody once so the hint is heard as well as
// seen - which is the whole point in a listening game.
let showingHint = false;
function toggleToneHint() {
    if (!currentWord || isTransitioning) return;
    showingHint = !showingHint;
    document.getElementById('syllable-cards').classList.toggle('show-hint', showingHint);
    document.getElementById('hint-btn').classList.toggle('active', showingHint);
    if (showingHint) playToneMelody(currentWord.targetTones, currentWord.speaker);
}

// Interrupting our own playback is normal here - every tap stops whatever
// was playing before it - and the interrupted play() promise rejects with
// AbortError. That's the mechanism working, not a failure, so it's swallowed
// silently; anything else still gets reported.
function reportAudioFailure(context, error) {
    if (error && error.name === 'AbortError') return;
    console.warn(`Audio playback blocked or file missing (${context}):`, error);
}

function playFullWordAudio() {
    if (currentWord && currentWord.fullAudioUrl) {
        if (currentPlayingAudio) {
            currentPlayingAudio.pause();
            currentPlayingAudio.currentTime = 0;
        }
        currentPlayingAudio = new Audio(currentWord.fullAudioUrl);
        currentPlayingAudio.play().catch((err) => reportAudioFailure(currentWord.fullAudioUrl, err));
    }
}

function moveToNextWord() {
    const nextWordIndex = currentWordIndex + 1;
    if (nextWordIndex < currentLevel.words.length) {
        loadWord(nextWordIndex);
    } else {
        showToast("Level Complete! Loading next set...", 'info', 1500);
        setTimeout(() => loadLevel(currentLevelIndex + 1), 1500);
    }
}

// Mirrors moveToNextWord() - stays within the current level (no
// wraparound into the previous theme), floors at the first word.
function prevWord() {
    if (isTransitioning) return;
    const prevWordIndex = currentWordIndex - 1;
    if (prevWordIndex >= 0) {
        loadWord(prevWordIndex);
    }
}

function skipWord() {
    if (isTransitioning) return; // Prevent spam-clicking
    isTransitioning = true;
    showToast("Skipping word...", 'skipping', 800);
    setTimeout(moveToNextWord, 800);
}

// --- CARDS --------------------------------------------------------------
// One card per syllable, showing that syllable with its tone mark stripped
// off - the mark IS the answer, so leaving it on would give the game away.
// A card with a tone picked re-renders its text WITH that mark applied, so
// the player watches the word's real spelling assemble itself as they go.
function renderCards() {
    const container = document.getElementById('syllable-cards');
    container.innerHTML = '';

    currentWord.bareSyllables.forEach((bare, i) => {
        const pick = picks[i];
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'card tone-' + (currentWord.targetTones[i] || 'mid');
        if (pick) card.classList.add('filled', 'picked-' + pick);
        if (i === activeCard && !isSolved) card.classList.add('active');
        card.onclick = () => handleCardClick(i);

        const text = document.createElement('span');
        text.className = 'card-text';
        text.textContent = pick ? applyTone(bare, pick) : bare;

        const glyph = document.createElement('span');
        glyph.className = 'card-glyph';
        glyph.textContent = pick ? TONE_GLYPH[pick] : '';

        card.append(glyph, text);
        card.setAttribute('aria-label', pick ? `${bare}, ${pick} tone` : `${bare}, no tone yet`);
        container.appendChild(card);
    });
}

// The cards stay tappable throughout, and what a tap does depends on where
// the word is: pick a card to aim at, replay a tone you already chose, or -
// once the word is solved - hear a real person say that exact syllable.
function handleCardClick(index) {
    if (isSolved) {
        playRecordedSyllable(index);
        return;
    }
    if (isTransitioning) return;

    activeCard = index;
    if (picks[index]) playTone(picks[index], currentWord.speaker);
    renderCards();
}

function playRecordedSyllable(index) {
    const info = syllableIndex[currentWord.speaker]?.[currentWord.markedSyllables[index]];
    if (!info || !info.audio) return;
    if (currentPlayingAudio) {
        currentPlayingAudio.pause();
        currentPlayingAudio.currentTime = 0;
    }
    currentPlayingAudio = new Audio(BASE_URL + info.audio);
    currentPlayingAudio.play().catch((err) => reportAudioFailure(info.audio, err));
}

// --- PICKING ------------------------------------------------------------
function handleTonePick(tone) {
    // The tone buttons always make a sound, even while the game is locked
    // (mid-transition, or after a win) - they double as an ear-training
    // reference, and a button that silently does nothing feels broken.
    playTone(tone, currentLevel?.speaker || ALLOWED_SPEAKERS[0]);
    if (isTransitioning || isSolved || !currentWord) return;

    picks[activeCard] = tone;
    activeCard = nextEmptyCard(activeCard);
    renderCards();

    if (picks.every(Boolean)) checkAnswer();
}

// Next card still waiting for a tone, searching forward and wrapping - so
// going back to fix one card returns you to wherever the real gap is.
function nextEmptyCard(from) {
    for (let step = 1; step <= maxSlots; step++) {
        const i = (from + step) % maxSlots;
        if (!picks[i]) return i;
    }
    return from;
}

function checkAnswer() {
    const isMatch = picks.every((pick, i) => pick === currentWord.targetTones[i]);

    if (isMatch) {
        isSolved = true;
        isTransitioning = true;

        // Stop the word audio if it's still going, so it doesn't run into
        // the success chime and the full-word repeat below.
        if (currentPlayingAudio) {
            currentPlayingAudio.pause();
            currentPlayingAudio.currentTime = 0;
        }

        showToast("Correct! Great job!", 'correct', 2000);
        document.getElementById('syllable-cards').classList.add('correct');
        document.getElementById('correct-badge').classList.add('show');

        // The payoff for a game played on stripped syllables: the properly
        // tone-marked spelling of the word they just heard.
        const reveal = document.getElementById('word-reveal');
        reveal.textContent = currentWord.targetWord;
        reveal.classList.add('show');

        renderCards();
        playSuccess();
        playWinningSequence();
        return;
    }

    // No score, no lives, no penalty - the same no-punishment spirit as the
    // phonics game. Show which cards were wrong, clear everything, replay
    // the word, let them go again.
    isTransitioning = true;
    playWrong();

    const cards = document.querySelectorAll('#syllable-cards .card');
    picks.forEach((pick, i) => {
        if (pick !== currentWord.targetTones[i]) cards[i]?.classList.add('wrong');
    });

    setTimeout(() => {
        picks = new Array(maxSlots).fill(null);
        activeCard = 0;
        renderCards();
        isTransitioning = false;
        playFullWordAudio();
    }, 900);
}

function playWinningSequence() {
    setTimeout(() => {
        const fullWordAudio = new Audio(currentWord.fullAudioUrl);
        let hasMovedOn = false; // Flag to prevent double-firing

        const triggerNext = () => {
            if (!hasMovedOn) {
                hasMovedOn = true;
                setTimeout(moveToNextWord, 1200);
            }
        };

        fullWordAudio.onended = triggerNext;
        fullWordAudio.play().catch(triggerNext);

        // FAILSAFE: if the OS freezes the audio (e.g. an incoming call),
        // onended never fires - force the game to move on anyway.
        setTimeout(triggerNext, 3500);

    }, 700);
}

// --- TONE BUTTON PITCH LINES --------------------------------------------
// Draws each tone's real measured contour on its button, all three on a
// shared vertical scale so the lines show tone HEIGHT as well as shape:
// high sits near the top, low near the bottom, mid level in between.
function renderTonePitchLines(speaker) {
    const model = TONE_MODEL[speaker];
    if (!model) return;

    // Absolute semitones from this speaker's centre, so the three tones are
    // comparable to each other rather than each self-centred.
    const series = {};
    let min = Infinity;
    let max = -Infinity;
    TONES.forEach((tone) => {
        const base = 12 * Math.log2(model[tone].hz / model.centreHz);
        const points = model[tone].glide.map((st) => base + st * TONE_SPREAD);
        series[tone] = points;
        points.forEach((v) => { min = Math.min(min, v); max = Math.max(max, v); });
    });

    const span = (max - min) || 1;
    TONES.forEach((tone) => {
        const svg = document.querySelector(`.tone-group-${tone} .tone-line`);
        if (!svg) return;
        const points = series[tone].map((v, i) => {
            const x = 3 + (i / (series[tone].length - 1)) * 54;
            const y = 21 - ((v - min) / span) * 18;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        svg.innerHTML = `<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`;
    });
}

loadGame();
