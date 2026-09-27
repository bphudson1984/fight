// Every fighter in the game, and how each one is unlocked.
//
// unlock.type:
//   free   – available from the start (badge shows its "home" table)
//   table  – master these tables (clear Arcade with them selected, 80%+ right)
//   diff   – clear Arcade on this difficulty (or a harder one)
//   top    – clear Arcade on Legend with all 12 tables selected
//   clear  – clear Arcade once (the boss)

export const ROSTER = [
  // ---------------------------------------------------------------- starters
  {
    id: 'kai', name: 'KAI', style: 'Karate', unlock: { type: 'free', table: 1 },
    voice: { pitch: 200, formant: 1.0 },
    skin: 0xe0a476, hair: 0x1b1712, top: 0xf0ede4, sleeve: 0xf0ede4, bottom: 0xf0ede4,
    shin: 0xf0ede4, belt: 0x151515, glove: 0xc42a2a, shoe: 0xd89a6c, hairStyle: 'spiky',
    band: 0xc42a2a, build: 1.0, gi: true,
    aura: 0xff4a1a, special: 'TIMES TABLE TYPHOON', stats: [4, 4, 4], color: '#ff4a1a',
  },
  {
    id: 'luna', metalColors: [0xffd23f], name: 'LUNA', style: 'Kickboxing', unlock: { type: 'free', table: 2 },
    voice: { pitch: 330, formant: 1.18 },
    skin: 0xf2c6a0, hair: 0x7a2fb0, top: 0x23b7ac, sleeve: 0xf2c6a0, bottom: 0x232a52,
    shin: 0xf2c6a0, belt: 0xffd23f, glove: 0xf4f4f4, shoe: 0xf4f4f4, hairStyle: 'ponytail',
    build: 0.88,
    aura: 0x20e0ff, special: 'LUNAR LONG DIVISION', stats: [3, 5, 4], color: '#20e0ff',
  },
  {
    id: 'brick', metalColors: [0xf2c230], name: 'BRICK', style: 'Wrestling', unlock: { type: 'free', table: 5 },
    voice: { pitch: 118, formant: 0.88 },
    skin: 0x8a5634, hair: 0x2a1a10, top: 0x8a5634, sleeve: 0x8a5634, bottom: 0x2f8a3a,
    shin: 0x1e1e1e, belt: 0xf2c230, glove: 0x2a2a2a, shoe: 0x1e1e1e, hairStyle: 'bald',
    band: 0xf2c230, strap: 0x2f8a3a, build: 1.2,
    aura: 0x6aff2a, special: 'PRIME POWERBOMB', stats: [5, 2, 3], color: '#6aff2a',
  },
  {
    id: 'zed', name: 'ZED', style: 'Ninjutsu', unlock: { type: 'free', table: 10 },
    voice: { pitch: 165, formant: 0.97 },
    skin: 0xcaa07a, hair: 0x14141c, top: 0x23398f, sleeve: 0x23398f, bottom: 0x151a33,
    shin: 0x151a33, belt: 0xd8342c, glove: 0x14141c, shoe: 0x14141c, hairStyle: 'mask',
    band: 0xd8342c, build: 0.95, scarf: true,
    aura: 0xb040ff, special: 'SHADOW SQUARE ROOT', stats: [3, 5, 5], color: '#b040ff',
  },

  // ---------------------------------------------------------------- table masters
  {
    id: 'triple', metalColors: [0xffd23f], name: 'EL TRIPLE', style: 'Lucha Libre', unlock: { type: 'table', tables: [3] },
    voice: { pitch: 150, formant: 0.95 },
    skin: 0xc98a5a, hair: 0xff2a6a, mask: 0xff2a6a, trim: 0xffd23f,
    top: 0xc98a5a, sleeve: 0xc98a5a, bottom: 0x1a3aff, shin: 0xe0102a, belt: 0xffd23f,
    glove: 0xf4f4f4, shoe: 0xe0102a, hairStyle: 'luchador', face: 'luchador', build: 1.1,
    extras: ['cape'], cape: 0xff2a6a,
    aura: 0xff2a6a, special: 'TRIPLE LUCHA LARIAT', stats: [4, 3, 4], color: '#ff2a6a',
  },
  {
    id: 'volt', metalColors: [0xb0b0b0, 0xd0d0d8], name: 'VOLT', style: 'Electro Punk', unlock: { type: 'table', tables: [4] },
    voice: { pitch: 210, formant: 1.0 },
    skin: 0xf0c8a8, hair: 0x9aff00, top: 0x151518, sleeve: 0xf0c8a8, bottom: 0x2a3a6a,
    shin: 0x2a3a6a, belt: 0xb0b0b0, glove: 0x9aff00, shoe: 0x222222, hairStyle: 'mohawk', face: 'volt',
    build: 0.95, extras: ['glowhands', 'studs'], glowColor: 0xb0ff20,
    aura: 0x9aff00, special: 'FOUR-VOLT FRENZY', stats: [3, 5, 3], color: '#9aff00',
  },
  {
    id: 'hex', name: 'HEX', style: 'Sorcery', unlock: { type: 'table', tables: [6] },
    voice: { pitch: 300, formant: 1.12 },
    skin: 0xe8d0c8, hair: 0x3a1060, top: 0x2a0a4a, sleeve: 0x2a0a4a, bottom: 0x1a0630,
    shin: 0x1a0630, belt: 0xc0a0ff, glove: 0x2a0a4a, shoe: 0x111111, hairStyle: 'hood', face: 'hex',
    build: 0.9, extras: ['glowhands', 'robe'], glowColor: 0xd040ff,
    aura: 0xd040ff, special: 'HEXAGON HEX', stats: [4, 4, 5], color: '#d040ff',
  },
  {
    id: 'ace', metalColors: [0xffd23f, 0xfff0a0], name: 'ACE', style: 'Boxing', unlock: { type: 'table', tables: [7] },
    voice: { pitch: 130, formant: 0.92 },
    skin: 0x5a3a28, hair: 0x111111, top: 0x5a3a28, sleeve: 0x5a3a28, bottom: 0xffc020,
    shin: 0x5a3a28, belt: 0xffd23f, glove: 0xd01010, shoe: 0xf0f0f0, hairStyle: 'flattop', face: 'shades',
    build: 1.1, extras: ['bigGloves', 'champBelt', 'shades'],
    aura: 0xffd23f, special: 'LUCKY SEVEN KNOCKOUT', stats: [5, 4, 2], color: '#ffd23f',
  },
  {
    id: 'kraken', metalColors: [0xc09030], name: 'KRAKEN', style: 'Pirate Brawl', unlock: { type: 'table', tables: [8] },
    voice: { pitch: 110, formant: 0.88 },
    skin: 0xb07a50, hair: 0x2a1a0a, band: 0x1a60a0, top: 0x7a1a1a, sleeve: 0x7a1a1a, bottom: 0x2a2a2a,
    shin: 0x3a2010, belt: 0xc09030, glove: 0x3a2010, shoe: 0x3a2010, hairStyle: 'dreads', face: 'eyepatch',
    build: 1.2, extras: ['coat', 'eyepatch'],
    aura: 0x20c0a0, special: 'EIGHT-ARM ARMADA', stats: [5, 2, 4], color: '#20c0a0',
  },
  {
    id: 'kitsune', name: 'KITSUNE', style: 'Fox Ninjutsu', unlock: { type: 'table', tables: [9] },
    voice: { pitch: 340, formant: 1.18 },
    skin: 0xf4d4b8, hair: 0xff7a20, top: 0xf4f0ea, sleeve: 0xf4f0ea, bottom: 0xc01830,
    shin: 0xc01830, belt: 0x222222, glove: 0x222222, shoe: 0x222222, hairStyle: 'foxears', face: 'fox',
    build: 0.86, extras: ['foxtails'],
    aura: 0xff8a20, special: 'NINE-TAIL NOVA', stats: [3, 5, 4], color: '#ff8a20',
  },
  {
    id: 'titan', metalColors: [0xb07a30], name: 'TITAN', style: 'Gladiator', unlock: { type: 'table', tables: [11, 12] },
    voice: { pitch: 95, formant: 0.85 },
    skin: 0xc08a60, hair: 0xb07a30, helmet: 0xb07a30, crest: 0xd01818, top: 0xc08a60, sleeve: 0xc08a60,
    bottom: 0x6a4020, shin: 0xb07a30, belt: 0x5a3a1a, glove: 0xb07a30, shoe: 0x5a3a1a,
    hairStyle: 'helmet', face: 'titan', build: 1.35, strap: 0x5a3a1a, extras: ['shoulderArmor', 'pteruges'], armor: 0xb07a30,
    aura: 0xff5a10, special: 'TWELVE LABOURS', stats: [5, 3, 4], color: '#ff5a10',
  },

  // ---------------------------------------------------------------- difficulty champions
  {
    id: 'rex', name: 'REX', style: 'Dino Style', unlock: { type: 'diff', diff: 'rookie' },
    voice: { pitch: 250, formant: 1.1 },
    skin: 0xf0c090, hair: 0x4ac040, top: 0x4ac040, sleeve: 0x4ac040, bottom: 0x4ac040,
    shin: 0x4ac040, belt: 0xf0e060, glove: 0x3aa030, shoe: 0x2a8a30, hairStyle: 'dinohood', face: 'dino',
    build: 1.0, extras: ['dinotail', 'belly'],
    aura: 0x6aff40, special: 'JURASSIC JUGGLE', stats: [3, 3, 3], color: '#6aff40',
  },
  {
    id: 'blaze', name: 'BLAZE', style: 'Fire Fist', unlock: { type: 'diff', diff: 'fighter' },
    voice: { pitch: 190, formant: 1.0 },
    skin: 0xe8b890, hair: 0xff4a00, top: 0xc41a10, sleeve: 0xe8b890, bottom: 0x1a1a1a,
    shin: 0x1a1a1a, belt: 0xffa020, glove: 0x2a1a10, shoe: 0x222222, hairStyle: 'flame', face: 'blaze',
    build: 1.0, extras: ['glowhands'], glowColor: 0xff7a10,
    aura: 0xff6a00, special: 'INFERNO INFINITY', stats: [5, 4, 3], color: '#ff6a00',
  },
  {
    id: 'frost', name: 'FROST', style: 'Ice Queen', unlock: { type: 'diff', diff: 'champion' },
    voice: { pitch: 310, formant: 1.15 },
    skin: 0xe8f0ff, hair: 0xf0f8ff, top: 0x8ad8ff, sleeve: 0xc0e8ff, bottom: 0x2a5aa0,
    shin: 0x8ad8ff, belt: 0xf0f8ff, glove: 0xc0e8ff, shoe: 0x2a5aa0, hairStyle: 'long', face: 'frost',
    build: 0.9, extras: ['iceSpikes', 'tiara'],
    aura: 0x60e0ff, special: 'ABSOLUTE ZERO', stats: [4, 4, 5], color: '#60e0ff',
  },
  {
    id: 'ronin', metalColors: [0xe8c030], name: 'RONIN', style: 'Samurai', unlock: { type: 'diff', diff: 'legend' },
    voice: { pitch: 140, formant: 0.92 },
    skin: 0xd8a878, hair: 0x151515, top: 0x7a1010, sleeve: 0x2a2a2a, bottom: 0x1a1a2a,
    shin: 0x7a1010, belt: 0xe8c030, glove: 0x2a2a2a, shoe: 0x111111, hairStyle: 'kabuto', face: 'ronin',
    build: 1.1, extras: ['samuraiArmor', 'katana'], armor: 0x7a1010, trim: 0xe8c030,
    aura: 0xff2020, special: 'BUSHIDO BLITZ', stats: [5, 5, 4], color: '#ff2020',
  },

  // ---------------------------------------------------------------- the top secret
  {
    id: 'nyx', metalColors: [0x8a8a90, 0xd0d0d8], name: 'NYX', style: 'Midnight Emo', unlock: { type: 'top' },
    voice: { pitch: 380, formant: 1.22 },
    skin: 0xfbe0d8, hair: 0x151018, streak: 0xff4aa8, top: 0x1a1620, sleeve: 0x1a1620, bottom: 0x151018,
    shin: 0x151018, belt: 0x8a8a90, glove: 0x1a1620, shoe: 0x0a0a0a, hairStyle: 'emo', face: 'emo',
    build: 0.82, extras: ['skirt', 'heart', 'choker', 'starClip', 'bigBoots'],
    patterns: { shin: [0x151018, 0xff4aa8], forearm: [0x151018, 0xff4aa8], skirt: [0x151018, 0xb0102a] },
    aura: 0xff2ea6, special: 'BROKEN HEART BARRAGE', stats: [5, 5, 5], color: '#ff2ea6',
  },
];

export const BOSS = {
  id: 'omega', name: 'OMEGA', style: 'Calculator Supreme', unlock: { type: 'clear' },
  voice: { pitch: 88, formant: 0.8 },
  skin: 0xb8c0cc, hair: 0x2a2e3a, top: 0xc9ced8, sleeve: 0x9aa2b0, bottom: 0x3a3f4d,
  shin: 0xc9ced8, belt: 0xe8b020, glove: 0xe8b020, shoe: 0x2a2e3a, hairStyle: 'crest',
  band: 0xe8b020, build: 1.32, boss: true,
  aura: 0xff1030, special: 'OMEGA OVERFLOW', stats: [5, 5, 5], color: '#ff1030',
};

export const ALL_FIGHTERS = [...ROSTER, BOSS];

const DIFF_NAMES = { rookie: 'ROOKIE', fighter: 'FIGHTER', champion: 'CHAMPION', legend: 'LEGEND' };

/** Short label for the select-screen badge. */
export function unlockBadge(def) {
  const u = def.unlock;
  if (u.type === 'free') return `×${u.table}`;
  if (u.type === 'table') return u.tables.map((t) => `×${t}`).join(' ');
  if (u.type === 'diff') return DIFF_NAMES[u.diff];
  if (u.type === 'top') return '★ ALL ★';
  return 'BOSS';
}

/** Sentence explaining how to unlock. */
export function unlockText(def) {
  const u = def.unlock;
  if (u.type === 'free') return `Starter fighter – the ×${u.table} table`;
  if (u.type === 'table') {
    const t = u.tables.map((x) => `×${x}`).join(' and ');
    return `MASTER THE ${t} TABLE${u.tables.length > 1 ? 'S' : ''}: clear Arcade with ${t} selected and get 80%+ of ${u.tables.length > 1 ? 'those' : 'its'} questions right`;
  }
  if (u.type === 'diff') return `Clear Arcade on ${DIFF_NAMES[u.diff]} difficulty (or harder)`;
  if (u.type === 'top') return 'The ultimate test: clear Arcade on LEGEND with ALL 12 tables selected';
  return 'Clear Arcade mode';
}
