// Composed songs. One step = a 16th note; 16 steps per bar.
// See sequencer.js for the notation.
import { hold, line, stabs, arp, rootsIn, hitAt, rep } from './sequencer.js';

const dots = (n) => '.'.repeat(n);

// Common track presets
const DR = (vol = 0.9) => ({ inst: 'drums', vol, rev: 0.12 });

// =====================================================================
// TITLE — heroic A-minor anthem, 150 BPM
// =====================================================================
const tA = ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E'];
const tB = ['F', 'G', 'Am', 'Am', 'Dm', 'E', 'Am', 'E'];

const title = {
  bpm: 150,
  tracks: {
    drums: DR(0.95),
    bass: { inst: 'fmBass', vol: 0.55, rev: 0.03 },
    lead: { inst: 'supersaw', vol: 0.8, rev: 0.25 },
    lead2: { inst: 'square', vol: 0.6, rev: 0.25, pan: 0.05 },
    pad: { inst: 'strings', vol: 0.3, rev: 0.4, pan: -0.15 },
    arp: { inst: 'pluck', vol: 0.22, rev: 0.2, pan: -0.45 },
    brass: { inst: 'brass', vol: 0.4, rev: 0.2, pan: 0.35 },
    orch: { inst: 'orch', vol: 0.6, rev: 0.3 },
    fx: { inst: 'riser', vol: 0.4 },
  },
  patterns: {
    I: {
      bars: 4,
      orch: 'A3!:3 A3!:3 A3!:4 A3!:2 A3!:4 | A3!:3 A3!:3 A3!:4 A3!:2 A3!:4 | F3!:3 F3!:3 F3!:4 F3!:2 F3!:4 | G3!:3 G3!:3 G3!:2 .:8',
      pad: hold(['Am', 'Am', 'F', 'G']),
      bass: line(rootsIn(['Am', 'Am', 'F', 'G']), ['X..X..X...X.X...', 'X..X..X...X.X...', 'X..X..X...X.X...', 'X..X..X.........']),
      fx: '.:32 C4:32',
      drums: {
        k: 'X..X..X...X.X...',
        s: dots(56) + 'ooxxxxXX',
        t1: dots(48) + 'XX......' + dots(8),
        t2: dots(48) + '..XX....' + dots(8),
        t3: dots(48) + '....XX..' + dots(8),
      },
    },
    A: {
      bars: 8,
      lead: 'A4:4 C5:2 E5:2 A5:6 G5:2 | F5:4 E5:2 C5:2 A4:6 C5:2 | D5:4 B4:2 G4:2 D5:3 E5:3 F5:2 | E5:8 D5:2 C5:2 B4:4 |'
        + ' A4:4 C5:2 E5:2 A5:4 B5:2 C6:2 | C6:4 B5:2 A5:2 F5:6 A5:2 | B5:4 A5:2 G5:2 D5:4 G5:4 | G#5:6 A5:2 B5:8',
      bass: line(rootsIn(tA), 'x.x.o.x.x.o.x.o.'),
      pad: hold(tA),
      arp: arp(tA, '0123210301232103', 69),
      orch: 'A3!:16 | .:16 | .:16 | .:8 E3!:2 E3!:2 E3!:4 | A3!:16 | .:16 | .:16 | E3!:3 E3!:3 E3!:2 E3!:8',
      drums: {
        k: 'x.....x.x.....x.',
        s: rep('....X.......X...', 7) + '....X.......XXXX',
        h: 'x.x.x.x.x.x.x.x.',
        o: '..............x.',
        x: hitAt(128, 0, 64),
      },
    },
    B: {
      bars: 8,
      lead2: 'A5:6 G5:2 F5:4 E5:4 | D5:6 E5:2 F5:4 G5:4 | E5:8 C5:4 A4:4 | B4:2 C5:2 D5:2 E5:10 |'
        + ' F5:6 E5:2 D5:4 A5:4 | G#5:6 F5:2 E5:4 B4:4 | A5:4 E5:4 C5:4 A4:4 | B4:4 D5:4 E5:4 G#5:4',
      brass: stabs(tB, 'X..X..X...X..X..', 66),
      bass: line(rootsIn(tB), 'x.x.o.x.x.o.x.o.'),
      pad: hold(tB),
      orch: 'F3!:16 | .:16 | A3!:16 | .:16 | D3!:16 | E3!:16 | A3!:16 | E3!:4 E3!:4 E3!:4 E3!:4',
      fx: '.:112 C4:16',
      drums: {
        k: 'x.....x.x.x...x.',
        s: rep('....X.......X...', 7) + '....X...XXXXXXXX',
        h: 'XxxxXxxxXxxxXxxx',
        x: hitAt(128, 0, 64),
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B', 'A+2', 'B+2'],
};

// =====================================================================
// SELECT — funky E-minor slap groove, 138 BPM
// =====================================================================
const sA = ['Em7', 'Am7', 'D', 'C', 'Em7', 'Am7', 'C', 'B7'];
const sB = ['C', 'D', 'Bm', 'Em', 'Am', 'B7', 'Em', 'B7'];
const slap = 'x.o..xo.x..xo.x.';

const select = {
  bpm: 138,
  tracks: {
    drums: DR(0.9),
    bass: { inst: 'fmBass', vol: 0.6, rev: 0.02 },
    ep: { inst: 'bell', vol: 0.4, rev: 0.25, pan: -0.25, opts: { ep: true } },
    lead: { inst: 'square', vol: 0.45, rev: 0.25, pan: 0.1 },
    brass: { inst: 'brass', vol: 0.45, rev: 0.25, pan: 0.2 },
    arp: { inst: 'pluck', vol: 0.2, rev: 0.2, pan: 0.45 },
    pad: { inst: 'strings', vol: 0.3, rev: 0.4, pan: -0.1 },
  },
  patterns: {
    I: {
      bars: 2,
      bass: line(rootsIn(['Em7', 'Em7']), slap),
      drums: { k: 'x......xx.x.....', h: 'xxxxxxxxxxxxxxxx', s: dots(16) + '....X...X.XXXXXX' },
    },
    A: {
      bars: 8,
      lead: 'B4:2 D5:2 E5:3 G5:3 E5:2 D5:2 B4:2 | C5:2 E5:2 G5:4 A5:2 G5:2 E5:4 | F#5:3 E5:3 D5:2 A4:4 D5:4 | E5:6 D5:2 C5:2 B4:2 G4:4 |'
        + ' B4:2 D5:2 E5:3 G5:3 E5:2 D5:2 B4:2 | C5:2 E5:2 G5:4 A5:2 G5:2 E5:4 | G5:3 E5:3 C5:2 G5:4 A5:4 | B5:6 A5:2 F#5:4 D#5:4',
      bass: line(rootsIn(sA), slap),
      ep: stabs(sA, '..X...X...X..X..', 64),
      pad: hold(sA, 60),
      drums: {
        k: 'x......xx.x.....',
        s: '....X..o.o..X...',
        c: '....x.......x...',
        h: 'XxxxXxxxXxxxXxxx',
        o: '......x.......x.',
        x: hitAt(128, 0),
      },
    },
    B: {
      bars: 8,
      brass: 'G5:4 E5:4 C5:4 E5:4 | F#5:4 D5:4 A4:4 D5:4 | D5:6 F#5:2 B5:8 | G5:8 F#5:4 E5:4 |'
        + ' E5:4 A5:4 C6:4 B5:2 A5:2 | B5:6 A5:2 F#5:4 D#5:4 | E5:4 G5:4 B5:8 | A5:4 F#5:4 D#5:4 B4:4',
      arp: arp(sB, '0120012001200120', 71),
      bass: line(rootsIn(sB), slap),
      ep: stabs(sB, '..X...X...X..X..', 64),
      pad: hold(sB, 60),
      drums: {
        k: 'x......xx.x.....',
        s: rep('....X..o.o..X...', 7) + '....X...XXXXXXXX',
        c: '....x.......x...',
        h: 'x.x.x.x.x.x.x.x.',
        o: '..x...x...x...x.',
        x: hitAt(128, 0, 64),
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B'],
};

// =====================================================================
// TEMPLE — Japanese-flavoured rock in D (hirajoshi), 160 BPM
// =====================================================================
const teA = ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'Dm'];
const teB = ['Gm', 'Bb', 'A', 'A', 'Gm', 'Bb', 'C', 'A'];

const temple = {
  bpm: 160,
  tracks: {
    drums: DR(0.95),
    gtr: { inst: 'guitar', vol: 0.5, rev: 0.05, pan: 0.25 },
    bass: { inst: 'sawBass', vol: 0.5, rev: 0.02 },
    lead: { inst: 'square', vol: 0.45, rev: 0.3, pan: -0.05 },
    brass: { inst: 'brass', vol: 0.5, rev: 0.3, pan: -0.1 },
    koto: { inst: 'pluck', vol: 0.35, rev: 0.35, pan: -0.35, opts: { decay: 0.5, wave: 'triangle' } },
    pad: { inst: 'strings', vol: 0.3, rev: 0.45 },
    orch: { inst: 'orch', vol: 0.5, rev: 0.35 },
    fx: { inst: 'riser', vol: 0.4 },
  },
  patterns: {
    I: {
      bars: 4,
      koto: 'D5:2 E5:2 F5:2 A5:6 Bb5:2 A5:2 | F5:2 E5:2 D5:8 .:4 | A4:2 Bb4:2 D5:2 E5:6 F5:2 E5:2 | D5:12 .:4',
      pad: hold(['Dm', 'Dm', 'Bb', 'A']),
      fx: '.:32 C4:32',
      drums: {
        T: rep('X...X...X.X.X...', 3) + 'X.X.X.X.XXXXXXXX',
        t1: dots(56) + 'X.X.....',
        t2: dots(56) + '.X.X....',
      },
      orch: '.:48 .:12 D3!:4',
    },
    A: {
      bars: 8,
      gtr: 'D2 D2 . D2 D2 . F2! - D2 D2 . D2 G2! - F2! - | Bb1 Bb1 . Bb1 Bb1 . D2! - Bb1 Bb1 . Bb1 C2! - D2! - |'
        + ' C2 C2 . C2 C2 . D2! - C2 C2 . C2 E2! - F2! - | D2 D2 . D2 D2 . F2! - A2! - G2! - F2! - E2! -',
      bass: line(rootsIn(teA), 'x.x.x.x.x.x.x.x.'),
      lead: 'D5:3 E5:3 F5:2 A5:6 F5:2 | Bb5:4 A5:2 F5:2 D5:8 | E5:3 F5:3 E5:2 C5:4 A4:4 | D5:12 .:2 A4 C5 |'
        + ' D5:3 E5:3 F5:2 A5:4 Bb5:2 A5:2 | F5:4 E5:2 D5:2 Bb4:8 | C5:3 D5:3 E5:2 G5:4 E5:4 | A5:4 F5:4 E5:4 D5:4',
      koto: arp(teA, '0.1.2.1.3.2.1.0.', 74),
      pad: hold(teA, 57),
      drums: {
        k: 'x.x...x.x.x...x.',
        s: rep('....X.......X...', 7) + '....X...X.X.XXXX',
        h: 'x.x.x.x.x.x.x.x.',
        T: 'X...............',
        x: hitAt(128, 0, 64),
      },
    },
    B: {
      bars: 8,
      gtr: line(rootsIn(teB, 40), 'X-.xX-.xX-.xX-xx'),
      bass: line(rootsIn(teB), 'x.x.x.x.x.x.x.x.'),
      brass: 'G5:4 A5:4 Bb5:4 D6:4 | C6:6 Bb5:2 A5:4 F5:4 | E5:4 A5:4 C#6:8 | C#6:2 D6:2 C#6:2 Bb5:2 A5:8 |'
        + ' G5:4 A5:4 Bb5:4 D6:4 | F6:6 E6:2 D6:4 Bb5:4 | E6:4 D6:4 C6:4 G5:4 | A5:8 C#6:4 E6:4',
      pad: hold(teB, 60),
      orch: 'G2!:16 | .:16 | A2!:16 | .:16 | G2!:16 | .:16 | C3!:8 C3!:8 | A2!:4 A2!:4 A2!:8',
      fx: '.:112 C4:16',
      drums: {
        k: 'x.x.x.x.x.x.x.x.',
        s: '....X.......X...',
        h: 'xxxxxxxxxxxxxxxx',
        T: 'X...X...X...X...',
        x: hitAt(128, 0, 32, 64, 96),
        t1: dots(120) + 'XX......',
        t2: dots(120) + '..XX....',
        t3: dots(120) + '....XXXX',
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B', 'A+2', 'B+2'],
};

// =====================================================================
// NEON — eurobeat / techno in G minor, 165 BPM
// =====================================================================
const nA = ['Gm', 'Eb', 'F', 'Dm', 'Gm', 'Eb', 'F', 'D'];
const nB = ['Eb', 'F', 'Dm', 'Gm', 'Eb', 'F', 'Gm', 'D'];
const octBass = 'x.o.x.o.x.o.x.o.';

const neon = {
  bpm: 165,
  tracks: {
    drums: DR(0.95),
    bass: { inst: 'sawBass', vol: 0.55, rev: 0.02 },
    stab: { inst: 'supersaw', vol: 0.3, rev: 0.25, pan: -0.2, opts: { attack: 0.003, release: 0.08, noVib: true } },
    lead: { inst: 'square', vol: 0.5, rev: 0.3, pan: 0.1 },
    lead2: { inst: 'supersaw', vol: 0.5, rev: 0.3 },
    arp: { inst: 'pluck', vol: 0.22, rev: 0.25, pan: 0.45 },
    pad: { inst: 'strings', vol: 0.3, rev: 0.45, pan: -0.3 },
    orch: { inst: 'orch', vol: 0.45, rev: 0.3 },
    fx: { inst: 'riser', vol: 0.45 },
  },
  patterns: {
    I: {
      bars: 4,
      bass: line(rootsIn(['Gm', 'Gm', 'Eb', 'F'], 31), octBass),
      arp: arp(['Gm', 'Gm', 'Eb', 'F'], '0120120120120120', 67),
      fx: 'C4:64',
      drums: {
        k: 'x...x...x...x...',
        o: '..x...x...x...x.',
        s: dots(48) + 'xxxxxxxxXXXXXXXX',
      },
      orch: '.:60 G3!:4',
    },
    A: {
      bars: 8,
      lead: 'D5:2 G5:2 A5:2 Bb5:4 A5:2 G5:2 F5:2 | G5:6 F5:2 Eb5:4 D5:4 | C5:2 F5:2 G5:2 A5:4 G5:2 F5:2 Eb5:2 | F5:6 D5:2 A4:8 |'
        + ' D5:2 G5:2 A5:2 Bb5:4 C6:2 D6:4 | Eb6:6 D6:2 C6:4 Bb5:4 | A5:4 F5:4 C6:4 A5:4 | F#5:8 A5:8',
      bass: line(rootsIn(nA, 31), octBass),
      stab: stabs(nA, '..x...x...x...x.', 67),
      pad: hold(nA, 60),
      drums: {
        k: 'x...x...x...x...',
        s: '....X.......X...',
        c: '....x.......x...',
        h: '.x.x.x.x.x.x.x.x',
        o: '..x...x...x...x.',
        x: hitAt(128, 0, 64),
      },
    },
    B: {
      bars: 8,
      lead2: 'Bb5:3 Bb5:3 G5:2 Eb6:4 D6:4 | C6:3 C6:3 A5:2 F6:4 Eb6:4 | D6:6 C6:2 A5:4 F5:4 | G5:6 A5:2 Bb5:4 D6:4 |'
        + ' Eb6:3 Eb6:3 D6:2 C6:4 Bb5:4 | C6:3 C6:3 D6:2 Eb6:4 F6:4 | G6:6 F6:2 D6:4 Bb5:4 | A5:4 C6:4 F#6:8',
      bass: line(rootsIn(nB, 31), octBass),
      stab: stabs(nB, '..x...x...x...x.', 67),
      arp: arp(nB, '0120120120120120', 72),
      pad: hold(nB, 60),
      orch: 'Eb3!:16 | F3!:16 | .:16 | .:16 | Eb3!:16 | F3!:16 | G3!:16 | D3!:4 D3!:4 D3!:8',
      fx: '.:112 C4:16',
      drums: {
        k: 'x...x...x...x...',
        s: rep('....X.......X...', 7) + '....X...XXXXXXXX',
        c: '....x.......x...',
        h: 'xxxxxxxxxxxxxxxx',
        o: '..x...x...x...x.',
        x: hitAt(128, 0, 32, 64, 96),
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B', 'A', 'B+1'],
};

// =====================================================================
// VOLCANO — fast metal in E phrygian dominant, 172 BPM
// =====================================================================
const riffA = 'E2 E2 E2 E2 F2! - E2 E2 E2 E2 G2! - F2! - E2 E2 | E2 E2 E2 E2 F2! - E2 E2 E2 E2 G2! - F2! - E2 E2 |'
  + ' E2 E2 E2 E2 C3! - B2! - E2 E2 E2 E2 Bb2! - A2! - | E2 E2 E2 E2 E2 E2 D3! - C3! - B2! - A2! - G2! -';
const riffB = 'C2!:6 C2:2 . C2 C2 . D2!:4 | D2!:6 D2:2 . D2 D2 . E2!:4 | E2!:16 | E2 E2 E2 E2 E2 E2 E2 E2 F2! F2! F2! F2! G2! G2! G#2! G#2!';

const volcano = {
  bpm: 172,
  tracks: {
    drums: DR(0.95),
    gtr: { inst: 'guitar', vol: 0.5, rev: 0.04, pan: -0.2 },
    gtr2: { inst: 'guitar', vol: 0.35, rev: 0.04, pan: 0.3, src: 'gtr', tr: 12 },
    bass: { inst: 'sawBass', vol: 0.32, src: 'gtr', tr: -12 },
    lead: { inst: 'supersaw', vol: 0.7, rev: 0.3 },
    brass: { inst: 'brass', vol: 0.5, rev: 0.3, pan: 0.1 },
    choir: { inst: 'choir', vol: 0.4, rev: 0.5 },
    orch: { inst: 'orch', vol: 0.5, rev: 0.3 },
    fx: { inst: 'riser', vol: 0.4 },
  },
  patterns: {
    I: {
      bars: 2,
      gtr: 'E2 E2 E2 E2 F2! - E2 E2 E2 E2 G2! - F2! - E2 E2 | E2 E2 E2 E2 F2! - E2 E2 E2 E2 G2! - F2! - E2 E2',
      fx: 'C4:32',
      drums: {
        s: dots(16) + 'ooxxxxxxXXXXXXXX',
        t1: dots(24) + 'X.X.....',
        t3: dots(24) + '....X.X.',
      },
    },
    A: {
      bars: 8,
      gtr: riffA,
      lead: 'E5:2 F5:2 G#5:2 A5:2 B5:4 C6:2 B5:2 | A5:4 G#5:2 F5:2 E5:8 | C6:2 B5:2 A5:2 G#5:2 A5:4 B5:2 C6:2 | D6:4 C6:2 B5:2 G#5:4 E5:4 |'
        + ' E6:4 D6:2 C6:2 B5:4 A5:2 G#5:2 | A5:2 B5:2 C6:4 B5:2 A5:2 G#5:4 | F5:2 G#5:2 A5:2 B5:2 C6:2 D6:2 E6:4 | E6:12 .:4',
      orch: '.:48 .:6 D3!:2 C3!:2 B2!:2 A2!:2 G2!:2',
      drums: {
        k: 'xxxxxxxxxxxxxxxx',
        s: '....X.......X...',
        h: 'x.x.x.x.x.x.x.x.',
        x: hitAt(128, 0, 32, 64, 96),
      },
    },
    B: {
      bars: 8,
      gtr: riffB,
      brass: 'E5:4 G5:4 C6:8 | D6:4 C6:4 A5:8 | G#5:8 B5:8 | E6:16 | E6:4 D6:4 C6:4 G5:4 | F#5:4 A5:4 D6:8 | G#5:4 B5:4 E6:8 | F6:4 E6:4 D6:4 B5:4',
      choir: hold(['C', 'D', 'E', 'E', 'C', 'D', 'E', 'E'], 60),
      orch: 'C3!:16 | D3!:16 | E3!:16 | E3!:4 E3!:4 F3!:4 G#3!:4',
      fx: '.:112 C4:16',
      drums: {
        k: 'x.....x.x.......',
        s: '........X.......',
        h: 'x.x.x.x.x.x.x.x.',
        x: hitAt(128, 0, 16, 32, 48, 64, 80, 96, 112),
        t1: dots(120) + 'XX......',
        t2: dots(120) + '..XX....',
        t3: dots(120) + '....XXXX',
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B', 'A', 'B+1'],
};

// =====================================================================
// BOSS — relentless C harmonic minor, 170 BPM
// =====================================================================
const bA = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Fm', 'G'];
const bB = ['Ab', 'Bb', 'G', 'G', 'Ab', 'Bb', 'Bdim', 'G'];

const boss = {
  bpm: 170,
  tracks: {
    drums: DR(1),
    bass: { inst: 'fmBass', vol: 0.55, rev: 0.02 },
    ost: { inst: 'strings', vol: 0.45, rev: 0.25, pan: -0.25, gate: 0.7, opts: { attack: 0.01, release: 0.06, cutoff: 3500 } },
    choir: { inst: 'choir', vol: 0.45, rev: 0.5, pan: 0.2 },
    brass: { inst: 'brass', vol: 0.75, rev: 0.3, pan: 0.1 },
    lead: { inst: 'supersaw', vol: 0.65, rev: 0.3 },
    orch: { inst: 'orch', vol: 0.6, rev: 0.35 },
    fx: { inst: 'riser', vol: 0.45 },
  },
  patterns: {
    I: {
      bars: 4,
      choir: hold(['Cm', 'Cm', 'Ab', 'G'], 57),
      orch: 'C3!:8 .:8 | C3!:8 .:8 | Ab2!:8 .:8 | G2!:2 G2!:2 G2!:2 G2!:2 .:8',
      fx: '.:32 C4:32',
      drums: {
        k: 'x..x............',
        T: rep('X.......X.......', 3) + 'XXXXXXXXXXXXXXXX',
        s: dots(56) + 'xxxxXXXX',
      },
    },
    A: {
      bars: 8,
      ost: arp(bA, '0212021202120212', 62),
      bass: line(rootsIn(bA), 'x.x.o.x.x.x.o.x.'),
      choir: hold(bA, 57),
      brass: 'C5:4 D5:2 Eb5:2 G5:6 F5:2 | Eb5:4 F5:2 Eb5:2 C5:8 | F5:4 G5:2 Ab5:2 C6:4 Ab5:4 | B5:8 G5:4 D5:4 |'
        + ' C6:4 B5:2 C6:2 D6:4 Eb6:4 | C6:6 Bb5:2 Ab5:4 Eb5:4 | F5:3 Ab5:3 C6:2 F6:4 Eb6:4 | D6:4 B5:4 G5:4 F5:2 D5:2',
      orch: line(rootsIn(bA, 43), 'X..X..X.........'),
      drums: {
        k: 'x.x...x.x.x...x.',
        s: rep('....X.......X...', 7) + '....X...XXXXXXXX',
        h: 'xxxxxxxxxxxxxxxx',
        T: 'X.......X.......',
        x: hitAt(128, 0, 64),
      },
    },
    B: {
      bars: 8,
      ost: arp(bB, '0212021202120212', 62),
      bass: line(rootsIn(bB), 'x.x.o.x.x.x.o.x.'),
      choir: hold(bB, 57),
      lead: 'C6:6 Eb6:2 Ab6:8 | G6:6 F6:2 D6:8 | B5:4 D6:4 G6:8 | F6:2 Eb6:2 D6:2 C6:2 B5:8 |'
        + ' Ab5:4 C6:4 Eb6:4 Ab6:4 | Bb6:6 Ab6:2 G6:4 F6:4 | F6:4 D6:4 B5:4 Ab5:4 | G5:4 B5:4 D6:4 G6:4',
      orch: line(rootsIn(bB, 43), 'X..X..X...X..X..'),
      fx: '.:112 C4:16',
      drums: {
        k: 'x.x.x.x.x.x.x.x.',
        s: '....X.......X...',
        h: 'x.x.x.x.x.x.x.x.',
        T: 'X...X...X...X...',
        x: hitAt(128, 0, 32, 64, 96),
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B', 'A+1', 'B+1'],
};

// =====================================================================
// CONTINUE — ticking tension that climbs a semitone each pass, 112 BPM
// =====================================================================
const cont = {
  bpm: 112,
  tracks: {
    drums: DR(0.85),
    bass: { inst: 'sawBass', vol: 0.45 },
    pad: { inst: 'strings', vol: 0.45, rev: 0.5 },
    bell: { inst: 'bell', vol: 0.55, rev: 0.4, pan: 0.2 },
  },
  patterns: {
    A: {
      bars: 4,
      bell: 'E5:4 D5:4 C5:4 B4:4 | C5:4 B4:4 A4:8 | A4:4 C5:4 F5:8 | E5:8 G#4:8',
      pad: 'A3+C4+E4:16 | G#3+C4+E4:16 | F3+A3+C4:16 | E3+G#3+B3:16',
      bass: line(['A1', 'G#1', 'F1', 'E1'], 'x.x.x.x.x.x.x.x.'),
      drums: { k: 'x..x............', h: 'X.x.X.x.X.x.X.x.', b: 'x...x...x...x...' },
    },
  },
  intro: [],
  loop: ['A', 'A+1', 'A+2', 'A+3'],
};

// =====================================================================
// ENDING — triumphant C-major anthem, 144 BPM
// =====================================================================
const eA = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'];
const eB = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'];

const ending = {
  bpm: 144,
  tracks: {
    drums: DR(0.9),
    bass: { inst: 'fmBass', vol: 0.55 },
    brass: { inst: 'brass', vol: 0.55, rev: 0.3 },
    lead: { inst: 'supersaw', vol: 0.5, rev: 0.3 },
    pad: { inst: 'strings', vol: 0.4, rev: 0.45, pan: -0.2 },
    arp: { inst: 'pluck', vol: 0.2, rev: 0.25, pan: 0.4 },
    orch: { inst: 'orch', vol: 0.55, rev: 0.35 },
    fx: { inst: 'riser', vol: 0.4 },
  },
  patterns: {
    I: {
      bars: 2,
      orch: 'C3!:3 C3!:3 C3!:2 G2!:8 | F2!:3 F2!:3 F2!:2 G2!:8',
      pad: hold(['C', 'G'], 60),
      fx: 'C4:32',
      drums: { T: 'X..X..X.X.......X..X..X.XXXXXXXX', s: dots(24) + 'XXXXXXXX' },
    },
    A: {
      bars: 8,
      brass: 'E5:4 G5:4 C6:6 B5:2 | B5:4 A5:2 G5:2 D5:8 | C5:4 E5:4 A5:6 G5:2 | F5:8 A5:4 C6:4 |'
        + ' E6:6 D6:2 C6:4 G5:4 | B5:6 C6:2 D6:8 | A5:4 C6:4 F6:4 E6:2 D6:2 | D6:8 B5:4 G5:4',
      bass: line(rootsIn(eA), 'x.x.o.x.x.x.o.x.'),
      pad: hold(eA, 60),
      arp: arp(eA, '0120312001203120', 72),
      orch: 'C3!:16 | .:16 | .:16 | .:16 | C3!:16 | .:16 | .:16 | G2!:4 G2!:4 G2!:8',
      drums: {
        k: 'x.....x.x.....x.',
        s: rep('....X.......X...', 7) + '....X...XXXXXXXX',
        h: 'x.x.x.x.x.x.x.x.',
        x: hitAt(128, 0, 64),
      },
    },
    B: {
      bars: 8,
      lead: 'A5:6 C6:2 E6:8 | F6:6 E6:2 C6:8 | E6:4 D6:4 C6:4 G5:4 | B5:8 D6:8 | C6:4 B5:2 A5:2 E6:8 | F6:4 E6:2 D6:2 C6:8 | D6:4 E6:4 F6:4 G6:4 | G6:16',
      bass: line(rootsIn(eB), 'x.x.o.x.x.x.o.x.'),
      pad: hold(eB, 60),
      brass: stabs(eB, 'X.....X...X.....', 67),
      orch: 'A2!:16 | F2!:16 | C3!:16 | G2!:16 | A2!:16 | F2!:16 | G2!:16 | G2!:4 G2!:4 G2!:4 G2!:4',
      fx: '.:112 C4:16',
      drums: {
        k: 'x.....x.x.x...x.',
        s: rep('....X.......X...', 7) + '....X...XXXXXXXX',
        h: 'XxxxXxxxXxxxXxxx',
        x: hitAt(128, 0, 32, 64, 96),
      },
    },
  },
  intro: ['I'],
  loop: ['A', 'B', 'A+2', 'B+2'],
};

// =====================================================================
// JINGLES (one-shot)
// =====================================================================
const victory = {
  bpm: 150,
  tracks: {
    drums: DR(0.9),
    brass: { inst: 'brass', vol: 0.6, rev: 0.35 },
    lead: { inst: 'supersaw', vol: 0.45, rev: 0.35 },
    pad: { inst: 'strings', vol: 0.45, rev: 0.5 },
    bass: { inst: 'fmBass', vol: 0.5 },
    orch: { inst: 'orch', vol: 0.6, rev: 0.4 },
  },
  patterns: {
    J: {
      bars: 2,
      brass: 'G4:2 C5:2 E5:2 G5:4 E5:2 G5:4 | C6+E5+G5!:16',
      lead: '.:10 E5:2 G5:4 | C6!:16',
      pad: 'C4+E4+G4:16 | C4+E4+G4+C5:16',
      bass: 'C2:8 G1:8 | C2:16',
      orch: '.:12 G3!:2 G3!:2 | C3!:16',
      drums: {
        s: 'ooooxxxxXXXXXXXX' + dots(16),
        k: dots(16) + 'X' + dots(15),
        x: dots(16) + 'X' + dots(15),
        T: 'X.......X.......X' + dots(15),
      },
    },
  },
  intro: [],
  loop: ['J'],
};

const lose = {
  bpm: 130,
  tracks: {
    drums: DR(0.8),
    lead: { inst: 'square', vol: 0.5, rev: 0.4 },
    pad: { inst: 'strings', vol: 0.45, rev: 0.5 },
    bass: { inst: 'sawBass', vol: 0.45 },
  },
  patterns: {
    J: {
      bars: 2,
      lead: 'E5:4 D5:4 C5:4 B4:4 | A4:16',
      pad: 'A3+C4+E4:8 G#3+B3+E4:8 | A3+C4+E4:16',
      bass: 'A1:8 E1:8 | A1:16',
      drums: { T: 'X.......X.......X' + dots(15) },
    },
  },
  intro: [],
  loop: ['J'],
};

const gameover = {
  bpm: 110,
  tracks: {
    drums: DR(0.85),
    orch: { inst: 'orch', vol: 0.6, rev: 0.45 },
    choir: { inst: 'choir', vol: 0.55, rev: 0.55 },
    bell: { inst: 'bell', vol: 0.5, rev: 0.45 },
    bass: { inst: 'sawBass', vol: 0.4 },
  },
  patterns: {
    J: {
      bars: 2,
      orch: 'A2!:4 .:4 G#2!:4 .:4 | G2!:4 F#2!:4 .:4 A2!:4',
      choir: 'A3+C4+E4:8 G#3+B3+E4:8 | F3+A3+C4:8 A2+E3+A3:8',
      bell: 'E5:4 C5:4 A4:4 E4:4 | F4:8 E4:8',
      bass: 'A1:8 G#1:8 | F1:8 A1:8',
      drums: { T: 'X...X...X...X...XXXXXXXX....X...' },
    },
  },
  intro: [],
  loop: ['J'],
};

const warning = {
  bpm: 150,
  tracks: {
    drums: DR(0.95),
    siren: { inst: 'square', vol: 0.5, rev: 0.3, gate: 0.98 },
    orch: { inst: 'orch', vol: 0.6, rev: 0.35 },
    choir: { inst: 'choir', vol: 0.45, rev: 0.5 },
  },
  patterns: {
    J: {
      bars: 2,
      siren: 'A5:4 E5:4 A5:4 E5:4 | A5:4 E5:4 A5:4 E5:4',
      orch: 'A2!:4 A2!:4 A2!:4 A2!:4 | Bb2!:4 Bb2!:4 Bb2!:4 Bb2!:4',
      choir: 'A3+C4+E4:16 | Bb3+D4+F4:16',
      drums: {
        T: 'X...X...X...X...X...X...X...X...',
        t1: 'X.X.X.X.X.X.X.X.' + dots(16),
        t3: dots(16) + 'X.X.X.X.XXXXXXXX',
        x: dots(16) + 'X' + dots(15),
      },
    },
  },
  intro: [],
  loop: ['J'],
};

const stageclear = {
  bpm: 160,
  tracks: {
    drums: DR(0.9),
    arp: { inst: 'pluck', vol: 0.45, rev: 0.3 },
    brass: { inst: 'brass', vol: 0.55, rev: 0.35 },
    pad: { inst: 'strings', vol: 0.4, rev: 0.5 },
    orch: { inst: 'orch', vol: 0.5, rev: 0.4 },
  },
  patterns: {
    J: {
      bars: 2,
      arp: 'C5 E5 G5 C6 E5 G5 C6 E6 G5 C6 E6 G6 C6 E6 G6 C7 | .:16',
      brass: '.:16 | C5+E5+G5+C6!:16',
      pad: 'C4+E4+G4:16 | C4+E4+G4:16',
      orch: '.:16 | C3!:16',
      drums: { s: dots(12) + 'XXXX' + dots(16), x: dots(16) + 'X' + dots(15), k: dots(16) + 'X' + dots(15) },
    },
  },
  intro: [],
  loop: ['J'],
};

export const SONGS = { title, select, temple, neon, volcano, boss, continue: cont, ending };
export const JINGLES = { victory, lose, gameover, warning, stageclear };
