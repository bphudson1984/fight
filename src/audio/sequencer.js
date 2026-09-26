// Lookahead step sequencer + pattern notation.
//
// Melodic lines: whitespace-separated tokens, one step = a 16th note.
//   A4        note (C4 = middle C). Sharps "C#4", flats "Bb3".
//   A4:4      note lasting 4 steps       A3+C4+E4:8  chord for 8 steps
//   A4!       accent (louder)            A4?         soft (ghost)
//   -         extend the previous note by one step
//   .  .:4    rest (1 or n steps)        |           bar line (ignored)
// Drum lanes: one char per step: x hit, X accent, o ghost, . rest (spaces/| ignored).
// A line/lane shorter than the pattern repeats to fill it.
import { INSTRUMENTS, DRUMS } from './instruments.js';

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function noteToMidi(s) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note "${s}"`);
  return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
export function midiToName(m) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function parseLine(str, steps, warn) {
  const toks = str.split(/\s+/).filter((t) => t && t !== '|');
  const evs = [];
  let step = 0;
  let last = null;
  for (const tok of toks) {
    if (tok === '-') { if (last) last.len++; step++; continue; }
    let [body, lenS] = tok.split(':');
    const len = lenS ? Number(lenS) : 1;
    if (body === '.') { step += len; last = null; continue; }
    let vel = 0.8;
    if (body.endsWith('!')) { vel = 1; body = body.slice(0, -1); } else if (body.endsWith('?')) { vel = 0.5; body = body.slice(0, -1); }
    const ev = { step, len, vel, notes: body.split('+').map(noteToMidi) };
    evs.push(ev);
    last = ev;
    step += len;
  }
  const L = step;
  const out = new Array(steps);
  if (!L) return out;
  if (steps % L !== 0 && L < steps) warn(`line length ${L} does not divide ${steps}`);
  if (L > steps) warn(`line length ${L} longer than pattern ${steps}`);
  for (let off = 0; off < steps; off += L) {
    for (const ev of evs) {
      const s = off + ev.step;
      if (s >= steps) continue;
      (out[s] ||= []).push({ ...ev, len: Math.min(ev.len, steps - s) });
    }
  }
  return out;
}

function parseDrums(lanes, steps, warn) {
  const out = new Array(steps);
  for (const [drum, str] of Object.entries(lanes)) {
    if (!DRUMS[drum]) { warn(`unknown drum "${drum}"`); continue; }
    const s = str.replace(/[\s|]/g, '');
    if (!s.length) continue;
    if (steps % s.length !== 0) warn(`drum lane ${drum} length ${s.length} does not divide ${steps}`);
    for (let i = 0; i < steps; i++) {
      const ch = s[i % s.length];
      if (ch === '.') continue;
      const vel = ch === 'X' ? 1 : ch === 'o' ? 0.45 : 0.78;
      (out[i] ||= []).push({ drum, vel });
    }
  }
  return out;
}

/** Pre-parse every pattern of a song. Returns { patterns, warnings }. */
export function compileSong(song) {
  if (song._compiled) return song._compiled;
  const warnings = [];
  const patterns = {};
  for (const [name, p] of Object.entries(song.patterns)) {
    const steps = p.bars * 16;
    const tracks = {};
    for (const [tk, def] of Object.entries(song.tracks)) {
      const data = p[def.src || tk];
      if (data == null) continue;
      const warn = (m) => warnings.push(`${name}.${tk}: ${m}`);
      tracks[tk] = def.inst === 'drums' ? parseDrums(data, steps, warn) : parseLine(data, steps, warn);
    }
    patterns[name] = { steps, tracks };
  }
  for (const k of Object.keys(song.tracks)) {
    const inst = song.tracks[k].inst;
    if (inst !== 'drums' && !INSTRUMENTS[inst]) warnings.push(`track ${k}: unknown instrument ${inst}`);
  }
  const parseEntry = (e) => {
    const m = /^([A-Za-z0-9_]+)([+-]\d+)?$/.exec(e);
    if (!m || !patterns[m[1]]) { warnings.push(`bad order entry ${e}`); return null; }
    return { name: m[1], tr: m[2] ? Number(m[2]) : 0 };
  };
  const intro = (song.intro || []).map(parseEntry).filter(Boolean);
  const loop = (song.loop || []).map(parseEntry).filter(Boolean);
  song._compiled = { patterns, intro, loop, warnings };
  return song._compiled;
}

const LOOKAHEAD = 0.15;
const MAX_VOICES = 48;

export class Sequencer {
  /**
   * @param ctx   AudioContext or OfflineAudioContext
   * @param dest  node the song mixes into
   * @param rev   reverb send node (or null)
   */
  constructor(ctx, dest, rev = null) {
    this.c = ctx;
    // fade gain -> glue compressor -> makeup gain -> dest
    this.out = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -22;
    comp.knee.value = 6;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.1;
    const makeup = ctx.createGain();
    makeup.gain.value = 1.9;
    this.out.connect(comp).connect(makeup).connect(dest);
    this.tail = makeup;
    this.rev = rev;
    this.tempoScale = 1;
    this.voices = [];
    this.timer = null;
    this.done = false;
    this.onEnd = null;
  }

  load(song, { loop = true } = {}) {
    this.song = song;
    const comp = compileSong(song);
    this.pats = comp.patterns;
    this.order = [...comp.intro, ...comp.loop];
    this.loopStart = comp.intro.length;
    this.looping = loop && comp.loop.length > 0;
    this.tracks = Object.entries(song.tracks).map(([key, def]) => {
      const input = this.c.createGain();
      input.gain.value = def.vol ?? 0.5;
      const pan = this.c.createStereoPanner();
      pan.pan.value = def.pan ?? 0;
      input.connect(pan).connect(this.out);
      let sendNode = null;
      if (this.rev && def.rev) {
        sendNode = this.c.createGain();
        sendNode.gain.value = def.rev;
        pan.connect(sendNode).connect(this.rev);
      }
      return { key, def, input, send: sendNode };
    });
    return this;
  }

  stepDur() { return 60 / (this.song.bpm * this.tempoScale) / 4; }

  /** Begin playback at `when`. Realtime mode uses a timer; offline mode uses scheduleUntil(). */
  start(when, { realtime = true } = {}) {
    this.oi = 0;
    this.step = 0;
    this.next = when;
    if (realtime) {
      this.timer = setInterval(() => this.tick(), 25);
      this.tick();
    }
  }

  tick() { this.scheduleUntil(this.c.currentTime + LOOKAHEAD); }

  scheduleUntil(t) {
    while (!this.done && this.next < t) this.advance();
  }

  advance() {
    const sd = this.stepDur();
    const entry = this.order[this.oi];
    if (!entry) { this.finish(this.next); return; }
    const pat = this.pats[entry.name];
    this.playStep(this.next, sd, entry, pat);
    this.next += sd;
    if (++this.step >= pat.steps) {
      this.step = 0;
      if (++this.oi >= this.order.length) {
        if (this.looping) this.oi = this.loopStart;
        else this.finish(this.next);
      }
    }
  }

  finish(t) {
    if (this.done) return;
    this.done = true;
    clearInterval(this.timer);
    this.timer = null;
    this.endTime = t;
    this.onEnd?.(t);
  }

  playStep(t, sd, entry, pat) {
    this.voices = this.voices.filter((e) => e > t);
    for (const tr of this.tracks) {
      const evs = pat.tracks[tr.key]?.[this.step];
      if (!evs) continue;
      const def = tr.def;
      for (const ev of evs) {
        if (def.inst === 'drums') {
          this.voices.push(DRUMS[ev.drum](this.c, tr.input, tr.send, t, 0, 0, ev.vel));
          continue;
        }
        const fn = INSTRUMENTS[def.inst];
        const dur = ev.len * sd * (def.gate ?? 0.92);
        for (const n of ev.notes) {
          if (this.voices.length >= MAX_VOICES) break;
          const midi = n + (def.tr || 0) + entry.tr;
          this.voices.push(fn(this.c, tr.input, tr.send, t, mtof(midi), dur, ev.vel, { ...def.opts, len: ev.len }));
        }
      }
    }
  }

  stop(fade = 0.3) {
    clearInterval(this.timer);
    this.timer = null;
    this.done = true;
    const now = this.c.currentTime;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + Math.max(0.01, fade));
    const tail = this.tail;
    setTimeout(() => tail.disconnect(), (fade + 2) * 1000);
  }
}

// ------------------------------------------------------------ composing helpers

const QUAL = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], dim7: [0, 3, 6, 9], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14],
};

export function chordPcs(name) {
  const m = /^([A-G])(#|b)?(.*)$/.exec(name);
  if (!m || !(m[3] in QUAL)) throw new Error(`bad chord "${name}"`);
  const root = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return { root: (root + 12) % 12, ivs: QUAL[m[3]] };
}

/** Chord voiced close to a centre MIDI note (automatic smooth voice leading). */
export function near(name, center = 62) {
  const { root, ivs } = chordPcs(name);
  const notes = ivs.map((iv) => {
    const pc = (root + iv) % 12;
    let n = center - 6 + ((pc - (center - 6)) % 12 + 12) % 12;
    return n;
  });
  return [...new Set(notes)].sort((a, b) => a - b);
}

/** Root of each chord placed at or above `low` (MIDI). */
export function rootsIn(chords, low = 28) {
  return chords.map((c) => {
    const { root } = chordPcs(c);
    return low + (((root - low) % 12) + 12) % 12;
  });
}

const tok = (midis, len, accent = '') => midis.map(midiToName).join('+') + accent + (len > 1 ? `:${len}` : '');

/** Sustained chord per bar. */
export function hold(chords, center = 60, len = 16) {
  return chords.map((c) => tok(near(c, center), len)).join(' | ');
}

/** Rhythmic line from roots (MIDI numbers or note names), one root per bar.
 *  Rhythm chars: x root, X root accented, o octave up, O octave accented, 5 fifth, - tie, . rest */
export function line(roots, rhythm) {
  return roots.map((r, i) => {
    const root = typeof r === 'number' ? r : noteToMidi(r);
    const rh = Array.isArray(rhythm) ? rhythm[i % rhythm.length] : rhythm;
    return [...rh.replace(/\s/g, '')].map((ch) => {
      if (ch === '-' || ch === '.') return ch;
      const n = ch === 'o' || ch === 'O' ? root + 12 : ch === '5' ? root + 7 : root;
      return midiToName(n) + (ch === 'X' || ch === 'O' ? '!' : '');
    }).join(' ');
  }).join(' | ');
}

/** Chord stabs on a rhythm (x / X accent / - tie / . rest). */
export function stabs(chords, rhythm, center = 64) {
  return chords.map((c, i) => {
    const notes = near(c, center);
    const rh = Array.isArray(rhythm) ? rhythm[i % rhythm.length] : rhythm;
    return [...rh.replace(/\s/g, '')].map((ch) => {
      if (ch === '-' || ch === '.') return ch;
      return notes.map(midiToName).join('+') + (ch === 'X' ? '!' : '');
    }).join(' ');
  }).join(' | ');
}

/** Arpeggio: pattern digits index chord tones (beyond the chord = next octave). */
export function arp(chords, pattern, center = 67) {
  return chords.map((c) => {
    const notes = near(c, center);
    return [...pattern.replace(/\s/g, '')].map((ch) => {
      if (ch === '-' || ch === '.') return ch;
      const i = Number(ch);
      return midiToName(notes[i % notes.length] + 12 * Math.floor(i / notes.length));
    }).join(' ');
  }).join(' | ');
}

/** Drum lane with hits at given step indices. */
export function hitAt(steps, ...at) {
  const a = new Array(steps).fill('.');
  for (const i of at) a[i] = 'X';
  return a.join('');
}

export const rep = (s, n) => Array(n).fill(s).join(' ');
