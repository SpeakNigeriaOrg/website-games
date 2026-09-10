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
  // An imitation of the actual speaker humming, and arguably the most apt voice
  // here: the game teaches speech tone, so the closest model for what the
  // learner should produce is the speaker's own voice.
  //
  // The resonance frequencies below are MEASURED from each speaker's own
  // recordings - the long-term average spectrum of every syllable clip they
  // recorded (80 files for speaker2, 78 for speaker3), peaks picked from the
  // smoothed envelope. So the vowel colour here is theirs, not a generic vowel.
  //
  // Measuring that also settled a question worth recording: the real recordings
  // are DARK. Speaker3's average energy from 1-2 kHz sits 37 dB below his peak,
  // and speaker2's 25 dB below hers. Almost everything is in the bottom two
  // octaves. So the original six-harmonic tone was not far off these speakers'
  // actual spectral balance, and chasing brightness was largely chasing the
  // wrong thing. What a real voice has that a synthetic one does not is not
  // treble - it is jitter, shimmer and a soft onset.
  //
  // Hence: jitter (cycle-to-cycle pitch instability, a random walk of a few
  // tenths of a percent) and shimmer (the same on amplitude), both baked into
  // the automation curves. Perfectly steady pitch is the single most synthetic
  // thing about a synthesised voice, and no amount of filtering hides it.
  const VOICE_FORMANTS = {
    // [hz, gain dB relative to the strongest, Q]
    speaker2: [[345, 0, 1.6], [560, -5.6, 1.9], [818, -9.4, 2.1], [2799, -17.4, 3.0]],
    speaker3: [[297, 0, 1.5], [1047, -23.9, 2.2], [1234, -25.0, 2.6]],
  };

  // The measured 7-9 point contour, resampled fine enough to carry jitter, with
  // a small random walk added. One curve, so it composes with nothing else.
  function jitteredCurve(tone, speaker, points, jitter) {
    const model = TONE_MODEL[speaker][tone];
    const g = model.glide;
    const out = new Float32Array(points);
    let walk = 0;
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * (g.length - 1);
      const lo = Math.floor(x), hi = Math.min(g.length - 1, lo + 1);
      const st = g[lo] + (g[hi] - g[lo]) * (x - lo);
      walk = walk * 0.86 + (Math.random() * 2 - 1) * jitter;
      out[i] = model.hz * Math.pow(2, st / 12) * (1 + walk);
    }
    return out;
  }

  function shimmerCurve(points, peak, attack, release, duration, depth) {
    const out = new Float32Array(points);
    let walk = 0;
    for (let i = 0; i < points; i++) {
      const t = (i / (points - 1)) * duration;
      let shape;
      if (t < attack) shape = t / attack;
      else if (t > duration - release) shape = Math.max(0, (duration - t) / release);
      else shape = 1;
      walk = walk * 0.9 + (Math.random() * 2 - 1) * depth;
      out[i] = Math.max(0.0001, peak * shape * (1 + walk));
    }
    return out;
  }

  function hum(ctx, tone, speaker, start, opts) {
    const formants = VOICE_FORMANTS[speaker] || VOICE_FORMANTS.speaker3;
    const POINTS = 160;

    // Glottal-ish source: a full harmonic series at 1/n, Schroeder phase so the
    // harmonics do not all start aligned and spike. The formant filters below,
    // not the source, are what give this its colour - that is the source-filter
    // model a voice actually works by.
    const real = new Float32Array(opts.harmonics + 1);
    const imag = new Float32Array(opts.harmonics + 1);
    for (let n = 1; n <= opts.harmonics; n++) {
      const a = 1 / Math.pow(n, 1.0);
      const ph = -Math.PI * n * n / opts.harmonics;
      real[n] = a * Math.cos(ph);
      imag[n] = a * Math.sin(ph);
    }
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
    osc.frequency.setValueCurveAtTime(jitteredCurve(tone, speaker, POINTS, opts.jitter), start, opts.duration);

    let node = osc;
    formants.forEach(([hz, gain, q]) => {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = hz;
      f.Q.value = q;
      f.gain.value = opts.formantGain + gain * 0.5; // measured shape, gentler than measured depth
      node.connect(f);
      node = f;
    });

    // Mouth closed: a hum has a nasal anti-resonance where an open vowel has
    // energy, and very little above about 1.5 kHz.
    const notch = ctx.createBiquadFilter();
    notch.type = 'notch';
    notch.frequency.value = opts.notchHz;
    notch.Q.value = 1.1;
    node.connect(notch);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = opts.lowpassHz;
    lowpass.Q.value = 0.6;
    notch.connect(lowpass);

    const env = ctx.createGain();
    env.gain.setValueCurveAtTime(
      shimmerCurve(POINTS, opts.gain, opts.attack, opts.release, opts.duration, opts.shimmer),
      start, opts.duration);
    lowpass.connect(env);

    osc.start(start);
    osc.stop(start + opts.duration + 0.02);
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
    hum: {
      duration: 0.55,
      note: "the speaker humming: their OWN measured formants, plus jitter and shimmer. Contour fully audible",
      build: (ctx, t, s, at) => hum(ctx, t, s, at, {
        duration: 0.55, harmonics: 24, attack: 0.055, release: 0.09,
        jitter: 0.0035, shimmer: 0.05, formantGain: 6, notchHz: 1250,
        lowpassHz: 1700, gain: 0.34,
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
