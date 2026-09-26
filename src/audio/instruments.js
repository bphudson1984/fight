// Synthesised General-MIDI-ish instrument set (pure WebAudio, no samples).
// Every instrument has the signature
//   fn(ctx, out, rev, time, freq, dur, vel, opts) -> endTime
// so the same code renders live or inside an OfflineAudioContext.
// `rev` is an optional reverb-send node (may be null).
import { noiseBuffer } from './core.js';

// ------------------------------------------------------------ helpers

const curveCache = new WeakMap();
function distCurve(c) {
  let curve = curveCache.get(c);
  if (!curve) {
    curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 12) * 0.9;
    }
    curveCache.set(c, curve);
  }
  return curve;
}

function osc(c, type, freq, t, detune = 0) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  return o;
}

const nyq = (c, f) => Math.min(f, c.sampleRate * 0.45);

function filt(c, type, f, q = 0.7) {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = nyq(c, f);
  b.Q.value = q;
  return b;
}

function noiseSrc(c) {
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c);
  s.loop = true;
  return s;
}

/** ADSR gain node; `.end` is when the voice can be stopped. */
function env(c, t, dur, { a = 0.005, d = 0.1, s = 0.7, r = 0.1, peak = 1 } = {}) {
  const g = c.createGain();
  const p = g.gain;
  const off = t + Math.max(dur, a + 0.002);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(peak * s, t + a, Math.max(0.002, d / 3));
  p.setTargetAtTime(0, off, Math.max(0.002, r / 4));
  g.end = off + r * 1.6 + 0.02;
  return g;
}

/** Percussive exponential decay. */
function perc(c, t, peak, decay) {
  const g = c.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, peak), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.end = t + decay + 0.02;
  return g;
}

/** Delayed vibrato (cents) applied to a set of oscillators. */
function vibrato(c, t, end, oscs, { rate = 5.5, depth = 18, delay = 0.18 } = {}) {
  if (end - t < delay + 0.05) return;
  const l = c.createOscillator();
  l.frequency.value = rate;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setValueAtTime(0, t + delay);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.25);
  l.connect(g);
  for (const o of oscs) g.connect(o.detune);
  l.start(t);
  l.stop(end);
}

function send(node, out, rev, amt = 0) {
  node.connect(out);
  if (rev && amt > 0) {
    const s = node.context.createGain();
    s.gain.value = amt;
    node.connect(s).connect(rev);
  }
}

function startStop(nodes, t, end) {
  for (const n of nodes) { n.start(t); n.stop(end); }
}

// ------------------------------------------------------------ drums

function kick(c, out, rev, t, f, dur, v) {
  const o = osc(c, 'sine', 170, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
  const g = perc(c, t, v * 1.1, 0.4);
  o.connect(g).connect(out);
  // beater click
  const n = noiseSrc(c);
  const hp = filt(c, 'highpass', 2800);
  const ng = perc(c, t, v * 0.4, 0.018);
  n.connect(hp).connect(ng).connect(out);
  n.start(t, Math.random()); n.stop(t + 0.04);
  o.start(t); o.stop(g.end);
  return g.end;
}

function snare(c, out, rev, t, f, dur, v) {
  const o = osc(c, 'triangle', 230, t);
  o.frequency.exponentialRampToValueAtTime(165, t + 0.07);
  const og = perc(c, t, v * 0.55, 0.11);
  o.connect(og).connect(out);
  const n = noiseSrc(c);
  const hp = filt(c, 'highpass', 1300);
  const ng = perc(c, t, v * 0.5, 0.17);
  n.connect(hp).connect(ng).connect(out);
  // gated-reverb tail: held noise that cuts hard (the 80s/90s "gated snare")
  const bp = filt(c, 'bandpass', 2600, 0.5);
  const gg = c.createGain();
  gg.gain.setValueAtTime(v * 0.28, t);
  gg.gain.linearRampToValueAtTime(v * 0.2, t + 0.19);
  gg.gain.linearRampToValueAtTime(0, t + 0.23);
  n.connect(bp).connect(gg);
  send(gg, out, rev, 1.2);
  startStop([o], t, t + 0.14);
  n.start(t, Math.random()); n.stop(t + 0.26);
  return t + 0.26;
}

function clap(c, out, rev, t, f, dur, v) {
  const n = noiseSrc(c);
  const bp = filt(c, 'bandpass', 1150, 1.6);
  const g = c.createGain();
  const p = g.gain;
  p.setValueAtTime(0, t);
  for (const dt of [0, 0.011, 0.022]) {
    p.setValueAtTime(v * 0.8, t + dt);
    p.exponentialRampToValueAtTime(v * 0.1, t + dt + 0.009);
  }
  p.setValueAtTime(v * 0.6, t + 0.031);
  p.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(bp).connect(g);
  send(g, out, rev, 0.6);
  n.start(t, Math.random()); n.stop(t + 0.22);
  return t + 0.22;
}

function hat(c, out, rev, t, v, decay) {
  const n = noiseSrc(c);
  const hp = filt(c, 'highpass', 7200);
  const pk = filt(c, 'peaking', 10000, 1);
  pk.gain.value = 6;
  const g = perc(c, t, v * 0.5, decay);
  n.connect(hp).connect(pk).connect(g).connect(out);
  n.start(t, Math.random()); n.stop(g.end);
  return g.end;
}
const hatC = (c, out, rev, t, f, d, v) => hat(c, out, rev, t, v, 0.04);
const hatO = (c, out, rev, t, f, d, v) => hat(c, out, rev, t, v * 0.9, 0.3);

function crash(c, out, rev, t, f, dur, v) {
  const n = noiseSrc(c);
  const hp = filt(c, 'highpass', 4200);
  const g = perc(c, t, v * 0.4, 1.7);
  n.connect(hp).connect(g);
  send(g, out, rev, 0.5);
  n.start(t, Math.random()); n.stop(g.end);
  return g.end;
}

function ride(c, out, rev, t, f, dur, v) {
  const n = noiseSrc(c);
  const bp = filt(c, 'bandpass', 8000, 2);
  const g = perc(c, t, v * 0.3, 0.35);
  const o = osc(c, 'square', 1240, t);
  const og = perc(c, t, v * 0.03, 0.3);
  o.connect(og).connect(out);
  n.connect(bp).connect(g).connect(out);
  n.start(t, Math.random()); n.stop(g.end);
  o.start(t); o.stop(g.end);
  return g.end;
}

function cowbell(c, out, rev, t, f, dur, v) {
  const bp = filt(c, 'bandpass', 2640, 2.5);
  const g = perc(c, t, v * 0.45, 0.25);
  const a = osc(c, 'square', 540, t);
  const b = osc(c, 'square', 800, t);
  a.connect(bp); b.connect(bp);
  bp.connect(g).connect(out);
  startStop([a, b], t, g.end);
  return g.end;
}

function tom(pitch) {
  return (c, out, rev, t, f, dur, v) => {
    const o = osc(c, 'sine', pitch * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(pitch, t + 0.08);
    const g = perc(c, t, v * 0.9, 0.35);
    o.connect(g);
    send(g, out, rev, 0.3);
    const n = noiseSrc(c);
    const lp = filt(c, 'lowpass', 1500);
    const ng = perc(c, t, v * 0.2, 0.05);
    n.connect(lp).connect(ng).connect(out);
    n.start(t, Math.random()); n.stop(t + 0.07);
    o.start(t); o.stop(g.end);
    return g.end;
  };
}

// Big taiko / timpani-ish hit
function taiko(c, out, rev, t, f, dur, v) {
  const o = osc(c, 'sine', 120, t);
  o.frequency.exponentialRampToValueAtTime(52, t + 0.3);
  const g = perc(c, t, v * 1.0, 0.65);
  o.connect(g);
  send(g, out, rev, 0.5);
  const n = noiseSrc(c);
  const lp = filt(c, 'lowpass', 600);
  const ng = perc(c, t, v * 0.5, 0.12);
  n.connect(lp).connect(ng).connect(out);
  n.start(t, Math.random()); n.stop(t + 0.14);
  o.start(t); o.stop(g.end);
  return g.end;
}

export const DRUMS = {
  k: kick, s: snare, c: clap, h: hatC, o: hatO, x: crash, r: ride, b: cowbell,
  t1: tom(210), t2: tom(150), t3: tom(100), T: taiko,
};

// ------------------------------------------------------------ bass

// DX7-style FM slap bass: bright attack that mellows out.
function fmBass(c, out, rev, t, f, dur, v) {
  const e = env(c, t, dur, { a: 0.003, d: 0.25, s: 0.55, r: 0.06, peak: v * 0.9 });
  const car = osc(c, 'sine', f, t);
  const mod = osc(c, 'sine', f, t);
  const mg = c.createGain();
  mg.gain.setValueAtTime(f * 5.5, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.7, t + 0.14);
  mod.connect(mg).connect(car.frequency);
  const sub = osc(c, 'triangle', f, t);
  const sg = c.createGain();
  sg.gain.value = 0.5;
  sub.connect(sg).connect(e);
  car.connect(e);
  send(e, out, rev, 0.05);
  startStop([car, mod, sub], t, e.end);
  return e.end;
}

// Resonant saw bass.
function sawBass(c, out, rev, t, f, dur, v) {
  const e = env(c, t, dur, { a: 0.004, d: 0.18, s: 0.6, r: 0.05, peak: v * 0.55 });
  const a = osc(c, 'sawtooth', f, t);
  const b = osc(c, 'sawtooth', f, t, 9);
  const lp = filt(c, 'lowpass', Math.min(8000, f * 3), 7);
  lp.frequency.setValueAtTime(nyq(c, Math.min(8000, f * 14)), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(120, f * 2.5), t + 0.16);
  a.connect(lp); b.connect(lp);
  lp.connect(e);
  const sub = osc(c, 'sine', f, t);
  const sg = c.createGain();
  sg.gain.value = 0.6;
  sub.connect(sg).connect(e);
  send(e, out, rev, 0.03);
  startStop([a, b, sub], t, e.end);
  return e.end;
}

// ------------------------------------------------------------ leads

function square(c, out, rev, t, f, dur, v, o = {}) {
  const e = env(c, t, dur, { a: 0.008, d: 0.2, s: 0.75, r: 0.12, peak: v * 0.45 });
  const a = osc(c, 'square', f, t, -7);
  const b = osc(c, 'square', f, t, 7);
  const lp = filt(c, 'lowpass', o.cutoff || 4200, 0.8);
  a.connect(lp); b.connect(lp);
  lp.connect(e);
  vibrato(c, t, e.end, [a, b], { depth: 22 });
  send(e, out, rev, 0.1);
  startStop([a, b], t, e.end);
  return e.end;
}

const SUPER_DETUNE = [-24, -12, 0, 12, 24];
function supersaw(c, out, rev, t, f, dur, v, o = {}) {
  const e = env(c, t, dur, { a: o.attack ?? 0.01, d: 0.3, s: 0.8, r: o.release ?? 0.18, peak: v * 0.2 });
  const lp = filt(c, 'lowpass', o.cutoff || 6000, 0.6);
  const oscs = SUPER_DETUNE.map((d) => {
    const x = osc(c, 'sawtooth', f, t, d + (Math.random() - 0.5) * 4);
    x.connect(lp);
    return x;
  });
  lp.connect(e);
  if (!o.noVib) vibrato(c, t, e.end, oscs, { depth: 14, delay: 0.25 });
  send(e, out, rev, 0.1);
  startStop(oscs, t, e.end);
  return e.end;
}

// FM brass stab: filter "blat" on the attack.
function brass(c, out, rev, t, f, dur, v) {
  const e = env(c, t, dur, { a: 0.02, d: 0.25, s: 0.7, r: 0.14, peak: v * 0.35 });
  const a = osc(c, 'sawtooth', f, t, -6);
  const b = osc(c, 'sawtooth', f, t, 6);
  const lp = filt(c, 'lowpass', Math.min(8000, f * 1.5), 2.2);
  lp.frequency.setValueAtTime(f * 1.2, t);
  lp.frequency.exponentialRampToValueAtTime(nyq(c, Math.min(9000, f * 9)), t + 0.05);
  lp.frequency.exponentialRampToValueAtTime(Math.min(6000, f * 4), t + 0.3);
  a.connect(lp); b.connect(lp);
  lp.connect(e);
  vibrato(c, t, e.end, [a, b], { depth: 12, delay: 0.3 });
  send(e, out, rev, 0.1);
  startStop([a, b], t, e.end);
  return e.end;
}

function strings(c, out, rev, t, f, dur, v, o = {}) {
  const e = env(c, t, dur, { a: o.attack ?? 0.2, d: 0.4, s: 0.85, r: o.release ?? 0.35, peak: v * 0.2 });
  const lp = filt(c, 'lowpass', o.cutoff || 2600, 0.5);
  const oscs = [-13, 0, 11].map((d) => {
    const x = osc(c, 'sawtooth', f, t, d);
    x.connect(lp);
    return x;
  });
  lp.connect(e);
  vibrato(c, t, e.end, oscs, { depth: 9, rate: 5, delay: 0.1 });
  send(e, out, rev, 0.2);
  startStop(oscs, t, e.end);
  return e.end;
}

// Choir-ish pad: saws through two vowel formants ("aah").
function choir(c, out, rev, t, f, dur, v) {
  const e = env(c, t, dur, { a: 0.3, d: 0.4, s: 0.9, r: 0.5, peak: v * 0.9 });
  const a = osc(c, 'sawtooth', f, t, -8);
  const b = osc(c, 'sawtooth', f, t, 8);
  const mix = c.createGain();
  mix.gain.value = 0.5;
  a.connect(mix); b.connect(mix);
  const f1 = filt(c, 'bandpass', 700, 5);
  const f2 = filt(c, 'bandpass', 1150, 7);
  const g2 = c.createGain();
  g2.gain.value = 0.6;
  mix.connect(f1).connect(e);
  mix.connect(f2).connect(g2).connect(e);
  vibrato(c, t, e.end, [a, b], { depth: 14, rate: 5.2, delay: 0.2 });
  send(e, out, rev, 0.3);
  startStop([a, b], t, e.end);
  return e.end;
}

// The iconic 90s ORCHESTRA HIT: power-chord stack of detuned saws + noise,
// slight pitch drop and a fast closing filter.
const ORCH_PARTIALS = [[1, 0], [1, 9], [1.5, -5], [2, 6], [3, -7], [4, 4]];
function orch(c, out, rev, t, f, dur, v) {
  const g = perc(c, t, v * 0.32, 0.55);
  const lp = filt(c, 'lowpass', 7000, 1.2);
  lp.frequency.setValueAtTime(nyq(c, 8000), t);
  lp.frequency.exponentialRampToValueAtTime(600, t + 0.35);
  const oscs = ORCH_PARTIALS.map(([m, d]) => {
    const x = osc(c, 'sawtooth', f * m, t, d);
    x.frequency.exponentialRampToValueAtTime(f * m * 0.985, t + 0.3);
    x.connect(lp);
    return x;
  });
  const n = noiseSrc(c);
  const nbp = filt(c, 'bandpass', 2000, 0.6);
  const ng = perc(c, t, v * 0.5, 0.12);
  n.connect(nbp).connect(ng).connect(g);
  lp.connect(g);
  send(g, out, rev, 0.45);
  startStop(oscs, t, g.end);
  n.start(t, Math.random()); n.stop(t + 0.14);
  return g.end;
}

function pluck(c, out, rev, t, f, dur, v, o = {}) {
  const decay = o.decay ?? 0.22;
  const g = perc(c, t, v * 0.35, decay + 0.05);
  const a = osc(c, o.wave || 'square', f, t);
  const b = osc(c, 'sawtooth', f, t, 8);
  const lp = filt(c, 'lowpass', Math.min(12000, f * 12), 2);
  lp.frequency.setValueAtTime(nyq(c, Math.min(12000, f * 14)), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + decay);
  a.connect(lp); b.connect(lp);
  lp.connect(g);
  send(g, out, rev, 0.1);
  startStop([a, b], t, g.end);
  return g.end;
}

// FM bell / electric piano.
function bell(c, out, rev, t, f, dur, v, o = {}) {
  const ep = o.ep;
  const len = ep ? Math.max(0.4, Math.min(1.6, dur + 0.3)) : 1.4;
  const g = perc(c, t, v * (ep ? 0.4 : 0.3), len);
  const car = osc(c, 'sine', f, t);
  const mod = osc(c, 'sine', f * (ep ? 1 : 3.5), t);
  const mg = c.createGain();
  mg.gain.setValueAtTime(f * (ep ? 2 : 4), t);
  mg.gain.exponentialRampToValueAtTime(f * (ep ? 0.25 : 0.05), t + len * 0.7);
  mod.connect(mg).connect(car.frequency);
  car.connect(g);
  send(g, out, rev, 0.2);
  startStop([car, mod], t, g.end);
  return g.end;
}

// Distorted guitar power chord (root + fifth + octave). Short notes = palm mute.
function guitar(c, out, rev, t, f, dur, v, o = {}) {
  const palm = o.palm ?? (o.len != null && o.len <= 1);
  const e = palm
    ? (() => { const g = perc(c, t, v * 0.32, 0.13); return g; })()
    : env(c, t, dur, { a: 0.004, d: 0.3, s: 0.8, r: 0.07, peak: v * 0.3 });
  const pre = c.createGain();
  pre.gain.value = 1.6;
  const parts = [[1, -6], [1, 6], [1.4983, 0], [2, 4]];
  const oscs = parts.map(([m, d]) => {
    const x = osc(c, 'sawtooth', f * m, t, d);
    x.connect(pre);
    return x;
  });
  const hp = filt(c, 'highpass', 90);
  const ws = c.createWaveShaper();
  ws.curve = distCurve(c);
  ws.oversample = 'none';
  const cab = filt(c, 'lowpass', palm ? 1300 : 3400, 0.9);
  const mid = filt(c, 'peaking', 1600, 1);
  mid.gain.value = palm ? -2 : 3;
  pre.connect(hp).connect(ws).connect(cab).connect(mid).connect(e);
  send(e, out, rev, palm ? 0 : 0.08);
  startStop(oscs, t, e.end);
  return e.end;
}

// Noise riser / sweep for transitions. Length = note length.
function riser(c, out, rev, t, f, dur, v) {
  const n = noiseSrc(c);
  const bp = filt(c, 'bandpass', 300, 2.5);
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(nyq(c, 7000), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v * 0.5, t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
  n.connect(bp).connect(g);
  send(g, out, rev, 0.4);
  n.start(t, Math.random()); n.stop(t + dur + 0.05);
  return t + dur + 0.05;
}

export const INSTRUMENTS = {
  fmBass, sawBass, square, supersaw, brass, strings, choir, orch, pluck, bell, guitar, riser,
};
