// Sound effects: punches, gore foley, kiai shouts (formant synthesis), arcade UI
// blips, super-move FX and the speech-synth announcer. Music lives in music.js.
import { ac, getBus, noiseBuffer, isMuted } from './core.js';
export { unlockAudio, setMuted, isMuted } from './core.js';

const M = () => getBus().sfx;
const SHAPER = (() => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 1023) * 2 - 1) * 3);
  return curve;
})();

// ------------------------------------------------------------ primitives

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type, f0, f1, dur, vol = 0.3, delay = 0, dest = null) {
  const c = ac();
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g).connect(dest || M());
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst(dur, filterType, freq, vol, { q = 1, sweepTo = null, at = null, dest = null } = {}) {
  const c = ac();
  const t = at ?? c.currentTime;
  const s = c.createBufferSource();
  s.buffer = noiseBuffer();
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  env(g, t, 0.003, vol, dur);
  s.connect(f).connect(g).connect(dest || M());
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}

// Taiko: pitched thump + skin noise.
function taiko(t, vol = 1, pitch = 1, dest = null) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.35);
  env(g, t, 0.004, 0.9 * vol, 0.7);
  o.connect(g).connect(dest || M());
  o.start(t);
  o.stop(t + 0.8);
  burst(0.12, 'lowpass', 700, 0.5 * vol, { at: t, dest });
}

// "Ka" – rim click on the taiko.
function ka(t, vol = 1, dest = null) {
  burst(0.04, 'bandpass', 2600, 0.5 * vol, { q: 4, at: t, dest });
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 950;
  env(g, t, 0.001, 0.08 * vol, 0.03);
  o.connect(g).connect(dest || M());
  o.start(t); o.stop(t + 0.05);
}

// Koto: plucked string with a little upward bend and fast decay.
function koto(freq, t, vol = 0.3, dur = 1.4, dest = null) {
  const c = ac();
  const out = c.createGain();
  env(out, t, 0.003, vol, dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4200, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + dur * 0.6);
  lp.connect(out).connect(dest || M());
  for (const [mult, type, v] of [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.18], [4.02, 'sine', 0.08]]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq * mult * 0.985, t);
    o.frequency.exponentialRampToValueAtTime(freq * mult, t + 0.04);
    g.gain.value = v;
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  burst(0.02, 'highpass', 3000, vol * 0.5, { at: t, dest });
}

// Temple gong: inharmonic partials with a long tail.
function gong(t, vol = 0.8) {
  const c = ac();
  const base = 82;
  for (const [m, v, d] of [[1, 1, 4], [1.48, 0.6, 3.2], [2.13, 0.5, 2.6], [2.66, 0.35, 2.2], [3.3, 0.25, 1.6], [4.1, 0.15, 1.2]]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(base * m * 1.01, t);
    o.frequency.exponentialRampToValueAtTime(base * m, t + 0.5);
    env(g, t, 0.01, vol * v * 0.4, d);
    o.connect(g).connect(M());
    o.start(t);
    o.stop(t + d + 0.1);
  }
  burst(0.3, 'bandpass', 1200, vol * 0.3, { q: 0.8, at: t });
}

// Rin (temple bowl) – bright bell for a correct answer.
function rin(t, vol = 0.25) {
  const c = ac();
  for (const [m, v, d] of [[1, 1, 1.2], [2.76, 0.45, 0.8], [5.4, 0.2, 0.5]]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 1320 * m;
    env(g, t, 0.002, vol * v, d);
    o.connect(g).connect(M());
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

// ------------------------------------------------------------ gore foley

// One tiny noise grain (a few ms) – the building block of cracks and rips.
function grain(t, dur, freq, vol, type = 'highpass', q = 0.7) {
  const c = ac();
  const s = c.createBufferSource();
  s.buffer = noiseBuffer();
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(M());
  s.start(t, Math.random() * 1.8);
  s.stop(t + dur + 0.01);
}

// Wet flesh impact: resonant filter sweeping down + bubbly blips + low thud.
function squelch(t, vol) {
  burst(0.2, 'bandpass', 1600 + Math.random() * 600, vol * 0.9, { q: 7, sweepTo: 220, at: t });
  burst(0.12, 'lowpass', 420, vol * 0.8, { at: t + 0.005 });
  const c = ac();
  for (let i = 0; i < 4; i++) {
    const tt = t + 0.02 + i * 0.025 + Math.random() * 0.02;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(500 + Math.random() * 700, tt);
    o.frequency.exponentialRampToValueAtTime(120, tt + 0.04);
    env(g, tt, 0.002, vol * 0.22, 0.05);
    o.connect(g).connect(M());
    o.start(tt);
    o.stop(tt + 0.07);
  }
}

// Bone crack: a sharp snap followed by a splintering cluster of clicks.
function crack(t, vol) {
  grain(t, 0.025, 1800, vol * 1.4);
  grain(t, 0.012, 4500, vol * 1.0, 'bandpass', 2);
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(2200, t);
  o.frequency.exponentialRampToValueAtTime(300, t + 0.02);
  env(g, t, 0.001, vol * 0.18, 0.025);
  o.connect(g).connect(M());
  o.start(t); o.stop(t + 0.04);
  let tt = t + 0.008;
  const n = 7 + Math.floor(Math.random() * 7);
  for (let i = 0; i < n; i++) {
    grain(tt, 0.004 + Math.random() * 0.012, 1200 + Math.random() * 3000, vol * (0.9 - (i / n) * 0.6), i % 3 ? 'highpass' : 'bandpass', 3);
    tt += 0.004 + Math.random() * 0.016;
  }
  tone('sine', 140, 38, 0.2, vol * 0.7);
}

// Skin tearing: dense crackle whose filter rises, like ripping wet fabric.
function tear(t, vol) {
  const dur = 0.22 + Math.random() * 0.1;
  const n = 45;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const tt = t + u * dur + Math.random() * 0.004;
    grain(tt, 0.003 + Math.random() * 0.006, 700 + u * 2800 + Math.random() * 500, vol * (0.35 + Math.sin(u * Math.PI) * 0.6), 'bandpass', 4);
  }
  burst(dur, 'bandpass', 900, vol * 0.35, { q: 3, sweepTo: 3200, at: t });
}

let lastPlip = 0;
function plip(t, vol) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  const f = 900 + Math.random() * 900;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.35, t + 0.035);
  env(g, t, 0.001, vol, 0.05);
  o.connect(g).connect(M());
  o.start(t); o.stop(t + 0.07);
  grain(t, 0.01, 2500, vol * 0.5);
}

// ------------------------------------------------------------ voices (formant synthesis)

const VOWELS = {
  a: [800, 1200, 2700],
  i: [300, 2250, 3000],
  u: [360, 1100, 2500],
  e: [480, 1850, 2600],
  o: [480, 820, 2600],
};

const SHOUTS = {
  ha: [{ c: 'h', v: 'a', d: 0.15, p: [1.1, 1.3, 1.05] }],
  hai: [{ c: 'h', v: 'a', v2: 'i', d: 0.27, p: [1.05, 1.35, 0.95] }],
  ya: [{ c: 'y', v: 'a', d: 0.25, p: [1.1, 1.4, 1.0] }],
  toh: [{ c: 't', v: 'o', d: 0.26, p: [1.1, 1.35, 0.9] }],
  ei: [{ v: 'e', v2: 'i', d: 0.2, p: [1.1, 1.3, 1.0] }],
  seiya: [
    { c: 's', v: 'e', v2: 'i', d: 0.13, p: [1.0, 1.15, 1.1], join: true },
    { c: 'y', v: 'a', d: 0.3, p: [1.2, 1.5, 1.0] },
  ],
  hooah: [
    { c: 'h', v: 'o', d: 0.17, p: [0.95, 1.05, 1.1], join: true },
    { v: 'a', d: 0.45, p: [1.25, 1.55, 1.05] },
  ],
  yosh: [{ c: 'y', v: 'o', d: 0.2, p: [1.05, 1.3, 1.2], tail: 's' }],
  ugh: [{ v: 'u', d: 0.14, p: [0.95, 0.9, 0.7], vol: 0.7 }],
  gah: [{ c: 'k', v: 'a', d: 0.17, p: [1.05, 1.0, 0.75], vol: 0.8 }],
  oof: [{ c: 'h', v: 'u', d: 0.15, p: [1.0, 0.92, 0.75], vol: 0.75 }],
  scream: [{ v: 'a', v2: 'o', d: 1.0, p: [1.35, 1.3, 0.65] }],
  groan: [{ v: 'u', v2: 'o', d: 0.9, p: [0.85, 0.8, 0.55], vol: 0.8 }],
  cutoff: [{ v: 'a', d: 0.22, p: [1.4, 1.45, 1.3] }],
};

const DEFAULT_VOICE = { pitch: 190, formant: 1 };

function shout(name, voice = DEFAULT_VOICE, { delay = 0, vol = 1 } = {}) {
  if (isMuted()) return;
  const segs = SHOUTS[name];
  const c = ac();
  const t0 = c.currentTime + delay;
  const P = voice.pitch * (0.97 + Math.random() * 0.06);
  const fm = (v, i) => VOWELS[v][i] * voice.formant;

  const out = c.createGain();
  out.gain.value = 3.2 * vol;
  const ws = c.createWaveShaper();
  ws.curve = SHAPER;
  out.connect(ws).connect(M());

  const src = c.createOscillator();
  src.type = 'sawtooth';
  const vib = c.createOscillator();
  const vibG = c.createGain();
  vib.frequency.value = 6 + Math.random() * 3;
  vibG.gain.value = P * 0.035;
  vib.connect(vibG).connect(src.frequency);
  const vg = c.createGain();
  vg.gain.setValueAtTime(0, t0);
  src.connect(vg);

  const nz = c.createBufferSource();
  nz.buffer = noiseBuffer();
  nz.loop = true;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0, t0);
  nz.connect(ng);

  const bank = [0, 1, 2].map((i) => {
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = [5, 8, 11][i];
    f.frequency.setValueAtTime(fm(segs[0].v, i), t0);
    const g = c.createGain();
    g.gain.value = [1, 0.6, 0.3][i];
    vg.connect(f);
    ng.connect(f);
    f.connect(g).connect(out);
    return f;
  });

  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3800;
  const hg = c.createGain();
  hg.gain.setValueAtTime(0, t0);
  nz.connect(hp).connect(hg).connect(out);

  let t = t0;
  let lastV = 0;
  src.frequency.setValueAtTime(P, t0);
  for (const s of segs) {
    if (s.c === 'h') {
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(0.8, t + 0.03);
      ng.gain.linearRampToValueAtTime(0, t + 0.09);
      t += 0.05;
    } else if (s.c === 't' || s.c === 'k') {
      hp.frequency.setValueAtTime(s.c === 't' ? 3800 : 1800, t);
      hg.gain.setValueAtTime(0.7, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      t += 0.03;
    } else if (s.c === 's') {
      hg.gain.setValueAtTime(0, t);
      hg.gain.linearRampToValueAtTime(0.35, t + 0.03);
      hg.gain.linearRampToValueAtTime(0, t + 0.1);
      t += 0.09;
    }
    const startV = s.c === 'y' ? 'i' : s.v;
    bank.forEach((f, i) => f.frequency.setValueAtTime(fm(startV, i), t));
    if (s.c === 'y') bank.forEach((f, i) => f.frequency.linearRampToValueAtTime(fm(s.v, i), t + 0.07));
    if (s.v2) {
      bank.forEach((f, i) => {
        f.frequency.setValueAtTime(fm(s.v, i), t + s.d * 0.45);
        f.frequency.linearRampToValueAtTime(fm(s.v2, i), t + s.d * 0.9);
      });
    }
    src.frequency.setValueAtTime(P * s.p[0], t);
    src.frequency.linearRampToValueAtTime(P * s.p[1], t + s.d * 0.3);
    src.frequency.linearRampToValueAtTime(P * s.p[2], t + s.d);

    const v = s.vol ?? 1;
    vg.gain.setValueAtTime(lastV, t);
    vg.gain.linearRampToValueAtTime(v, t + 0.025);
    vg.gain.setValueAtTime(v, t + s.d - 0.07);
    lastV = s.join ? 0.4 : 0;
    vg.gain.linearRampToValueAtTime(lastV, t + s.d);
    t += s.d;
    if (s.tail === 's') {
      hg.gain.setValueAtTime(0, t - 0.03);
      hg.gain.linearRampToValueAtTime(0.35, t);
      hg.gain.linearRampToValueAtTime(0, t + 0.14);
      t += 0.14;
    }
  }
  for (const n of [src, vib, nz]) { n.start(t0); n.stop(t + 0.1); }
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const MOVE_SHOUTS = {
  jab: ['ha', 'ei'],
  cross: ['hai', 'ya'],
  kick: ['toh', 'seiya'],
  uppercut: ['hooah'],
  combo: ['ha', 'ya', 'toh'],
};

// ------------------------------------------------------------ public sfx

export const sfx = {
  hit(strength = 1) {
    if (isMuted()) return;
    burst(0.1 + 0.08 * strength, 'lowpass', 1500 + 1200 * strength, 0.5 + 0.3 * strength);
    burst(0.05, 'bandpass', 3200, 0.3 * strength, { q: 2 }); // slap
    tone('sine', 170, 45, 0.18 + 0.1 * strength, 0.5 + 0.3 * strength);
  },
  /** Gore layer for a hit. level: 1 arcade, 2 extreme. */
  gore(level, { strength = 1, bone = false, rip = false } = {}) {
    if (isMuted() || !level) return;
    const t = ac().currentTime;
    const v = level === 2 ? 1 : 0.55;
    squelch(t, v * (0.6 + 0.3 * strength));
    if (level === 2 && strength > 1.1) squelch(t + 0.06, v * 0.5);
    if (bone) crack(t + 0.01, v * (0.7 + 0.3 * strength));
    if (rip && level === 2) tear(t + 0.03, v * 0.8);
  },
  boneBreak() {
    if (isMuted()) return;
    const t = ac().currentTime;
    crack(t, 1.2);
    crack(t + 0.07, 0.9);
    squelch(t + 0.03, 1);
    tear(t + 0.1, 0.9);
  },
  plip() {
    if (isMuted()) return;
    const c = ac();
    if (c.currentTime - lastPlip < 0.045) return;
    lastPlip = c.currentTime;
    plip(c.currentTime, 0.06 + Math.random() * 0.06);
  },
  whoosh() { if (!isMuted()) burst(0.18, 'bandpass', 500, 0.25, { q: 2, sweepTo: 2500 }); },
  kiai(voice, move, hitIndex = 0) {
    const list = MOVE_SHOUTS[move] || ['hai'];
    shout(move === 'combo' ? list[hitIndex % list.length] : pick(list), voice);
  },
  grunt(voice) { shout(pick(['ugh', 'gah', 'oof']), voice, { delay: 0.1, vol: 0.8 }); },
  scream(voice) { shout('scream', voice, { delay: 0.08 }); },
  victory(voice) { shout('yosh', voice); },
  correct() { if (!isMuted()) rin(ac().currentTime); },
  wrong() {
    if (isMuted()) return;
    const t = ac().currentTime;
    koto(155.56, t, 0.35, 0.6);
    koto(116.54, t + 0.12, 0.35, 0.9);
  },
  ko() {
    if (isMuted()) return;
    const t = ac().currentTime;
    gong(t + 0.05);
    taiko(t, 1.2, 0.8);
  },
  taiko(vol = 1) { if (!isMuted()) taiko(ac().currentTime, vol); },
  drumroll() {
    if (isMuted()) return;
    const t = ac().currentTime;
    taiko(t, 0.8, 1.05);
    taiko(t + 0.18, 0.6, 1.1);
    taiko(t + 0.3, 1.1, 0.95);
  },
  select() { if (!isMuted()) koto(440, ac().currentTime, 0.3, 0.8); },
  key() { if (!isMuted()) ka(ac().currentTime, 0.35); },

  // ---------------------------------------------------------- finisher gore
  /** One pulse of an arterial spurt. */
  spurt(vol = 0.6) {
    if (isMuted()) return;
    const t = ac().currentTime;
    burst(0.16, 'bandpass', 700 + Math.random() * 400, vol, { q: 3, sweepTo: 2200, at: t });
    burst(0.08, 'lowpass', 500, vol * 0.5, { at: t });
  },
  /** Heavy wet landing. */
  splat(strength = 1) {
    if (isMuted()) return;
    const t = ac().currentTime;
    squelch(t, 0.9 * strength);
    squelch(t + 0.04, 0.6 * strength);
    tone('sine', 90, 30, 0.3, 0.8 * strength);
    burst(0.3, 'lowpass', 1200, 0.6 * strength, { sweepTo: 150, at: t });
  },
  /** Whole-body burst. */
  gibExplode() {
    if (isMuted()) return;
    const t = ac().currentTime;
    tone('sine', 70, 22, 0.8, 1.0);
    burst(0.6, 'lowpass', 3000, 0.9, { sweepTo: 120, at: t });
    for (let i = 0; i < 5; i++) squelch(t + i * 0.05 + Math.random() * 0.03, 0.8);
    for (let i = 0; i < 4; i++) crack(t + 0.02 + i * 0.07, 0.8);
    tear(t + 0.05, 1);
    reverbHit(t, 0.8);
  },
  ripOff() {
    if (isMuted()) return;
    const t = ac().currentTime;
    tear(t, 1.1);
    tear(t + 0.12, 0.9);
    crack(t + 0.1, 1.0);
    squelch(t + 0.15, 1);
  },
  spineCrack() {
    if (isMuted()) return;
    const t = ac().currentTime;
    for (let i = 0; i < 4; i++) crack(t + i * 0.09, 1.1 - i * 0.15);
    squelch(t + 0.2, 0.6);
  },
  thud(strength = 1) {
    if (isMuted()) return;
    tone('sine', 100, 35, 0.25, 0.8 * strength);
    burst(0.18, 'lowpass', 600, 0.6 * strength);
  },
  groan(voice) { shout('groan', voice, { vol: 0.8 }); },
  screamCut(voice) { shout('cutoff', voice); },

  // ---------------------------------------------------------- humiliation
  /** Sad trombone: wah wah wah waaah. */
  humSting() {
    if (isMuted()) return;
    const c = ac();
    const t0 = c.currentTime;
    [[196, 0.32], [185, 0.32], [174.6, 0.32], [164.8, 1.1]].forEach(([f, d], i) => {
      const t = t0 + i * 0.36;
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 6;
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.linearRampToValueAtTime(1400, t + 0.08);
      lp.frequency.linearRampToValueAtTime(500, t + d);
      if (i === 3) {
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = 5;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t); lfo.stop(t + d + 0.1);
      }
      const g = c.createGain();
      env(g, t, 0.03, 0.35, d);
      o.connect(lp).connect(g).connect(M());
      o.start(t); o.stop(t + d + 0.1);
    });
  },
  crowdLaugh() {
    if (isMuted()) return;
    for (let i = 0; i < 16; i++) {
      shout('ha', { pitch: 140 + Math.random() * 200, formant: 0.9 + Math.random() * 0.3 }, { delay: Math.random() * 1.6, vol: 0.35 });
    }
    this.crowd(0.4, 2);
  },
  rumble(dur = 1.4) {
    if (isMuted()) return;
    tone('sine', 42, 30, dur, 0.8);
    tone('sine', 55, 38, dur, 0.4);
    burst(dur, 'lowpass', 220, 0.6);
  },
  stomp() {
    if (isMuted()) return;
    const t = ac().currentTime;
    tone('sine', 70, 22, 1.1, 1.3);
    burst(0.6, 'lowpass', 1800, 0.9, { sweepTo: 100, at: t });
    crack(t, 0.9);
    reverbHit(t, 1);
  },
  whistleFall(dur = 1.6) {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(2600, t);
    o.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.02, t);
    g.gain.linearRampToValueAtTime(0.25, t + dur);
    o.connect(g).connect(M());
    o.start(t); o.stop(t + dur + 0.02);
    burst(dur, 'bandpass', 300, 0.5, { q: 2, sweepTo: 4000, at: t });
  },
  glitch(dur = 1.6) {
    if (isMuted()) return;
    const t0 = ac().currentTime;
    for (let x = 0; x < dur; x += 0.03 + Math.random() * 0.05) {
      tone('square', 100 + Math.random() * 2400, 100 + Math.random() * 2400, 0.03, 0.08, x);
      if (Math.random() < 0.3) burst(0.04, 'highpass', 3000, 0.25, { at: t0 + x });
    }
  },
  blackHole(dur = 2) {
    if (isMuted()) return;
    tone('sawtooth', 320, 35, dur, 0.18);
    tone('sine', 60, 28, dur, 0.6);
    burst(dur, 'bandpass', 200, 0.5, { q: 3, sweepTo: 5000 });
  },
  pop() {
    if (isMuted()) return;
    tone('sine', 300, 1400, 0.08, 0.5);
    burst(0.1, 'highpass', 2000, 0.5);
  },
  note(midi = 72, vol = 0.25) {
    if (isMuted()) return;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    tone('square', f, f, 0.25, vol * 0.5);
    tone('triangle', f * 2, f * 2, 0.4, vol * 0.4);
  },
  /** Korobeiniki (traditional folk tune) – square-wave chiptune. */
  korobeiniki() {
    if (isMuted()) return;
    const q = 0.23;
    const mel = [[76, 2], [71, 1], [72, 1], [74, 2], [72, 1], [71, 1], [69, 2], [69, 1], [72, 1], [76, 2], [74, 1], [72, 1], [71, 3], [72, 1], [74, 2], [76, 2], [72, 2], [69, 2], [69, 3]];
    let t = 0;
    for (const [m, d] of mel) {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      tone('square', f, f, d * q * 0.9, 0.09, t);
      t += d * q;
    }
    for (let i = 0; i < t / (q * 2); i++) {
      const f = [55, 82.4][i % 2] * (i % 4 < 2 ? 1 : 1.19);
      tone('triangle', f, f, q * 1.8, 0.18, i * q * 2);
    }
  },
  lock() { if (!isMuted()) { tone('square', 180, 120, 0.06, 0.12); ka(ac().currentTime, 0.4); } },
  lineClear() {
    if (isMuted()) return;
    [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => this.note(m, 0.3 * (1 - i * 0.05)) || null);
    [60, 64, 67, 72, 76, 79, 84, 88].forEach((m, i) => { const f = 440 * Math.pow(2, (m - 69) / 12); tone('square', f, f, 0.08, 0.1, i * 0.05); });
    burst(0.6, 'highpass', 4000, 0.3, { sweepTo: 9000 });
  },
  splash(vol = 1) {
    if (isMuted()) return;
    const t = ac().currentTime;
    burst(0.6, 'lowpass', 2500, 0.8 * vol, { sweepTo: 250, at: t });
    burst(0.3, 'highpass', 3000, 0.4 * vol, { at: t });
    for (let i = 0; i < 6; i++) plip(t + 0.1 + Math.random() * 0.5, 0.12 * vol);
  },
  sharkTheme(dur = 2) {
    if (isMuted()) return;
    let x = 0;
    let gap = 0.5;
    let i = 0;
    while (x < dur) {
      const f = i % 2 ? 87.3 : 82.4;
      tone('sawtooth', f, f, Math.min(0.3, gap * 0.8), 0.28, x);
      tone('sine', f / 2, f / 2, Math.min(0.3, gap * 0.8), 0.4, x);
      x += gap;
      gap = Math.max(0.11, gap * 0.86);
      i++;
    }
  },
  chomp() {
    if (isMuted()) return;
    const t = ac().currentTime;
    crack(t, 1.2);
    squelch(t + 0.02, 1);
    tone('sine', 130, 40, 0.35, 0.9);
  },
  burp() {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(70, t + 0.6);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const am = c.createGain();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 23;
    lg.gain.value = 0.5;
    am.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    const g = c.createGain();
    env(g, t, 0.03, 0.8, 0.65);
    o.connect(lp).connect(am).connect(g).connect(M());
    o.start(t); o.stop(t + 0.7);
    lfo.start(t); lfo.stop(t + 0.7);
  },
  ufoSiren(dur = 5) {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.frequency.value = 760;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 5.5;
    lg.gain.value = 260;
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.4);
    g.gain.setValueAtTime(0.12, t + dur - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(M());
    o.start(t); o.stop(t + dur);
    lfo.start(t); lfo.stop(t + dur);
    tone('sine', 62, 62, dur, 0.25);
  },
  zap() { if (!isMuted()) { tone('sawtooth', 1600, 180, 0.35, 0.2); burst(0.3, 'bandpass', 2000, 0.3, { q: 3 }); } },
  ufoBang() {
    if (isMuted()) return;
    const t = ac().currentTime;
    tone('sine', 90, 40, 0.25, 0.8);
    burst(0.08, 'bandpass', 2600, 0.6, { q: 5, at: t });
    ka(t, 1);
  },
  zip() { if (!isMuted()) tone('sine', 300, 2600, 0.35, 0.25); },
  thwack() {
    if (isMuted()) return;
    const t = ac().currentTime;
    burst(0.09, 'bandpass', 1300, 1.0, { q: 3, at: t });
    tone('triangle', 320, 140, 0.12, 0.6);
    const c = ac();
    const o = c.createOscillator();
    o.frequency.value = 200;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 14;
    lg.gain.value = 60;
    lfo.connect(lg).connect(o.frequency);
    const g = c.createGain();
    env(g, t + 0.05, 0.01, 0.25, 0.55);
    o.connect(g).connect(M());
    o.start(t); o.stop(t + 0.65);
    lfo.start(t); lfo.stop(t + 0.65);
  },
  schoolBell() {
    if (isMuted()) return;
    const c = ac();
    const t0 = c.currentTime;
    for (let i = 0; i < 26; i++) {
      const t = t0 + i * 0.045;
      for (const [m, v] of [[1, 0.12], [2.76, 0.05]]) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = 1150 * m;
        env(g, t, 0.001, v, 0.12);
        o.connect(g).connect(M());
        o.start(t); o.stop(t + 0.15);
      }
    }
  },
  grind(dur = 2) {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 110;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 17;
    lg.gain.value = 40;
    lfo.connect(lg).connect(o.frequency);
    const ws = c.createWaveShaper();
    ws.curve = SHAPER;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.15);
    g.gain.setValueAtTime(0.12, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(ws).connect(g).connect(M());
    o.start(t); o.stop(t + dur);
    lfo.start(t); lfo.stop(t + dur);
    burst(dur, 'bandpass', 900, 0.35, { q: 2, at: t });
  },
  ding() { if (!isMuted()) rin(ac().currentTime, 0.35); },
  batCrack() {
    if (isMuted()) return;
    const t = ac().currentTime;
    crack(t, 1.4);
    tone('square', 1400, 200, 0.06, 0.4);
    burst(0.12, 'highpass', 2500, 0.8, { at: t });
    reverbHit(t, 0.8);
  },
  twinkle() {
    if (isMuted()) return;
    [2093, 2637, 3136, 4186].forEach((f, i) => tone('sine', f, f, 0.35, 0.18, i * 0.07));
  },

  // ---------------------------------------------------------- arcade extras
  /** Big impact for heavy hits / supers. */
  impact(strength = 1) {
    if (isMuted()) return;
    const t = ac().currentTime;
    tone('sine', 110, 28, 0.5, 0.9 * strength);
    burst(0.35, 'lowpass', 2500, 0.8 * strength, { sweepTo: 200, at: t });
    burst(0.08, 'highpass', 3000, 0.5 * strength, { at: t });
    reverbHit(t, 0.6 * strength);
  },
  /** Announcer-text slam. */
  slam() {
    if (isMuted()) return;
    const t = ac().currentTime;
    tone('sine', 90, 30, 0.45, 0.7);
    burst(0.25, 'lowpass', 1800, 0.5, { sweepTo: 150, at: t });
    reverbHit(t, 0.4);
  },
  whooshBig() { if (!isMuted()) burst(0.35, 'bandpass', 300, 0.45, { q: 1.5, sweepTo: 3500 }); },
  /** Rising charge for a super activation. */
  superCharge() {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    burst(0.9, 'bandpass', 200, 0.5, { q: 3, sweepTo: 6000, at: t });
    for (const [f, d] of [[110, 0], [165, 0.005], [220, 0.01]]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t + d);
      o.frequency.exponentialRampToValueAtTime(f * 4, t + 0.85);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      o.connect(g).connect(M());
      o.start(t); o.stop(t + 1);
    }
    stab(t + 0.85, 1.0);
  },
  /** Orchestra-hit style confirm stab. */
  confirm() { if (!isMuted()) stab(ac().currentTime, 0.7); },
  coin() {
    if (isMuted()) return;
    tone('square', 988, 988, 0.07, 0.12);
    tone('square', 1319, 1319, 0.35, 0.12, 0.07);
  },
  cursor() { if (!isMuted()) tone('square', 880, 1100, 0.04, 0.08); },
  tick() { if (!isMuted()) tone('square', 1500, 1500, 0.03, 0.08); },
  bigTick() {
    if (isMuted()) return;
    tone('square', 660, 660, 0.12, 0.14);
    tone('sine', 120, 60, 0.2, 0.4);
  },
  heartbeat() {
    if (isMuted()) return;
    tone('sine', 70, 40, 0.14, 0.5);
    tone('sine', 65, 38, 0.14, 0.4, 0.18);
  },
  /** Rising blip whose pitch climbs with the combo count. */
  combo(n) {
    if (isMuted()) return;
    const f = 440 * Math.pow(2, Math.min(n, 24) / 12);
    tone('square', f, f, 0.05, 0.07);
    tone('square', f * 1.5, f * 1.5, 0.08, 0.05, 0.04);
  },
  scoreTick() { if (!isMuted()) tone('square', 2000, 2000, 0.015, 0.04); },
  parry() {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    for (const [m, v, d] of [[1, 0.3, 0.6], [2.76, 0.18, 0.4], [5.4, 0.1, 0.25]]) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 1800 * m;
      env(g, t, 0.001, v, d);
      o.connect(g).connect(M());
      o.start(t); o.stop(t + d + 0.05);
    }
    burst(0.05, 'highpass', 5000, 0.4, { at: t });
  },
  crowd(vol = 0.5, dur = 1.6) {
    if (isMuted()) return;
    const c = ac();
    const t = c.currentTime;
    for (let i = 0; i < 6; i++) {
      burst(dur * (0.6 + Math.random() * 0.4), 'bandpass', 700 + Math.random() * 900, vol * 0.35, { q: 1.2, at: t + Math.random() * 0.2 });
    }
  },
  lightning() {
    if (isMuted()) return;
    const t = ac().currentTime;
    crack(t, 0.6);
    burst(1.2, 'lowpass', 1200, 0.5, { sweepTo: 80, at: t + 0.05 });
  },
};

// Orchestra-hit style stab: detuned saw chord + noise with a fast filter drop.
function stab(t, vol) {
  const c = ac();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(6000, t);
  lp.frequency.exponentialRampToValueAtTime(400, t + 0.4);
  const g = c.createGain();
  env(g, t, 0.003, vol * 0.35, 0.55);
  lp.connect(g).connect(M());
  g.connect(getBus().reverbSend);
  for (const f of [130.8, 196, 261.6, 329.6, 392, 523.2]) {
    for (const det of [-8, 8]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.02, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      o.detune.value = det;
      o.connect(lp);
      o.start(t); o.stop(t + 0.6);
    }
  }
  burst(0.2, 'bandpass', 1500, vol * 0.5, { q: 0.8, at: t });
}

function reverbHit(t, vol) {
  burst(0.3, 'lowpass', 1500, vol, { at: t, dest: getBus().reverbSend });
}


// ------------------------------------------------------------ announcer

let jaVoice = null;
function findVoices() {
  if (!window.speechSynthesis) return;
  jaVoice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('ja')) || null;
}
if (window.speechSynthesis) {
  findVoices();
  speechSynthesis.addEventListener?.('voiceschanged', findVoices);
}

export function say(text, { rate = 0.95, pitch = 0.6, ja = null } = {}) {
  if (isMuted() || !window.speechSynthesis) return;
  speechSynthesis.cancel();
  let u;
  if (ja && jaVoice) {
    u = new SpeechSynthesisUtterance(ja);
    u.voice = jaVoice;
    u.lang = jaVoice.lang;
  } else {
    u = new SpeechSynthesisUtterance(text);
  }
  u.rate = rate;
  u.pitch = pitch;
  u.volume = 1;
  speechSynthesis.speak(u);
}

