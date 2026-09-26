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

