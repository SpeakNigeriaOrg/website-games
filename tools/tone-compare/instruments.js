// Instrument-style voices for the tone comparison, injected into the game page
// by render.mjs. These are NOT part of the game - they exist to answer "why do
// real instruments sound pleasant when our tone does not", by ear.
//
// The answer, and the thing every one of these has that the game's own tone
// lacks: a time-varying spectrum with a real attack. The game's tone is a
// static harmonic spectrum with a level ramp on it, which is what an organ or a
// test tone is. A struck or plucked instrument is an EVENT - a fast noisy
// onset, then high partials dying away much faster than low ones. That
// evolution is most of what the ear recognises as "an instrument".
//
// Every voice here follows the measured pitch contour from TONE_MODEL, applied
// over TONE_DURATION exactly as the game does it, so the tone distinction is
// preserved. For struck instruments that is physically nonsense - a piano
// string cannot change pitch after the hammer leaves it - and it reads as a
// slide or a bend. That was accepted deliberately: the game needs the contour.
//
// Each entry declares its own `duration`, because a piano note that is cut off
// at 430 ms sounds like a mistake. That has a cost worth remembering: the hint
// melody plays tones 290 ms apart, so anything with a long tail will overlap
// into a chord rather than a sequence.

(function () {
  const SR_NOISE = {};

  function noiseBuffer(ctx, seconds) {
    const key = `${ctx.sampleRate}|${seconds}`;
    if (SR_NOISE[key]) return SR_NOISE[key];
    const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    SR_NOISE[key] = buf;
    return buf;
  }

  // The measured contour as an absolute Hz curve - identical to what the game
  // builds, so these are comparable to it.
  function pitchCurve(tone, speaker) {
    const model = TONE_MODEL[speaker][tone];
    const curve = new Float32Array(model.glide.length);
    for (let i = 0; i < model.glide.length; i++) {
      curve[i] = model.hz * Math.pow(2, model.glide[i] / 12);
    }
    return { curve, hz: model.hz };
  }

  function scaled(curve, factor) {
    const out = new Float32Array(curve.length);
    for (let i = 0; i < curve.length; i++) out[i] = curve[i] * factor;
    return out;
  }

  // A short filtered noise burst: the hammer thump, the pick scrape, the mallet
  // click. Tiny in level, disproportionately large in how physical it sounds.
  function transient(ctx, start, { length, gain, type = 'lowpass', hz, q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, length);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = hz;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);
    src.connect(filter); filter.connect(env);
    src.start(start); src.stop(start + length + 0.01);
    return env;
  }

  // Additive with a SEPARATE decay per partial. This is the whole trick for
  // struck and plucked sounds: partial n decays in decay1/(1 + falloff*(n-1)),
  // so the sound is bright for a few tens of milliseconds and mellow after.
  // `stretch` adds piano-style inharmonicity - real strings have partials a
  // little above exact multiples, which is part of why a piano sounds like wood
  // and wire rather than like a synthesiser.
  function struck(ctx, tone, speaker, start, opts) {
    const { curve } = pitchCurve(tone, speaker);
    const bus = ctx.createGain();
    let norm = 0;
    for (let n = 1; n <= opts.partials; n++) norm += 1 / Math.pow(n, opts.rolloff);

    for (let n = 1; n <= opts.partials; n++) {
      const stretch = opts.stretch ? Math.sqrt(1 + opts.stretch * n * n) : 1;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueCurveAtTime(scaled(curve, n * stretch), start, TONE_DURATION);

      const amp = (1 / Math.pow(n, opts.rolloff)) / norm * opts.gain;
      const decay = opts.decay / (1 + opts.falloff * (n - 1));
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp, start + opts.attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + opts.attack + decay);
      osc.connect(env); env.connect(bus);
      osc.start(start); osc.stop(start + opts.attack + decay + 0.02);
    }
    if (opts.transient) transient(ctx, start, opts.transient).connect(bus);
    return bus;
  }

  // Fixed set of modes rather than a harmonic series - how a struck bar or tube
  // actually rings. The ratios below are measured marimba bar modes.
  function modal(ctx, tone, speaker, start, opts) {
    const { curve } = pitchCurve(tone, speaker);
    const bus = ctx.createGain();
    opts.modes.forEach(([mult, amp, decay]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueCurveAtTime(scaled(curve, mult), start, TONE_DURATION);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * opts.gain, start + opts.attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + opts.attack + decay);
      osc.connect(env); env.connect(bus);
      osc.start(start); osc.stop(start + opts.attack + decay + 0.02);
    });
    if (opts.transient) transient(ctx, start, opts.transient).connect(bus);
    return bus;
  }

  // FM: one sine modulating another's frequency. With a modulation index that
  // decays, the sound starts complex and settles toward a near-sine - which is
  // roughly what a bell does, and why FM was the sound of 1980s electric pianos.
  // A non-integer ratio makes the partials inharmonic, i.e. bell-like.
  function fm(ctx, tone, speaker, start, opts) {
    const { curve, hz } = pitchCurve(tone, speaker);
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueCurveAtTime(curve, start, TONE_DURATION);

    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueCurveAtTime(scaled(curve, opts.ratio), start, TONE_DURATION);

    const index = ctx.createGain();
    index.gain.setValueAtTime(hz * opts.index, start);
    index.gain.exponentialRampToValueAtTime(hz * 0.01, start + opts.indexDecay);
    mod.connect(index); index.connect(carrier.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(opts.gain, start + opts.attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + opts.attack + opts.decay);
    carrier.connect(env);

    carrier.start(start); carrier.stop(start + opts.attack + opts.decay + 0.02);
    mod.start(start); mod.stop(start + opts.attack + opts.decay + 0.02);
    if (opts.transient) transient(ctx, start, opts.transient).connect(env.context === ctx ? env : env);
    return env;
  }

  // Sustained and blown or bowed. These keep the pitch contour far more audible
  // than a struck sound does, because the energy is spread across the whole note
  // instead of concentrated in the first 50 ms.
  function sustained(ctx, tone, speaker, start, opts) {
    const { curve, hz } = pitchCurve(tone, speaker);
    const dur = opts.duration;
    const bus = ctx.createGain();

    let norm = 0;
    for (let n = 1; n <= opts.partials; n++) norm += 1 / Math.pow(n, opts.rolloff);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = opts.vibratoHz;

    for (let n = 1; n <= opts.partials; n++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueCurveAtTime(scaled(curve, n), start, TONE_DURATION);

      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, start);
      depth.gain.linearRampToValueAtTime(hz * n * (Math.pow(2, opts.vibratoSt / 12) - 1), start + 0.18);
      lfo.connect(depth); depth.connect(osc.frequency);

      const amp = (1 / Math.pow(n, opts.rolloff)) / norm * opts.gain;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(amp, start + opts.attack);
      env.gain.setValueAtTime(amp, start + dur - opts.release);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(env); env.connect(bus);
      osc.start(start); osc.stop(start + dur + 0.02);
    }
    lfo.start(start); lfo.stop(start + dur + 0.02);

    // Breath. A flute without it is a sine wave; with it, it is a flute.
    if (opts.breath) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, dur + 0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = hz * opts.breathHz;
      bp.Q.value = 0.9;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(opts.breath, start + opts.attack);
      env.gain.setValueAtTime(opts.breath, start + dur - opts.release);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(bp); bp.connect(env); env.connect(bus);
      src.start(start); src.stop(start + dur + 0.02);
    }
    return bus;
  }


  // --- HUM ---------------------------------------------------------------
  // An imitation of the actual speaker humming, rebuilt from measurements of
  // them actually humming. The first attempt at this was genuinely terrible and
  // it is worth being precise about why, because all three faults were mine and
  // none were hard to avoid.
  //
  // 1. WRONG SOUND MEASURED. I took the average spectrum of their spoken
  //    syllables - open vowels, mouth open - and called it a hum. A hum is a
  //    nasal murmur: mouth shut, sound out through the nose, a completely
  //    different filter. I then boosted three vowel formants by +6 dB, so what
  //    I built was "an open vowel with a notch in it".
  // 2. THE SOURCE WAS 20 dB TOO BRIGHT. I used 24 harmonics at 1/n. Measured
  //    against a real murmur, that puts about 20 dB too much energy in the
  //    upper harmonics before the formant boosts even applied. A real hum is
  //    dominated by H1 and H2 and is essentially gone by H4.
  // 3. "JITTER" AND "SHIMMER" WERE AUDIO-RATE NOISE. I applied a random walk to
  //    a 160-point curve over 550 ms - a new random value every 3.4 ms, which
  //    is roughly 290 Hz. Random modulation at 290 Hz is not vocal instability,
  //    it is ring modulation: it adds sidebands around every harmonic. I was
  //    adding distortion and calling it humanity. Its magnitude was wrong too -
  //    the random walk settled around 0.7% where a real murmur measures 0.5%.
  //
  // The resource I needed and did not look for: recordings of these speakers
  // producing a nasal. They exist. speaker3/n_high.wav is an ISOLATED SYLLABIC
  // NASAL - a hum, from the actual speaker - and several syllables are
  // nasal-final (un, tan, rin, kan) or nasal-initial (na, ma, mu, nu), whose
  // murmur portions are also real hum. Measuring those needed one more piece of
  // care: for a nasal-INITIAL syllable the murmur is at the START, so taking
  // the tail gets the open vowel instead. Getting that wrong the first time is
  // what produced a "hum" spectrum with more energy in H2 than H1.
  //
  // HARMONICS below are measured amplitudes relative to H1, averaged over ~165
  // murmur frames per speaker and forced monotone (a nasal murmur has no upper
  // peaks; any measured are vowel leakage). speaker2 at 240 Hz: -15 dB by H2,
  // -30 by H3. speaker3 at 125 Hz: -2 by H2, -10 by H3, -25 by H4. Both are
  // almost pure fundamental, which is exactly what a closed mouth does.
  //
  // No formant or notch filters at all now: the measured spectrum IS the
  // filter, so applying another one on top would be shaping it twice.
  const HUM_HARMONICS = {
    speaker2: [1.000, 0.170, 0.032, 0.032, 0.021, 0.015, 0.011, 0.011, 0.011, 0.011, 0.011, 0.011],
    speaker3: [1.000, 0.809, 0.299, 0.056, 0.056, 0.045, 0.032, 0.017, 0.011, 0.009, 0.006, 0.006],
  };
  // Measured median frame-to-frame period perturbation on those murmurs.
  const HUM_JITTER = { speaker2: 0.005, speaker3: 0.006 };

  // Slow, smooth instability - the fix for fault 3. A sum of a few
  // incommensurate slow sinusoids with random phase gives natural-sounding
  // drift with NO energy anywhere near the audio band, which is what vocal
  // instability actually sounds like. Rates are in Hz.
  function wobble(rates, depth, seed) {
    const phases = rates.map((_, i) => (seed * 7.13 + i * 2.39) % (2 * Math.PI));
    return (t) => {
      let v = 0;
      for (let i = 0; i < rates.length; i++) v += Math.sin(2 * Math.PI * rates[i] * t + phases[i]);
      return (v / rates.length) * depth;
    };
  }

  function hum(ctx, tone, speaker, start, opts) {
    const model = TONE_MODEL[speaker][tone];
    const amps = HUM_HARMONICS[speaker] || HUM_HARMONICS.speaker3;
    const jitter = HUM_JITTER[speaker] || 0.005;
    const dur = opts.duration;
    const POINTS = 140;
    const seed = Math.random();

    // Source: the measured harmonic amplitudes, Schroeder phase so the
    // harmonics do not all start aligned and spike.
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    for (let n = 1; n <= amps.length; n++) {
      const ph = -Math.PI * n * n / amps.length;
      real[n] = amps[n - 1] * Math.cos(ph);
      imag[n] = amps[n - 1] * Math.sin(ph);
    }
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));

    // Pitch: the measured contour, plus slow drift at the measured jitter
    // magnitude, plus a gentle vibrato. All of it below 6 Hz.
    const drift = wobble([1.7, 2.9, 4.3], jitter, seed);
    const vib = wobble([opts.vibratoHz], Math.pow(2, opts.vibratoSt / 12) - 1, seed + 0.5);
    const g = model.glide;
    const pitch = new Float32Array(POINTS);
    for (let i = 0; i < POINTS; i++) {
      const t = (i / (POINTS - 1)) * dur;
      const x = Math.min(1, t / TONE_DURATION) * (g.length - 1);
      const lo = Math.floor(x), hi = Math.min(g.length - 1, lo + 1);
      const st = g[lo] + (g[hi] - g[lo]) * (x - lo);
      // vibrato fades in - it is not present at the very start of a note
      const vibDepth = Math.min(1, t / 0.22);
      pitch[i] = model.hz * Math.pow(2, st / 12) * (1 + drift(t) + vib(t) * vibDepth);
    }
    osc.frequency.setValueCurveAtTime(pitch, start, dur);

    // Level: a soft onset - the isolated nasal takes about 100 ms to reach half
    // level - with slow undulation on top, again well below the audio band.
    const swell = wobble([2.3, 3.7], opts.shimmer, seed + 1.5);
    const level = new Float32Array(POINTS);
    for (let i = 0; i < POINTS; i++) {
      const t = (i / (POINTS - 1)) * dur;
      let shape;
      if (t < opts.attack) shape = Math.pow(t / opts.attack, 1.4);
      else if (t > dur - opts.release) shape = Math.max(0, (dur - t) / opts.release);
      else shape = 1;
      level[i] = Math.max(0.0001, opts.gain * shape * (1 + swell(t)));
    }
    const env = ctx.createGain();
    env.gain.setValueCurveAtTime(level, start, dur);

    // Only a gentle lowpass, well above where the measured spectrum has already
    // fallen away. Belt and braces, not shaping.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = opts.lowpassHz;
    lowpass.Q.value = 0.6;

    osc.connect(lowpass); lowpass.connect(env);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    return env;
  }


  // --- VOICE: the actual recording, retuned --------------------------------
  // Not synthesis. This plays the speaker's own recorded nasal murmur, pitch-
  // shifted to the target tone, with the measured contour applied by automating
  // the playback rate.
  //
  // This is what three failed synthetic hums should have told me to do sooner.
  // Every attempt built a static average spectrum and then measured itself
  // against that same average - a circular test that reported a 0.7 dB match
  // while sounding nothing like a person. A voice is a train of glottal pulses
  // in which every cycle differs; averaging 165 frames of one is exactly the
  // operation that throws away what makes it a voice. Worse, one whole round of
  // work went into MINIMISING crest factor, when voiced speech is peaky by
  // nature - I engineered out the pulse character on purpose, chasing a number.
  //
  // The recordings were in R2 the whole time, already fetchable by the game.
  // speaker3/n_high.wav is an isolated syllabic nasal - the speaker humming.
  // speaker2 has no isolated nasal, so this uses the murmur inside un.wav.
  //
  // Both source windows include the REAL onset, not a synthetic fade, because
  // the attack is most of what identifies a sound. Numbers below are measured:
  // naturalHz is the F0 of the steadiest stretch, and from/to are fractions of
  // the file bracketing the usable murmur.
  const HUM_SOURCE = {
    speaker3: { file: 'syllables/speaker3/n_high.wav', naturalHz: 135.5, from: 0.10, to: 0.78 },
    speaker2: { file: 'syllables/speaker2/un.wav',     naturalHz: 230.2, from: 0.16, to: 0.86 },
  };

  // Filled by preloadVoice() before rendering, because the graph builders are
  // synchronous.
  window.__humBuffers = window.__humBuffers || {};

  // Source bytes are handed in rather than fetched. The R2 bucket sends no
  // Access-Control-Allow-Origin, so fetch() + decodeAudioData() is blocked
  // cross-origin - the game gets away with plain `new Audio(url)` playback,
  // which needs no CORS, but reading samples does. render.mjs therefore reads
  // the files in node and passes them in as base64.
  window.preloadVoice = async function (ctx, sources) {
    for (const [file, b64] of Object.entries(sources || {})) {
      if (window.__humBuffers[file]) continue;
      const raw = atob(b64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      window.__humBuffers[file] = await ctx.decodeAudioData(bytes.buffer);
    }
    return Object.keys(window.__humBuffers);
  };

  function voice(ctx, tone, speaker, start, opts) {
    const spec = HUM_SOURCE[speaker];
    const buffer = spec && window.__humBuffers[spec.file];
    if (!buffer) return ctx.createGain();          // no source: silent, not broken

    const model = TONE_MODEL[speaker][tone];
    const offset = spec.from * buffer.duration;
    const span = (spec.to - spec.from) * buffer.duration;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Pitch shift AND contour in one automation: playbackRate is the ratio of
    // target pitch to the recording's own pitch, followed along the measured
    // glide. Formants shift with it, which for these shifts (all within about
    // three semitones) reads as natural rather than as a chipmunk.
    const rates = new Float32Array(model.glide.length);
    for (let i = 0; i < model.glide.length; i++) {
      rates[i] = (model.hz * Math.pow(2, model.glide[i] / 12)) / spec.naturalHz;
    }
    const meanRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    const realDur = span / meanRate;
    src.playbackRate.setValueCurveAtTime(rates, start, realDur);

    // Only a short fade in - the recording's own attack is inside the window -
    // and a longer one out, where the window cuts mid-murmur.
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(opts.gain, start + 0.012);
    env.gain.setValueAtTime(opts.gain, start + realDur - opts.release);
    env.gain.exponentialRampToValueAtTime(0.0001, start + realDur);

    src.connect(env);
    src.start(start, offset, span);
    return env;
  }

  window.INSTRUMENTS = {
    piano: {
      duration: 0.95,
      note: 'struck string: 3 ms attack, stretched partials, hammer thump, highs die first',
      build: (ctx, t, s, at) => struck(ctx, t, s, at, {
        partials: 16, rolloff: 1.0, falloff: 0.55, decay: 0.85, attack: 0.004,
        stretch: 0.00028, gain: 0.5,
        transient: { length: 0.02, gain: 0.05, hz: 2600, type: 'lowpass' },
      }),
    },
    pluck: {
      duration: 0.85,
      note: 'plucked string: 2 ms attack, brighter and faster-decaying than the piano, pick noise',
      build: (ctx, t, s, at) => struck(ctx, t, s, at, {
        partials: 20, rolloff: 0.85, falloff: 0.85, decay: 0.6, attack: 0.002,
        stretch: 0.00008, gain: 0.45,
        transient: { length: 0.012, gain: 0.045, hz: 2800, type: 'bandpass', q: 0.8 },
      }),
    },
    marimba: {
      duration: 0.6,
      note: 'struck wooden bar: real bar modes at 1 : 3.93 : 9.54, very fast decay',
      build: (ctx, t, s, at) => modal(ctx, t, s, at, {
        modes: [[1, 1, 0.5], [3.932, 0.3, 0.16], [9.538, 0.09, 0.07]],
        attack: 0.002, gain: 0.42,
        transient: { length: 0.008, gain: 0.04, hz: 3200, type: 'bandpass', q: 0.7 },
      }),
    },
    bell: {
      duration: 1.2,
      note: 'FM bell: inharmonic 3.5 ratio, modulation decaying so it starts complex and settles',
      build: (ctx, t, s, at) => fm(ctx, t, s, at, {
        ratio: 3.5, index: 5.5, indexDecay: 0.32, attack: 0.004, decay: 1.05, gain: 0.34,
      }),
    },
    flute: {
      duration: 0.52,
      note: 'blown: slow attack, few partials, breath noise. Sustained, so the contour stays audible',
      build: (ctx, t, s, at) => sustained(ctx, t, s, at, {
        duration: 0.52, partials: 4, rolloff: 2.2, attack: 0.07, release: 0.1,
        vibratoHz: 5.0, vibratoSt: 0.12, gain: 0.4, breath: 0.03, breathHz: 2.4,
      }),
    },
    voice: {
      duration: 0.75,
      note: "NOT synthesis - the speaker's own recorded nasal murmur, pitch-shifted to each tone with the measured contour applied to the playback rate",
      build: (ctx, t, s, at) => voice(ctx, t, s, at, { gain: 0.85, release: 0.09 }),
    },
    hum: {
      duration: 0.62,
      note: "the speaker humming: harmonic levels measured from their own nasal murmurs, soft 90 ms onset, drift and vibrato all below 6 Hz",
      build: (ctx, t, s, at) => hum(ctx, t, s, at, {
        duration: 0.62, attack: 0.09, release: 0.13,
        vibratoHz: 4.6, vibratoSt: 0.11, shimmer: 0.045,
        lowpassHz: 2200, gain: 0.5,
      }),
    },
    bowed: {
      duration: 0.55,
      note: 'bowed string: slow attack, rich sustained spectrum, vibrato. Contour fully audible',
      build: (ctx, t, s, at) => sustained(ctx, t, s, at, {
        duration: 0.55, partials: 14, rolloff: 1.3, attack: 0.09, release: 0.09,
        vibratoHz: 5.5, vibratoSt: 0.14, gain: 0.34, breath: 0.012, breathHz: 3.5,
      }),
    },
  };
})();
