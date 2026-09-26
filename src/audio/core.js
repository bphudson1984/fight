// Shared WebAudio graph used by both music and sound effects.
//
//   music bus ─┐
//   sfx bus ───┼─> master gain ─> compressor ─> destination
//   reverb ────┘        (reverbSend ─> convolver ─> reverb return)

let ctx = null;
let muted = false;
const bus = {};
const noiseCache = new WeakMap();

export function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.12;
    bus.master = ctx.createGain();
    bus.master.gain.value = muted ? 0 : 0.9;
    bus.master.connect(comp).connect(ctx.destination);

    bus.music = ctx.createGain();
    bus.music.gain.value = 0.5;
    bus.music.connect(bus.master);

    bus.sfx = ctx.createGain();
    bus.sfx.gain.value = 0.9;
    bus.sfx.connect(bus.master);

    bus.reverb = ctx.createConvolver();
    bus.reverb.buffer = makeIR(ctx, 2.0, 3.2);
    bus.reverbReturn = ctx.createGain();
    bus.reverbReturn.gain.value = 0.35;
    bus.reverb.connect(bus.reverbReturn).connect(bus.master);
    bus.reverbSend = ctx.createGain();
    bus.reverbSend.gain.value = 1;
    bus.reverbSend.connect(bus.reverb);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** { master, music, sfx, reverbSend } – creates the graph on first use. */
export function getBus() {
  ac();
  return bus;
}

/** 2 seconds of white noise for the given context (cached). */
export function noiseBuffer(c = ac()) {
  let b = noiseCache.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(c, b);
  }
  return b;
}

/** Synthetic stereo reverb impulse response. */
export function makeIR(c, seconds = 2, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return ir;
}

export function unlockAudio() { ac(); }
export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  if (ctx) bus.master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
  if (m && window.speechSynthesis) speechSynthesis.cancel();
}
