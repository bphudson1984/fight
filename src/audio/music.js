// Public music API: looping songs, one-shot jingles, tempo scaling.
import { ac, getBus } from './core.js';
import { Sequencer } from './sequencer.js';
import { SONGS, JINGLES } from './songs.js';

let seq = null;
let currentId = null;
let tempo = 1;
let jingleResolve = null;

function stopCurrent(fade) {
  if (seq) seq.stop(fade);
  seq = null;
  currentId = null;
  if (jingleResolve) { const r = jingleResolve; jingleResolve = null; r(false); }
}

function startSong(song, id, loop) {
  const c = ac();
  const bus = getBus();
  const s = new Sequencer(c, bus.music, bus.reverbSend).load(song, { loop });
  s.tempoScale = tempo;
  // brief fade-in so a switch never clicks
  s.out.gain.setValueAtTime(0, c.currentTime);
  s.out.gain.linearRampToValueAtTime(1, c.currentTime + 0.05);
  s.start(c.currentTime + 0.06);
  seq = s;
  currentId = id;
  return s;
}

export const music = {
  /** Start looping a song. No-op if it's already playing. */
  play(id) {
    if (currentId === id && seq && !seq.done) return;
    const song = SONGS[id];
    if (!song) { console.warn(`music: unknown song ${id}`); return; }
    stopCurrent(0.15);
    startSong(song, id, true);
  },

  stop(fade = 0.3) { stopCurrent(fade); },

  /** One-shot piece. Resolves true when it finishes (false if interrupted). */
  jingle(id) {
    const song = JINGLES[id];
    if (!song) { console.warn(`music: unknown jingle ${id}`); return Promise.resolve(false); }
    stopCurrent(0.1);
    const s = startSong(song, id, false);
    return new Promise((resolve) => {
      jingleResolve = resolve;
      s.onEnd = (endTime) => {
        const c = ac();
        const wait = Math.max(0, endTime - c.currentTime) * 1000 + 250;
        setTimeout(() => {
          if (seq === s) { seq = null; currentId = null; }
          if (jingleResolve === resolve) { jingleResolve = null; resolve(true); }
          const tail = s.tail;
          setTimeout(() => tail.disconnect(), 2500);
        }, wait);
      };
    });
  },

  /** 1 = normal speed; >1 speeds up (applied from the next step). */
  setTempoScale(s) {
    tempo = Math.max(0.5, Math.min(2, s));
    if (seq) seq.tempoScale = tempo;
  },

  get current() { return currentId; },
};

export const SONG_IDS = Object.keys(SONGS);
export const JINGLE_IDS = Object.keys(JINGLES);
