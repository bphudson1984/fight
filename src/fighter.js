// Low-poly articulated fighter with keyframed poses and 2-bone leg IK.
// Local space: fighter faces +z, up is +y, its left side is +x.
import * as THREE from 'three';
import { lambert, canvasTexture } from './ps1.js';

import { ROSTER, BOSS } from './roster.js';

export { ROSTER, BOSS };

// ---------------------------------------------------------------- poses

const KEYS = [
  ['pos', 3], ['hipY', 1], ['pelvis', 3], ['spine', 3], ['neck', 3],
  ['shL', 3], ['elL', 3], ['shR', 3], ['elR', 3],
  ['hipL', 3], ['knL', 3], ['hipR', 3], ['knR', 3],
  ['footL', 3], ['footR', 3], ['ikL', 1], ['ikR', 1], ['spin', 1],
];
const OFF = {};
let SIZE = 0;
for (const [k, s] of KEYS) { OFF[k] = SIZE; SIZE += s; }

const GUARD = {
  pos: [0, 0, 0], hipY: 0.93,
  pelvis: [0, -0.35, 0], spine: [0.12, 0.2, 0], neck: [-0.08, 0.15, 0],
  shL: [-0.75, 0, 0.3], elL: [-2.0, 0, 0],
  shR: [-0.45, 0, -0.35], elR: [-2.35, 0, 0],
  hipL: [-0.3, 0, 0], knL: [0.5, 0, 0], hipR: [0.3, 0, 0], knR: [0.4, 0, 0],
  footL: [0.13, 0.06, 0.3], footR: [-0.13, 0.06, -0.3], ikL: 1, ikR: 1, spin: 0,
};

function pose(partial = {}) {
  const a = new Float32Array(SIZE);
  for (const [k, s] of KEYS) {
    let v = partial[k] ?? GUARD[k];
    if (typeof v === 'number') v = [v];
    for (let i = 0; i < s; i++) a[OFF[k] + i] = v[i];
  }
  return a;
}

const K = (d, p = {}, opts = {}) => ({ d, pose: pose(p), ...opts });

// Reusable pose fragments
const LYING = {
  hipY: 0.14, pelvis: [-1.52, 0, 0], spine: [0.05, 0, 0], neck: [0.2, 0.3, 0],
  shL: [-0.2, 0, 1.3], elL: [-0.5, 0, 0], shR: [-0.2, 0, -1.2], elR: [-0.4, 0, 0],
  hipL: [-0.15, 0, 0.15], knL: [0.25, 0, 0], hipR: [-0.35, 0, -0.1], knR: [0.7, 0, 0],
  ikL: 0, ikR: 0,
};
const JAB = { spine: [0.3, -0.45, 0], shL: [-1.62, 0, 0.05], elL: [-0.05, 0, 0], neck: [-0.15, 0.4, 0] };
const CROSS = {
  pelvis: [0, 0.15, 0], spine: [0.3, 0.55, 0], neck: [-0.2, -0.5, 0],
  shR: [-1.62, 0, -0.05], elR: [-0.05, 0, 0], shL: [-0.5, 0, 0.45], elL: [-2.3, 0, 0],
};
const CHAMBER = {
  hipY: 0.95, ikR: 0, hipR: [-1.35, 0, -0.1], knR: [2.1, 0, 0], spine: [-0.05, 0.1, 0],
  footL: [0.05, 0.06, 0.0],
};
const KICK = {
  hipY: 0.96, ikR: 0, hipR: [-1.6, 0, -0.1], knR: [0.05, 0, 0], spine: [-0.3, 0.2, 0],
  footL: [0.05, 0.06, -0.05], shL: [-1.0, 0, 0.6], elL: [-1.6, 0, 0], shR: [0.3, 0, -0.6],
};
const FLAIL = { shL: [-0.3, 0, 0.9], elL: [-0.6, 0, 0], shR: [-0.2, 0, -0.9], elR: [-0.5, 0, 0] };

const ANIMS = {
  jab: [
    K(0.15, { pos: [0, 0, 0.62], spine: [0.2, 0.3, 0] }),
    K(0.07, { pos: [0, 0, 0.78], ...JAB }, { hit: 'high', ease: 'out' }),
    K(0.12, { pos: [0, 0, 0.78], ...JAB }),
    K(0.28),
  ],
  cross: [
    K(0.15, { pos: [0, 0, 0.6], spine: [0.2, -0.2, 0] }),
    K(0.08, { pos: [0, 0, 0.8], ...CROSS }, { hit: 'high', ease: 'out' }),
    K(0.14, { pos: [0, 0, 0.8], ...CROSS }),
    K(0.3),
  ],
  kick: [
    K(0.14, { pos: [0, 0, 0.5] }),
    K(0.12, { pos: [0, 0, 0.6], ...CHAMBER }),
    K(0.07, { pos: [0, 0, 0.72], ...KICK }, { hit: 'mid', ease: 'out' }),
    K(0.14, { pos: [0, 0, 0.72], ...KICK }),
    K(0.1, { pos: [0, 0, 0.6], ...CHAMBER }),
    K(0.3),
  ],
  uppercut: [
    K(0.22, {
      pos: [0, 0, 0.55], hipY: 0.72, spine: [0.5, 0.45, 0], shR: [-0.2, 0, -0.25], elR: [-2.4, 0, 0],
      hipL: [-0.6, 0, 0], hipR: [0.2, 0, 0],
    }),
    K(0.1, {
      pos: [0, 0.25, 0.8], hipY: 1.0, spine: [-0.2, 0.55, 0], neck: [-0.3, -0.3, 0],
      shR: [-2.75, 0, -0.1], elR: [-0.35, 0, 0], shL: [-0.2, 0, 0.5], elL: [-1.8, 0, 0],
      ikL: 0.3, ikR: 0, hipR: [0.4, 0, 0], knR: [1.2, 0, 0],
    }, { hit: 'launch', ease: 'out' }),
    K(0.3, {
      pos: [0, 0.1, 0.8], hipY: 1.0, spine: [-0.2, 0.55, 0], neck: [-0.3, -0.3, 0],
      shR: [-2.9, 0, -0.1], elR: [-0.2, 0, 0], shL: [-0.2, 0, 0.5], elL: [-1.8, 0, 0],
    }),
    K(0.35),
  ],
  combo: [
    K(0.14, { pos: [0, 0, 0.62], spine: [0.2, 0.3, 0] }),
    K(0.07, { pos: [0, 0, 0.78], ...JAB }, { hit: 'high', ease: 'out' }),
    K(0.07, { pos: [0, 0, 0.78], ...JAB }),
    K(0.08, { pos: [0, 0, 0.72] }),
    K(0.08, { pos: [0, 0, 0.82], ...CROSS }, { hit: 'high', ease: 'out' }),
    K(0.08, { pos: [0, 0, 0.82], ...CROSS }),
    K(0.1, { pos: [0, 0, 0.62], ...CHAMBER }),
    K(0.07, { pos: [0, 0, 0.74], ...KICK }, { hit: 'mid', ease: 'out' }),
    K(0.14, { pos: [0, 0, 0.74], ...KICK }),
    K(0.1, { pos: [0, 0, 0.6], ...CHAMBER }),
    K(0.3),
  ],
  hitHigh: [
    K(0.06, { pos: [0, 0, -0.18], neck: [-0.6, 0.4, 0], spine: [-0.35, -0.3, 0], ...FLAIL, hipY: 0.9 }, { ease: 'out' }),
    K(0.22, { pos: [0, 0, -0.3], neck: [-0.3, 0.2, 0], spine: [-0.15, 0, 0], hipY: 0.9 }),
    K(0.35),
  ],
  hitMid: [
    K(0.06, { pos: [0, 0, -0.2], spine: [0.65, 0, 0], neck: [0.3, 0, 0], ...FLAIL, hipY: 0.85 }, { ease: 'out' }),
    K(0.25, { pos: [0, 0, -0.35], spine: [0.45, 0, 0], neck: [0.2, 0, 0], hipY: 0.86 }),
    K(0.35),
  ],
  launch: [
    K(0.12, { pos: [0, 0.6, -0.3], pelvis: [-0.5, 0, 0], neck: [-0.6, 0, 0], ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.2, 0, 0], knL: [0.6, 0, 0], hipR: [0.2, 0, 0], knR: [0.4, 0, 0] }, { ease: 'out' }),
    K(0.35, { pos: [0, 1.3, -0.8], pelvis: [-1.3, 0, 0], neck: [-0.4, 0, 0], ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.5, 0, 0], knL: [0.9, 0, 0], hipR: [-0.1, 0, 0], knR: [0.4, 0, 0] }, { ease: 'out' }),
    K(0.3, { pos: [0, 0, -1.3], ...LYING }, { ease: 'in', land: true }),
    K(0.12, { pos: [0, 0, -1.3], ...LYING, hipY: 0.22 }),
    K(0.12, { pos: [0, 0, -1.3], ...LYING }),
    K(0.45, { pos: [0, 0, -1.3], ...LYING }),
    K(0.3, { pos: [0, 0, -1.1], hipY: 0.55, pelvis: [0.3, 0, 0], spine: [0.5, 0, 0], shL: [-0.4, 0, 0.3], elL: [-0.4, 0, 0], shR: [-0.4, 0, -0.3], elR: [-0.4, 0, 0], footL: [0.13, 0.06, 0.25], footR: [-0.13, 0.06, -0.35] }),
    K(0.4),
  ],
  ko: [
    K(0.1, { pos: [0, 0.2, -0.35], pelvis: [-0.45, 0, 0], neck: [-0.7, 0.3, 0], ...FLAIL, ikL: 0.3, ikR: 0.3 }, { ease: 'out' }),
    K(0.5, { pos: [0, 0, -1.3], ...LYING }, { ease: 'in', land: true }),
    K(0.14, { pos: [0, 0, -1.3], ...LYING, hipY: 0.24, pelvis: [-1.4, 0, 0] }),
    K(0.14, { pos: [0, 0, -1.3], ...LYING }),
  ],
  victory: [
    K(0.35, {
      hipY: 0.98, pelvis: [0, -0.1, 0], spine: [-0.1, 0.1, 0], neck: [-0.25, 0, 0],
      shR: [-3.0, 0, -0.25], elR: [-0.25, 0, 0], shL: [-0.3, 0, 0.35], elL: [-2.2, 0, 0],
      footL: [0.16, 0.06, 0.1], footR: [-0.16, 0.06, -0.1],
    }),
  ],
  taunt: [
    K(0.25, { shL: [-1.3, 0, 0.1], elL: [-1.0, 0, 0], neck: [0.1, 0.2, 0] }),
    K(0.15, { shL: [-1.3, 0, 0.1], elL: [-1.8, 0, 0], neck: [0.1, 0.2, 0] }),
    K(0.15, { shL: [-1.3, 0, 0.1], elL: [-1.0, 0, 0], neck: [0.1, 0.2, 0] }),
    K(0.15, { shL: [-1.3, 0, 0.1], elL: [-1.8, 0, 0], neck: [0.1, 0.2, 0] }),
    K(0.3),
  ],
  elbow: [
    K(0.12, { pos: [0, 0, 0.7], spine: [0.2, 0.35, 0] }),
    K(0.07, { pos: [0, 0, 0.9], spine: [0.35, -0.7, 0], shL: [-1.4, 0, 1.2], elL: [-2.6, 0, 0], neck: [-0.1, 0.5, 0] }, { hit: 'high', ease: 'out' }),
    K(0.12, { pos: [0, 0, 0.9], spine: [0.35, -0.7, 0], shL: [-1.4, 0, 1.2], elL: [-2.6, 0, 0], neck: [-0.1, 0.5, 0] }),
    K(0.26),
  ],
  knee: [
    K(0.12, { pos: [0, 0, 0.55], hipY: 0.85 }),
    K(0.09, {
      pos: [0, 0.35, 0.85], hipY: 0.95, ikR: 0, ikL: 0.2, hipR: [-1.9, 0, 0], knR: [2.3, 0, 0],
      spine: [0.1, 0.2, 0], shL: [-1.2, 0, 0.3], elL: [-1.6, 0, 0], shR: [-1.2, 0, -0.3], elR: [-1.6, 0, 0],
    }, { hit: 'mid', ease: 'out' }),
    K(0.14, {
      pos: [0, 0.2, 0.85], hipY: 0.95, ikR: 0, hipR: [-1.7, 0, 0], knR: [2.3, 0, 0],
      shL: [-1.2, 0, 0.3], elL: [-1.6, 0, 0], shR: [-1.2, 0, -0.3], elR: [-1.6, 0, 0],
    }),
    K(0.28),
  ],
  sweep: [
    K(0.1, { pos: [0, 0, 0.55], hipY: 0.55, spine: [0.5, 0, 0] }),
    K(0.14, {
      pos: [0, 0, 0.6], hipY: 0.42, spin: 3.3, spine: [0.6, 0, 0], ikR: 0, hipR: [-1.45, 0, -0.3], knR: [0.1, 0, 0],
      shL: [-0.6, 0, 1.0], shR: [-0.6, 0, -1.0], footL: [0.05, 0.06, 0.05],
    }, { hit: 'mid', ease: 'out' }),
    K(0.14, { pos: [0, 0, 0.6], hipY: 0.5, spin: 6.283, spine: [0.5, 0, 0] }),
    K(0.26, { spin: 6.283 }),
  ],
  spinKick: [
    K(0.12, { pos: [0, 0, 0.6], hipY: 0.85, spine: [0.2, 0.4, 0] }),
    K(0.12, { pos: [0, 0.3, 0.75], spin: 3.6, ...CHAMBER }),
    K(0.08, { pos: [0, 0.4, 0.85], spin: 6.283, ...KICK, hipR: [-2.0, 0, -0.1] }, { hit: 'launch', ease: 'out' }),
    K(0.22, { pos: [0, 0.2, 0.85], spin: 6.283, ...KICK, hipR: [-2.0, 0, -0.1] }),
    K(0.3, { spin: 6.283 }),
  ],
  rushL: [
    K(0.05, { pos: [0, 0, 0.8], ...JAB }, { hit: 'high', ease: 'out' }),
    K(0.07, { pos: [0, 0, 0.76], spine: [0.25, 0, 0] }),
  ],
  rushR: [
    K(0.05, { pos: [0, 0, 0.82], ...CROSS }, { hit: 'high', ease: 'out' }),
    K(0.07, { pos: [0, 0, 0.76], spine: [0.25, 0, 0] }),
  ],
  rushKick: [
    K(0.06, { pos: [0, 0, 0.7], ...CHAMBER }),
    K(0.05, { pos: [0, 0, 0.78], ...KICK }, { hit: 'mid', ease: 'out' }),
    K(0.08, { pos: [0, 0, 0.76], spine: [0.25, 0, 0] }),
  ],
  recover: [K(0.3)],
  charge: [
    K(0.18, { hipY: 0.75, spine: [0.35, 0, 0], neck: [-0.4, 0, 0], shL: [-0.5, 0, 1.2], elL: [-1.2, 0, 0], shR: [-0.5, 0, -1.2], elR: [-1.2, 0, 0], footL: [0.2, 0.06, 0.2], footR: [-0.2, 0.06, -0.2] }),
    K(0.35, { hipY: 0.8, spine: [-0.3, 0, 0], neck: [-0.6, 0, 0], shL: [-0.3, 0, 1.6], elL: [-0.4, 0, 0], shR: [-0.3, 0, -1.6], elR: [-0.4, 0, 0], footL: [0.2, 0.06, 0.2], footR: [-0.2, 0.06, -0.2] }),
    K(0.2),
  ],
  block: [
    K(0.06, { pos: [0, 0, -0.12], hipY: 0.86, spine: [0.3, 0, 0], shL: [-1.6, 0, -0.2], elL: [-2.2, 0, 0], shR: [-1.6, 0, 0.2], elR: [-2.2, 0, 0] }, { ease: 'out' }),
    K(0.3, { pos: [0, 0, -0.2], hipY: 0.86, spine: [0.3, 0, 0], shL: [-1.6, 0, -0.2], elL: [-2.2, 0, 0], shR: [-1.6, 0, 0.2], elR: [-2.2, 0, 0] }),
    K(0.25),
  ],
  hitHeavy: [
    K(0.07, { pos: [0, 0.1, -0.35], neck: [-0.8, 0.5, 0], spine: [-0.5, -0.4, 0], ...FLAIL, hipY: 0.88 }, { ease: 'out' }),
    K(0.3, { pos: [0, 0, -0.75], neck: [-0.3, 0.2, 0], spine: [-0.2, 0, 0], hipY: 0.84, ...FLAIL }),
    K(0.35),
  ],
  juggle: [
    K(0.1, { pos: [0, 1.3, -1.0], pelvis: [-1.1, 0, 0], neck: [-0.6, 0, 0], ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.5, 0, 0], knL: [0.9, 0, 0], hipR: [-0.1, 0, 0], knR: [0.4, 0, 0] }, { ease: 'out' }),
    K(0.28, { pos: [0, 1.45, -1.2], pelvis: [-1.35, 0, 0], neck: [-0.4, 0, 0], ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.5, 0, 0], knL: [0.9, 0, 0], hipR: [-0.1, 0, 0], knR: [0.4, 0, 0] }, { ease: 'out' }),
    K(0.32, { pos: [0, 0, -1.5], ...LYING }, { ease: 'in', land: true }),
    K(0.12, { pos: [0, 0, -1.5], ...LYING, hipY: 0.22 }),
    K(0.12, { pos: [0, 0, -1.5], ...LYING }),
    K(0.35, { pos: [0, 0, -1.5], ...LYING }),
    K(0.25, { pos: [0, 0, -1.2], hipY: 0.55, pelvis: [0.3, 0, 0], spine: [0.5, 0, 0], shL: [-0.4, 0, 0.3], elL: [-0.4, 0, 0], shR: [-0.4, 0, -0.3], elR: [-0.4, 0, 0], footL: [0.13, 0.06, 0.25], footR: [-0.13, 0.06, -0.35] }),
    K(0.35),
  ],
  victory2: [
    K(0.35, {
      hipY: 0.98, pelvis: [0, 0.2, 0], spine: [-0.05, -0.2, 0], neck: [-0.15, -0.3, 0],
      shL: [-1.2, 0, -0.5], elL: [-2.0, 0, 0], shR: [-1.2, 0, 0.5], elR: [-2.0, 0, 0],
      footL: [0.18, 0.06, 0.05], footR: [-0.18, 0.06, -0.05],
    }),
  ],
  victory3: [
    K(0.3, { hipY: 0.9, spine: [0.1, 0, 0], shL: [-1.4, 0, 0.9], elL: [-1.2, 0, 0], shR: [-1.4, 0, -0.9], elR: [-1.2, 0, 0], footL: [0.2, 0.06, 0.1], footR: [-0.2, 0.06, -0.1] }),
    K(0.25, { hipY: 0.98, spine: [-0.3, 0, 0], neck: [-0.5, 0, 0], shL: [-2.9, 0, 0.4], elL: [-0.2, 0, 0], shR: [-2.9, 0, -0.4], elR: [-0.2, 0, 0], footL: [0.2, 0.06, 0.1], footR: [-0.2, 0.06, -0.1] }),
  ],
  lose: [
    K(0.5, {
      hipY: 0.55, pelvis: [0.2, 0, 0], spine: [0.7, 0, 0], neck: [0.5, 0, 0],
      shL: [-0.4, 0, 0.2], elL: [-0.6, 0, 0], shR: [-0.2, 0, -0.1], elR: [-0.2, 0, 0],
      footL: [0.14, 0.06, 0.35], footR: [-0.14, 0.06, -0.35],
    }),
  ],
};
// ---- finisher / death animations (all held on their last frame)
const FACEDOWN = {
  hipY: 0.15, pelvis: [1.5, 0, 0], spine: [0.05, 0, 0], neck: [-0.3, 0.6, 0],
  shL: [-2.7, 0, 0.7], elL: [-0.4, 0, 0], shR: [-2.6, 0, -0.5], elR: [-0.9, 0, 0],
  hipL: [0.1, 0, 0.12], knL: [0.25, 0, 0], hipR: [0.05, 0, -0.1], knR: [0.9, 0, 0], ikL: 0, ikR: 0,
};
Object.assign(ANIMS, {
  decapBody: [
    K(0.1, { pos: [0, 0, -0.15], neck: [-0.9, 0, 0], spine: [-0.3, 0, 0], ...FLAIL, hipY: 0.9 }, { ease: 'out' }),
    K(0.55, { pos: [0, 0, -0.25], spine: [0.1, 0.3, 0.1], neck: [-0.2, 0, 0], shL: [-0.9, 0, 0.9], elL: [-0.4, 0, 0], shR: [-1.1, 0, -0.9], elR: [-0.6, 0, 0], hipY: 0.9 }),
    K(0.3, { pos: [0, 0, -0.2], spine: [-0.1, -0.2, -0.1], shL: [-0.5, 0, 1.2], elL: [-0.2, 0, 0], shR: [-0.4, 0, -1.2], elR: [-0.2, 0, 0], hipY: 0.88 }),
    K(0.4, { pos: [0, 0, 0], hipY: 0.5, pelvis: [0.2, 0, 0], spine: [0.5, 0, 0], shL: [-0.2, 0, 0.2], shR: [-0.2, 0, -0.2], elL: [-0.2, 0, 0], elR: [-0.2, 0, 0] }),
    K(0.45, { pos: [0, 0, 0.35], ...FACEDOWN }, { ease: 'in', land: true }),
    K(0.1, { pos: [0, 0, 0.35], ...FACEDOWN, hipY: 0.22 }),
    K(0.12, { pos: [0, 0, 0.35], ...FACEDOWN }),
  ],
  armripBody: [
    K(0.08, { pos: [0, 0, -0.25], spin: 0.5, spine: [-0.3, -0.6, 0], neck: [-0.7, 0.4, 0], ...FLAIL, hipY: 0.88 }, { ease: 'out' }),
    K(0.45, { pos: [0, 0, -0.6], spin: 1.3, hipY: 0.8, spine: [0.5, 0.3, 0.2], neck: [0.3, 0, 0], shR: [-1.3, 0, 0.6], elR: [-2.0, 0, 0] }),
    K(0.4, { pos: [0, 0, -0.85], spin: 2.1, hipY: 0.78, spine: [0.3, -0.2, -0.3], neck: [-0.4, 0, 0], shR: [-1.3, 0, 0.6], elR: [-2.0, 0, 0] }),
    K(0.45, { pos: [0, 0, -1.2], spin: 2.6, ...LYING }, { ease: 'in', land: true }),
    K(0.1, { pos: [0, 0, -1.2], spin: 2.6, ...LYING, hipY: 0.22 }),
    K(0.12, { pos: [0, 0, -1.2], spin: 2.6, ...LYING }),
  ],
  spinesnap: [
    K(0.07, { pos: [0, 0, -0.2], pelvis: [0.5, 0, 0], spine: [-1.3, 0, 0], neck: [-0.9, 0, 0], hipY: 0.9, ...FLAIL }, { ease: 'out' }),
    K(0.3, { pos: [0, 0, -0.3], pelvis: [0.75, 0, 0], spine: [-2.35, 0, 0.1], neck: [-1.2, 0.3, 0.3], hipY: 0.84, shL: [1.8, 0, 0.6], elL: [-0.2, 0, 0], shR: [1.9, 0, -0.6], elR: [-0.3, 0, 0] }),
    K(0.35, { pos: [0, 0, -0.3], pelvis: [0.8, 0, 0], spine: [-2.5, 0, -0.1], neck: [-1.3, -0.3, 0], hipY: 0.8, shL: [2.0, 0, 0.8], elL: [-0.2, 0, 0], shR: [2.1, 0, -0.8], elR: [-0.2, 0, 0] }),
    K(0.4, { pos: [0, 0, -0.35], pelvis: [0.9, 0, 0], spine: [-2.6, 0, 0], neck: [-1.2, 0, 0], hipY: 0.42, shL: [2.2, 0, 1.0], shR: [2.2, 0, -1.0], footL: [0.15, 0.06, 0.1], footR: [-0.15, 0.06, -0.05] }, { ease: 'in', land: true }),
    K(0.1, { pos: [0, 0, -0.35], pelvis: [0.95, 0, 0], spine: [-2.7, 0, 0], neck: [-1.2, 0, 0], hipY: 0.36, shL: [2.3, 0, 1.2], shR: [2.3, 0, -1.2], footL: [0.15, 0.06, 0.1], footR: [-0.15, 0.06, -0.05] }),
  ],
  crumple: [
    K(0.1, { pos: [0, 0, -0.15], neck: [-0.6, 0.4, 0], ...FLAIL, hipY: 0.9 }, { ease: 'out' }),
    K(0.35, { pos: [0, 0, -0.2], spine: [0.2, 0, 0.35], neck: [0.3, 0.5, 0.5], shL: [-0.3, 0, 0.5], elL: [-0.3, 0, 0], shR: [-0.3, 0, -0.5], elR: [-0.3, 0, 0], hipY: 0.88 }),
    K(0.35, { pos: [0, 0, -0.15], spine: [0.2, 0, -0.35], neck: [0.3, -0.5, -0.5], shL: [-0.2, 0, 0.3], elL: [-0.2, 0, 0], shR: [-0.2, 0, -0.3], elR: [-0.2, 0, 0], hipY: 0.85 }),
    K(0.35, { pos: [0, 0, 0], hipY: 0.5, spine: [0.5, 0, 0.1], neck: [0.7, 0, 0], shL: [0, 0, 0.2], elL: [0, 0, 0], shR: [0, 0, -0.2], elR: [0, 0, 0] }),
    K(0.4, { pos: [0, 0, 0.35], ...FACEDOWN }, { ease: 'in', land: true }),
    K(0.1, { pos: [0, 0, 0.35], ...FACEDOWN, hipY: 0.22 }),
    K(0.12, { pos: [0, 0, 0.35], ...FACEDOWN }),
  ],
  launchsplat: [
    K(0.12, { pos: [0, 1.0, -0.4], pelvis: [-1.0, 0, 0], neck: [-0.6, 0, 0], ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.4, 0, 0.3], knL: [0.8, 0, 0], hipR: [0.2, 0, -0.3], knR: [0.5, 0, 0] }, { ease: 'out' }),
    K(0.6, { pos: [0, 3.4, -1.2], pelvis: [-4.2, 0, 0], neck: [-0.4, 0, 0], ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.9, 0, 0.3], knL: [1.2, 0, 0], hipR: [-0.2, 0, -0.3], knR: [0.4, 0, 0] }, { ease: 'out' }),
    K(0.55, { pos: [0, 0, -1.8], ...LYING, pelvis: [-7.8, 0, 0] }, { ease: 'in', land: true }),
    K(0.1, { pos: [0, 0, -1.8], ...LYING, pelvis: [-7.6, 0, 0], hipY: 0.32 }),
    K(0.14, { pos: [0, 0, -1.8], ...LYING, pelvis: [-7.8, 0, 0] }),
  ],
  spinout: [
    K(0.1, { pos: [0, 0.5, -0.3], pelvis: [-1.3, 0, 0], spin: 1.5, ...FLAIL, ikL: 0, ikR: 0 }, { ease: 'out' }),
    K(0.6, { pos: [0, 1.25, -1.0], pelvis: [-1.45, 0, 0], spin: 9.4, ...FLAIL, ikL: 0, ikR: 0, hipL: [-0.2, 0, 0.5], hipR: [0.2, 0, -0.5] }),
    K(0.35, { pos: [0, 0, -1.4], spin: 12.566, ...LYING }, { ease: 'in', land: true }),
    K(0.1, { pos: [0, 0, -1.4], spin: 12.566, ...LYING, hipY: 0.24 }),
    K(0.12, { pos: [0, 0, -1.4], spin: 12.566, ...LYING }),
  ],
  gibBody: [K(0.05, { pos: [0, 0.1, -0.2] })],
});

const HOLD = new Set(['ko', 'victory', 'victory2', 'victory3', 'lose', 'decapBody', 'armripBody', 'spinesnap', 'crumple', 'launchsplat', 'spinout', 'gibBody']);
export const VICTORIES = ['victory', 'victory2', 'victory3'];

const EASE = {
  inout: (u) => u * u * (3 - 2 * u),
  out: (u) => 1 - (1 - u) * (1 - u),
  in: (u) => u * u,
};

// ---------------------------------------------------------------- fighter

const L = 0.45; // thigh & shin length
const _v = new THREE.Vector3();

export class Fighter {
  constructor(def, side = -1, { mirror = false } = {}) {
    this.def = def;
    this.side = side;
    this.facing = side < 0 ? 1 : -1;
    this.homeX = side * 0.95;
    this.health = 100;
    this.mats = [];
    this.flash = 0;
    this.time = Math.random() * 10;
    this.anim = null;
    this.cur = pose();
    this.onLand = null;
    this.aura = new THREE.Color(def.aura ?? 0xffffff);
    this.auraLevel = 0;
    this.baseRotY = 0;

    const S = def.build ?? 1;
    this.S = S;
    this.gear = []; // gloves + shoes (get bloodied)
    this.glowMats = [];
    this.tails = [];
    this.spinners = [];
    this.patCache = {};
    this.detached = new Map();
    this.stumps = {};
    this.twitchUntil = 0;
    this.stains = [];
    this.gearBlood = 0;
    const root = (this.root = new THREE.Group());
    root.rotation.y = this.baseRotY = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (mirror) root.scale.x = -1;

    const grp = (parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    // Pelvis + legs
    const ex = new Set(def.extras || []);
    const pelvis = (this.pelvis = grp(root, 0, 0.93, 0));
    this.box(pelvis, 0.32 * S, 0.2, 0.2 * S, def.bottom, 0, 0, 0);
    if (!ex.has('champBelt')) this.box(pelvis, 0.34 * S, 0.07, 0.22 * S, def.belt, 0, 0.09, 0);
    if (def.gi) this.box(pelvis, 0.06, 0.2, 0.03, def.belt, 0.07, -0.02, 0.12).rotation.z = 0.2;
    const boots = ex.has('bigBoots') ? 1.35 : 1;
    const leg = (sx) => {
      const hip = grp(pelvis, sx * 0.1 * S, -0.06, 0);
      this.box(hip, 0.16 * S, 0.46, 0.17 * S, def.bottom, 0, -0.22, 0);
      const kn = grp(hip, 0, -L, 0);
      this.pbox(kn, 0.13 * S, 0.44, 0.14 * S, 'shin', def.shin, 0, -0.22, 0);
      this.gear.push(this.box(kn, 0.13 * S * boots, 0.08 * boots, 0.26 * (boots > 1 ? 1.12 : 1), def.shoe, 0, -0.48 + (0.08 * boots - 0.08) / 2, 0.05).material);
      return [hip, kn];
    };
    [this.hipL, this.knL] = leg(1);
    [this.hipR, this.knR] = leg(-1);

    // Torso: tapered 4-sided cylinder
    const spine = (this.spine = grp(pelvis, 0, 0.1, 0));
    const tg = new THREE.CylinderGeometry(0.34 * S, 0.24 * S, 0.5, 4, 1);
    tg.rotateY(Math.PI / 4);
    tg.scale(1, 1, 0.62);
    tg.translate(0, 0.25, 0);
    this.mesh(spine, tg, def.top);
    if (def.gi) {
      this.box(spine, 0.05, 0.36, 0.02, 0xd8d2c4, 0.05, 0.3, 0.16).rotation.z = -0.35;
      this.box(spine, 0.05, 0.36, 0.02, 0xd8d2c4, -0.05, 0.3, 0.16).rotation.z = 0.35;
    }
    if (def.strap) {
      this.box(spine, 0.07, 0.62, 0.3 * S, def.strap, 0, 0.27, 0).rotation.z = 0.55;
    }
    if (def.boss) {
      for (const x of [-0.3, 0.3]) this.box(spine, 0.2 * S, 0.1, 0.24 * S, def.band, x * S, 0.5, 0).rotation.z = x > 0 ? -0.3 : 0.3;
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.02), this.glow(0xff2030));
      core.position.set(0, 0.32, 0.17 * S);
      core.rotation.z = Math.PI / 4;
      spine.add(core);
    }
    if (def.scarf) {
      this.box(spine, 0.26, 0.08, 0.2, def.band, 0, 0.5, 0);
      const tail = this.box(spine, 0.06, 0.34, 0.03, def.band, 0.06, 0.34, -0.17);
      tail.rotation.x = 0.4;
    }

    // Head
    const neck = (this.neck = grp(spine, 0, 0.5, 0));
    this.box(neck, 0.1, 0.1, 0.1, def.skin, 0, 0.04, 0);
    this.buildHead(neck, def);

    // Arms
    const gs = ex.has('bigGloves') ? 1.5 : 1;
    const arm = (sx) => {
      const sh = grp(spine, sx * 0.26 * S, 0.44, 0);
      this.box(sh, 0.15 * S, 0.14, 0.16 * S, def.sleeve, 0, -0.02, 0);
      this.box(sh, 0.12 * S, 0.3, 0.13 * S, def.sleeve, 0, -0.15, 0);
      const el = grp(sh, 0, -0.29, 0);
      this.pbox(el, 0.1 * S, 0.26, 0.11 * S, 'forearm', def.skin, 0, -0.13, 0);
      this.gear.push(this.box(el, 0.14 * S * gs, 0.13 * gs, 0.15 * S * gs, def.glove, 0, -0.3 - (gs - 1) * 0.04, 0).material);
      return [sh, el];
    };
    [this.shL, this.elL] = arm(1);
    [this.shR, this.elR] = arm(-1);
    this.buildExtras(def, S, ex);

    // Blob shadow (lives in the scene, not under root, so it stays on the floor)
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 10),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.shadow.scale.set(1, 0.7, 1);

    this.apply(this.cur);
  }

  buildHead(neck, def) {
    const hs = def.hairStyle;
    const ex = new Set(def.extras || []);
    const face = (this.faceTex = canvasTexture(16, 20, (g, w, h) => drawFace(g, w, h, def, 0)));
    this.damageLevel = 0;
    const COVER = { luchador: def.mask, helmet: def.helmet, dinohood: def.hair, kabuto: def.hair, mask: def.hair, hood: def.hair, long: def.hair, emo: def.hair };
    const bare = hs === 'bald' || hs === 'mohawk';
    const side = this.mat(COVER[hs] ?? def.skin);
    const top = this.mat(bare ? def.skin : COVER[hs] ?? def.hair);
    const back = this.mat(bare || hs === 'flattop' ? def.skin : COVER[hs] ?? def.hair);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.25, 0.23), [side, side, top, this.mat(def.skin), this.mat(0xffffff, face), back]);
    head.position.y = 0.19;
    neck.add(head);
    this.head = head;
    const box = (w, h, d, c, x, y, z) => this.box(head, w, h, d, c, x, y, z);
    const cone = (r, h, seg, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), typeof mat === 'number' ? this.mat(mat) : mat);
      m.position.set(x, y, z);
      head.add(m);
      return m;
    };

    switch (hs) {
      case 'spiky': {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          cone(0.055, 0.17, 4, def.hair, Math.cos(a) * 0.06, 0.15, Math.sin(a) * 0.06 - 0.02).rotation.set(Math.sin(a) * 0.6 - 0.3, 0, -Math.cos(a) * 0.6);
        }
        box(0.23, 0.05, 0.05, def.band, 0, 0.06, 0.1);
        box(0.04, 0.2, 0.02, def.band, 0.05, 0.02, -0.13).rotation.set(0.5, 0, 0.3);
        break;
      }
      case 'ponytail':
        box(0.23, 0.06, 0.25, def.hair, 0, 0.13, -0.005);
        box(0.23, 0.05, 0.05, def.hair, 0, 0.09, 0.105);
        box(0.08, 0.32, 0.08, def.hair, 0, -0.03, -0.18).rotation.x = 0.45;
        break;
      case 'bald':
        box(0.225, 0.045, 0.245, def.band, 0, 0.05, 0);
        break;
      case 'mask':
        box(0.23, 0.05, 0.25, def.band, 0, 0.07, 0);
        break;
      case 'crest': {
        box(0.04, 0.16, 0.3, def.band, 0, 0.16, -0.02);
        box(0.25, 0.06, 0.08, def.band, 0, 0.02, 0.1);
        const eye = this.glow(0xff2030);
        for (const x of [-0.05, 0.05]) {
          const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.01), eye);
          e.position.set(x, 0.01, 0.118);
          head.add(e);
        }
        for (const x of [-0.13, 0.13]) cone(0.04, 0.2, 4, def.band, x, 0.14, 0).rotation.z = -Math.sign(x) * 0.5;
        break;
      }
      case 'luchador':
        box(0.03, 0.02, 0.24, def.trim, 0, 0.126, 0);
        for (const y of [0.06, 0.0, -0.06]) box(0.07, 0.012, 0.01, def.trim, 0, y, -0.117);
        break;
      case 'mohawk': {
        const g = this.glow(def.hair);
        for (let i = 0; i < 6; i++) {
          const hgt = [0.1, 0.15, 0.2, 0.2, 0.15, 0.1][i];
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.035, hgt, 0.04), g);
          m.position.set(0, 0.125 + hgt / 2, 0.1 - i * 0.042);
          m.rotation.x = -0.2 - i * 0.05;
          head.add(m);
        }
        break;
      }
      case 'hood':
        box(0.27, 0.31, 0.2, def.hair, 0, 0.02, -0.04);
        cone(0.1, 0.24, 4, def.hair, 0, 0.1, -0.16).rotation.x = -1.2;
        box(0.28, 0.04, 0.05, def.belt, 0, 0.155, 0.06);
        break;
      case 'flattop':
        box(0.2, 0.14, 0.22, def.hair, 0, 0.19, 0);
        break;
      case 'dreads': {
        box(0.225, 0.06, 0.245, def.band, 0, 0.07, 0);
        box(0.05, 0.14, 0.02, def.band, 0.04, 0.02, -0.13).rotation.set(0.4, 0, 0.3);
        for (let i = 0; i < 9; i++) {
          const th = -1.7 + (3.4 * i) / 8;
          const m = box(0.03, 0.34, 0.03, def.hair, Math.sin(th) * 0.105, -0.08, -Math.cos(th) * 0.11);
          m.rotation.set(Math.cos(th) * 0.25, 0, -Math.sin(th) * 0.25);
        }
        break;
      }
      case 'foxears':
        box(0.2, 0.36, 0.07, def.hair, 0, -0.1, -0.11);
        box(0.21, 0.05, 0.04, def.hair, 0, 0.1, 0.105);
        for (const sx of [-1, 1]) {
          cone(0.055, 0.15, 4, def.hair, sx * 0.07, 0.19, 0).rotation.z = -sx * 0.25;
          cone(0.03, 0.09, 4, 0xf4f0ea, sx * 0.07, 0.18, 0.018).rotation.z = -sx * 0.25;
        }
        break;
      case 'helmet':
        box(0.23, 0.03, 0.25, def.helmet, 0, 0.09, 0);
        for (let i = 0; i < 7; i++) {
          const hgt = 0.08 + Math.sin((i / 6) * Math.PI) * 0.09;
          box(0.035, hgt, 0.045, def.crest, 0, 0.125 + hgt / 2, 0.13 - i * 0.045);
        }
        for (const sx of [-1, 1]) box(0.02, 0.15, 0.09, def.helmet, sx * 0.112, -0.03, 0.06);
        break;
      case 'dinohood': {
        box(0.27, 0.31, 0.22, def.hair, 0, 0.03, -0.035);
        box(0.27, 0.05, 0.08, def.hair, 0, 0.155, 0.08);
        const tooth = this.mat(0xffffff);
        for (let i = 0; i < 6; i++) cone(0.018, 0.045, 3, tooth, -0.1 + i * 0.04, 0.115, 0.115).rotation.x = Math.PI;
        for (const sx of [-1, 1]) {
          box(0.055, 0.045, 0.045, 0xffffff, sx * 0.07, 0.19, 0.06);
          box(0.022, 0.025, 0.01, 0x111111, sx * 0.07, 0.19, 0.084);
        }
        break;
      }
      case 'flame': {
        const cols = [0xff2a00, 0xff7a00, 0xffd000];
        for (let i = 0; i < 10; i++) {
          const hgt = 0.14 + ((i * 37) % 11) / 55;
          const m = cone(0.05, hgt, 4, this.glow(cols[i % 3]), -0.08 + (i % 4) * 0.055, 0.13 + hgt / 2, 0.08 - Math.floor(i / 4) * 0.08);
          m.rotation.set(-0.4, 0, ((i % 3) - 1) * 0.2);
        }
        break;
      }
      case 'long':
        box(0.22, 0.46, 0.07, def.hair, 0, -0.12, -0.11);
        for (const sx of [-1, 1]) box(0.035, 0.3, 0.1, def.hair, sx * 0.112, -0.08, -0.01);
        box(0.21, 0.05, 0.04, def.hair, 0, 0.1, 0.105);
        break;
      case 'kabuto':
        box(0.25, 0.09, 0.27, def.hair, 0, 0.15, 0);
        box(0.3, 0.12, 0.2, def.hair, 0, 0.02, -0.07).rotation.x = 0.35;
        for (const sx of [-1, 1]) {
          box(0.03, 0.12, 0.12, def.hair, sx * 0.13, 0.04, 0).rotation.z = sx * 0.3;
          box(0.022, 0.22, 0.02, def.trim, sx * 0.065, 0.27, 0.13).rotation.z = -sx * 0.7;
        }
        box(0.05, 0.05, 0.02, def.trim, 0, 0.2, 0.135);
        break;
      case 'emo': {
        box(0.225, 0.07, 0.25, def.hair, 0, 0.12, 0);
        box(0.225, 0.2, 0.05, def.hair, 0, -0.02, -0.115);
        box(0.13, 0.17, 0.035, def.hair, 0.045, 0.035, 0.12).rotation.z = -0.35;
        box(0.03, 0.15, 0.037, def.streak, 0.075, 0.04, 0.123).rotation.z = -0.35;
        for (const sx of [-1, 1]) {
          const pt = box(0.07, 0.2, 0.07, def.hair, sx * 0.135, -0.02, -0.03);
          pt.rotation.z = sx * 0.35;
          this.tails.push(pt);
          pt.userData = { bz: sx * 0.35, ph: sx, axis: 'z' };
          this.box(pt, 0.075, 0.07, 0.075, def.streak, 0, -0.12, 0);
          this.box(pt, 0.08, 0.02, 0.08, 0xff4aa8, 0, 0.09, 0);
        }
        break;
      }
      default:
        break;
    }

    if (ex.has('shades')) {
      box(0.2, 0.045, 0.02, 0x0a0a0a, 0, 0.015, 0.12);
      box(0.03, 0.012, 0.005, 0xffffff, -0.05, 0.025, 0.131);
    }
    if (ex.has('eyepatch')) box(0.216, 0.012, 0.236, 0x111111, 0, 0.03, 0).rotation.z = 0.25;
    if (ex.has('tiara')) {
      const g = this.glow(0x9ef8ff);
      [[-0.05, 0.05], [0, 0.09], [0.05, 0.05]].forEach(([x, hgt]) => cone(0.018, hgt, 4, g, x, 0.13 + hgt / 2, 0.1));
    }
    if (ex.has('starClip')) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), this.glow(0xffe040));
      m.position.set(-0.1, 0.1, 0.08);
      head.add(m);
    }
  }

  /** Decorations that make each fighter unique. */
  buildExtras(def, S, ex) {
    const sp = this.spine;
    const pv = this.pelvis;
    const zf = 0.135 * S;
    const openCyl = (rt, rb, h, mat, parent, y) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 10, 1, true), mat);
      m.position.y = y;
      parent.add(m);
      return m;
    };
    if (ex.has('cape')) {
      this.box(sp, 0.46 * S, 0.8, 0.025, def.cape, 0, 0.12, -0.155 * S).rotation.x = 0.12;
      this.box(sp, 0.5 * S, 0.06, 0.28 * S, def.trim ?? def.cape, 0, 0.48, 0);
    }
    if (ex.has('coat')) {
      this.box(pv, 0.36 * S, 0.5, 0.03, def.top, 0, -0.27, -0.12 * S).rotation.x = 0.15;
      for (const sx of [-1, 1]) this.box(sp, 0.06, 0.45, 0.02, 0xc09030, sx * 0.08, 0.25, zf + 0.01).rotation.z = sx * 0.15;
    }
    if (ex.has('robe')) {
      const m = this.mat(def.top);
      m.side = THREE.DoubleSide;
      openCyl(0.2 * S, 0.34 * S, 0.6, m, pv, -0.3);
    }
    if (ex.has('pteruges')) {
      for (let i = 0; i < 7; i++) {
        const a = -1.5 + i * 0.5;
        const m = this.box(pv, 0.07, 0.24, 0.025, def.bottom, Math.sin(a) * 0.17 * S, -0.14, Math.cos(a) * 0.11 * S);
        m.rotation.y = a;
      }
    }
    if (ex.has('skirt')) {
      const m = this.patMat('skirt', def.bottom);
      m.side = THREE.DoubleSide;
      openCyl(0.19 * S, 0.32 * S, 0.24, m, pv, -0.1);
    }
    if (ex.has('glowhands')) {
      const g = this.glow(def.glowColor ?? def.aura, { transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const el of [this.elL, this.elR]) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), g);
        m.position.y = -0.3;
        el.add(m);
        this.spinners.push(m);
      }
    }
    if (ex.has('studs')) {
      for (const sh of [this.shL, this.shR]) {
        for (let i = 0; i < 3; i++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 4), this.mat(0xd0d0d8));
          c.position.set(-0.04 + i * 0.04, 0.07, 0);
          sh.add(c);
        }
      }
    }
    if (ex.has('champBelt')) {
      this.box(pv, 0.38 * S, 0.13, 0.24 * S, def.belt, 0, 0.08, 0);
      this.box(pv, 0.17, 0.15, 0.02, 0xfff0a0, 0, 0.08, 0.125 * S);
      this.box(pv, 0.09, 0.08, 0.025, 0xd01010, 0, 0.08, 0.13 * S);
    }
    if (ex.has('shoulderArmor')) {
      for (const [sh, sx] of [[this.shL, 1], [this.shR, -1]]) {
        const m = this.box(sh, 0.2 * S, 0.08, 0.22 * S, def.armor, sx * 0.02, 0.07, 0);
        m.rotation.z = -sx * 0.3;
        this.box(sh, 0.21 * S, 0.02, 0.23 * S, def.crest ?? def.armor, sx * 0.02, 0.1, 0).rotation.z = -sx * 0.3;
      }
    }
    if (ex.has('samuraiArmor')) {
      for (const [sh, sx] of [[this.shL, 1], [this.shR, -1]]) {
        const m = this.box(sh, 0.05, 0.22, 0.2 * S, def.armor, sx * 0.09, -0.06, 0);
        m.rotation.z = sx * 0.25;
        this.box(sh, 0.052, 0.02, 0.202 * S, def.trim, sx * 0.09, 0.0, 0).rotation.z = sx * 0.25;
      }
      for (const [x, z, ry] of [[0, 0.11, 0], [0.16, 0, Math.PI / 2], [-0.16, 0, Math.PI / 2]]) {
        const m = this.box(pv, 0.15 * S, 0.24, 0.03, def.armor, x * S, -0.15, z * S);
        m.rotation.y = ry;
      }
      for (const y of [0.18, 0.32]) this.box(sp, 0.36 * S, 0.02, 0.02, def.trim, 0, y, zf + 0.012);
    }
    if (ex.has('katana')) {
      const k = this.box(pv, 0.035, 0.7, 0.045, 0x111111, 0.2 * S, -0.02, 0);
      k.rotation.x = 1.15;
      this.box(k, 0.04, 0.2, 0.05, 0xe8e0d0, 0, 0.44, 0);
      this.box(k, 0.09, 0.015, 0.09, def.trim, 0, 0.34, 0);
    }
    if (ex.has('iceSpikes')) {
      const g = this.glow(0x9ef8ff);
      for (const [sh, sx] of [[this.shL, 1], [this.shR, -1]]) {
        for (let i = 0; i < 3; i++) {
          const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14 + i * 0.03, 4), g);
          c.position.set(sx * (0.02 + i * 0.03), 0.1, -0.04 + i * 0.04);
          c.rotation.z = -sx * (0.3 + i * 0.2);
          sh.add(c);
        }
      }
    }
    if (ex.has('foxtails')) {
      const white = this.mat(0xf4f0ea);
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.ConeGeometry(0.07, 0.55, 5);
        geo.translate(0, 0.275, 0);
        const t = new THREE.Mesh(geo, this.mat(def.hair));
        t.position.set(0, 0, -0.1 * S);
        const bz = (i - 2) * 0.38;
        t.rotation.set(-1.0 - (i % 2) * 0.3, 0, bz);
        t.userData = { bz, ph: i, axis: 'z' };
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), white);
        tip.position.y = 0.5;
        t.add(tip);
        pv.add(t);
        this.tails.push(t);
      }
    }
    if (ex.has('dinotail')) {
      const geo = new THREE.ConeGeometry(0.13, 0.7, 6);
      geo.translate(0, 0.35, 0);
      const t = new THREE.Mesh(geo, this.mat(def.hair));
      t.position.set(0, -0.02, -0.1 * S);
      t.rotation.x = -1.95;
      t.userData = { bz: 0, ph: 0, axis: 'z' };
      pv.add(t);
      this.tails.push(t);
      for (let i = 0; i < 5; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), this.mat(0x2a8a30));
        c.position.set(0, 0.08 + i * 0.09, -0.14 * S);
        c.rotation.x = -1.3;
        sp.add(c);
      }
    }
    if (ex.has('belly')) this.box(sp, 0.26 * S, 0.38, 0.02, def.belt, 0, 0.22, zf);
    if (ex.has('heart')) {
      const g = this.glow(0xff2e8a);
      const add = (w, x, y) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, w, 0.012), g);
        m.position.set(x, y, zf + 0.008);
        m.rotation.z = Math.PI / 4;
        sp.add(m);
      };
      add(0.07, 0, 0.29);
      add(0.05, -0.027, 0.315);
      add(0.05, 0.027, 0.315);
    }
    if (ex.has('choker')) {
      this.box(this.neck, 0.115, 0.03, 0.115, 0x0a0a0a, 0, 0.02, 0);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), this.glow(0xff4aa8));
      d.position.set(0, 0.02, 0.06);
      this.neck.add(d);
    }
  }

  glow(color, extra = {}) {
    const m = new THREE.MeshBasicMaterial({ color, ...extra });
    this.glowMats.push(m);
    return m;
  }

  /** Striped material for parts listed in def.patterns (stockings, arm warmers, skirt). */
  patMat(key, fallback) {
    const p = this.def.patterns?.[key];
    if (!p) return this.mat(fallback);
    if (!this.patCache[key]) {
      const hex = (c) => '#' + c.toString(16).padStart(6, '0');
      this.patCache[key] = canvasTexture(4, 16, (g, w, h) => {
        for (let y = 0; y < h; y += 2) { g.fillStyle = hex(p[(y / 2) % 2]); g.fillRect(0, y, w, 2); }
      });
    }
    return this.mat(0xffffff, this.patCache[key]);
  }

  pbox(parent, w, h, d, key, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.patMat(key, color));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  /** Black-out for locked fighters on the select screen. */
  silhouette() {
    for (const m of [...this.mats, ...this.glowMats]) {
      m.color.set(0x0a0612);
      m.map = null;
      m.needsUpdate = true;
    }
    this.silhouetted = true;
  }

  mat(color, map = null) {
    const m = lambert(color, map ? { map } : {});
    this.mats.push(m);
    return m;
  }

  mesh(parent, geo, color) {
    const m = new THREE.Mesh(geo, this.mat(color));
    parent.add(m);
    return m;
  }

  box(parent, w, h, d, color, x, y, z) {
    const m = this.mesh(parent, new THREE.BoxGeometry(w, h, d), color);
    m.position.set(x, y, z);
    return m;
  }

  addTo(scene) { scene.add(this.root); scene.add(this.shadow); }
  removeFrom(scene) { this.restoreParts(); scene.remove(this.root); scene.remove(this.shadow); }

  // ---------------------------------------------------------- dismemberment
  partObj(name) {
    return { head: this.head, shL: this.shL, shR: this.shR, hipL: this.hipL, hipR: this.hipR, spine: this.spine, pelvis: this.pelvis }[name];
  }

  /** Pull a body part off and hand it to the scene (keeps its world transform). */
  detach(name, scene) {
    if (this.detached.has(name)) return this.detached.get(name).obj;
    const obj = this.partObj(name);
    if (!obj) return null;
    this.root.updateMatrixWorld(true);
    this.detached.set(name, { obj, parent: obj.parent, pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.clone() });
    scene.attach(obj);
    this.showStump(name, true);
    return obj;
  }

  isDetached(name) { return this.detached.has(name); }

  restoreParts() {
    for (const [name, d] of this.detached) {
      d.parent.add(d.obj);
      d.obj.position.copy(d.pos);
      d.obj.quaternion.copy(d.quat);
      d.obj.scale.copy(d.scale);
      this.showStump(name, false);
    }
    this.detached.clear();
  }

  showStump(name, on) {
    if (!this.stumps[name]) {
      if (!on) return;
      const S = this.S;
      const where = {
        head: [this.neck, 0, 0.09, 0, 0.11],
        shL: [this.spine, 0.26 * S, 0.44, 0, 0.13],
        shR: [this.spine, -0.26 * S, 0.44, 0, 0.13],
        hipL: [this.pelvis, 0.1 * S, -0.08, 0, 0.14],
        hipR: [this.pelvis, -0.1 * S, -0.08, 0, 0.14],
        spine: [this.pelvis, 0, 0.1, 0, 0.26 * S],
      }[name];
      if (!where) return;
      const [parent, x, y, z, w] = where;
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const meat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, w * 0.9), STUMP_MAT);
      const bone = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), BONE_MAT);
      bone.position.y = 0.02;
      g.add(meat, bone);
      parent.add(g);
      this.stumps[name] = g;
    }
    this.stumps[name].visible = on;
  }

  /** Dead bodies spasm for a while. */
  twitch(seconds) { this.twitchUntil = this.time + seconds; }

  reset() {
    this.restoreParts();
    this.twitchUntil = 0;
    this.health = 100;
    this.flash = 0;
    if (this.anim) this.anim.resolve(false);
    this.anim = null;
    this.cur = pose();
    this.setDamage(0);
    for (const st of this.stains) st.parent.remove(st);
    this.stains = [];
    this.gearBlood = 0;
    this.tintGear();
    this.apply(this.cur);
  }

  /** World-space centre of the chest (for auras / camera targets). */
  chest() { return this.spine.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.25, 0)); }

  hitPoint(kind) {
    const target = kind === 'mid' ? this.spine : this.head;
    const p = target.getWorldPosition(new THREE.Vector3());
    if (kind === 'mid') p.y += 0.2;
    p.x -= this.facing * 0.15;
    return p;
  }

  hurt() { this.flash = 1; }

  /** Splash a few blood stains onto the head or torso. */
  stain(kind, count = 3) {
    for (let i = 0; i < count && this.stains.length < 90; i++) {
      const sz = 0.025 + Math.random() * 0.05;
      const m = new THREE.Mesh(STAIN_GEO, STAIN_MATS[Math.floor(Math.random() * STAIN_MATS.length)]);
      m.scale.set(sz, sz * (0.6 + Math.random() * 1.4), 1);
      m.rotation.z = Math.random() * Math.PI;
      const side = Math.random() < 0.65 ? 'front' : Math.random() < 0.5 ? 'left' : 'right';
      if (kind === 'mid') {
        const zf = 0.135 * this.S + 0.004;
        const y = 0.08 + Math.random() * 0.38;
        if (side === 'front') m.position.set((Math.random() - 0.5) * 0.3 * this.S, y, zf);
        else { m.position.set((side === 'left' ? 1 : -1) * (0.2 * this.S + 0.004), y, (Math.random() - 0.5) * 0.18); m.rotation.y = Math.PI / 2; }
        this.spine.add(m);
      } else {
        const y = (Math.random() - 0.5) * 0.2;
        if (side === 'front') m.position.set((Math.random() - 0.5) * 0.18, y, 0.119);
        else { m.position.set((side === 'left' ? 1 : -1) * 0.109, y, (Math.random() - 0.5) * 0.2); m.rotation.y = Math.PI / 2; }
        this.head.add(m);
      }
      this.stains.push(m);
    }
  }

  /** Attacker's gloves / feet get redder with every bloody hit. */
  bloodyGear(amount) {
    this.gearBlood = Math.min(0.85, this.gearBlood + amount);
    this.tintGear();
  }

  tintGear() {
    for (const m of this.gear) {
      m.userData.base ??= m.color.clone();
      m.color.copy(m.userData.base).lerp(GEAR_BLOOD, this.gearBlood);
    }
  }

  /** 0 = clean, 1–3 = increasingly battered face. */
  setDamage(level) {
    if (level === this.damageLevel) return;
    this.damageLevel = level;
    const c = this.faceTex.image;
    drawFace(c.getContext('2d'), c.width, c.height, this.def, level);
    this.faceTex.needsUpdate = true;
  }

  /** Play a named animation. Resolves when it finishes (or is interrupted). */
  play(name, { onHit, rate = 1 } = {}) {
    if (this.anim) this.anim.resolve(false);
    const kfs = ANIMS[name];
    // wrap spin so a new move never unwinds a previous 360
    let sp = this.cur[OFF.spin] % (Math.PI * 2);
    if (sp > Math.PI) sp -= Math.PI * 2;
    this.cur[OFF.spin] = sp;
    let acc = 0;
    const ends = kfs.map((k) => (acc += k.d));
    const hits = kfs.filter((k) => k.hit).length;
    return new Promise((resolve) => {
      this.anim = {
        name, kfs, ends, t: 0, next: 0, hitIdx: 0, hits, onHit, resolve, rate,
        from: this.cur.slice(), hold: HOLD.has(name), done: false,
      };
    });
  }

  get busy() { return !!this.anim && !this.anim.done; }
  get animName() { return this.anim?.name ?? null; }
  get airborne() { return this.root.position.y > 0.25; }

  /** Afterimage: a clone of the current pose using one translucent material. */
  ghost(color) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    this.root.updateMatrixWorld(true);
    const g = this.root.clone(true);
    g.traverse((o) => { if (o.isMesh) o.material = mat; });
    return { group: g, mat };
  }

  setAura(level) { this.auraLevel = level; }

  update(dt) {
    this.time += dt;
    const out = this.cur;
    const a = this.anim;
    if (a) {
      a.t += dt * a.rate;
      while (a.next < a.kfs.length && a.t >= a.ends[a.next]) {
        const k = a.kfs[a.next];
        if (k.hit && a.onHit) a.onHit(k.hit, a.hitIdx++, a.hits);
        if (k.land && this.onLand) this.onLand(this);
        a.next++;
      }
      const total = a.ends[a.ends.length - 1];
      if (a.t >= total) {
        out.set(a.kfs[a.kfs.length - 1].pose);
        if (!a.done) { a.done = true; a.resolve(true); }
        if (!a.hold) this.anim = null;
      } else {
        const i = a.ends.findIndex((e) => a.t < e);
        const k = a.kfs[i];
        const start = a.ends[i] - k.d;
        const u = EASE[k.ease || 'inout'](Math.min(1, (a.t - start) / k.d));
        const from = i === 0 ? a.from : a.kfs[i - 1].pose;
        for (let j = 0; j < SIZE; j++) out[j] = from[j] + (k.pose[j] - from[j]) * u;
      }
    } else {
      out.set(IDLE);
    }
    this.apply(out);
  }

  apply(p) {
    const holding = this.anim?.hold;
    const bob = holding ? 0 : Math.sin(this.time * 5.5) * 0.018;
    const breathe = holding ? 0 : Math.sin(this.time * 5.5 + 0.8) * 0.05;

    const root = this.root;
    root.position.set(this.homeX + this.facing * p[OFF.pos + 2], p[OFF.pos + 1], -p[OFF.pos]);
    root.rotation.y = this.baseRotY + p[OFF.spin];
    const D = this.detached;
    const offP = D.has('pelvis');
    const offS = offP || D.has('spine');
    if (!offP) this.pelvis.position.y = p[OFF.hipY] + bob;

    const rot = (obj, k, add = 0) => obj.rotation.set(p[OFF[k]] + add, p[OFF[k] + 1], p[OFF[k] + 2]);
    if (!offP) rot(this.pelvis, 'pelvis');
    if (!offS) {
      rot(this.spine, 'spine');
      rot(this.neck, 'neck');
      if (!D.has('shL')) { rot(this.shL, 'shL', breathe); rot(this.elL, 'elL'); }
      if (!D.has('shR')) { rot(this.shR, 'shR', -breathe); rot(this.elR, 'elR'); }
    }
    const legL = !offP && !D.has('hipL');
    const legR = !offP && !D.has('hipR');
    if (legL) { rot(this.hipL, 'hipL'); rot(this.knL, 'knL'); }
    if (legR) { rot(this.hipR, 'hipR'); rot(this.knR, 'knR'); }
    if (this.time < this.twitchUntil) {
      const t = this.time;
      const sp = Math.sin(t * 23.7) * Math.sin(t * 3.1) > 0.55 ? Math.sin(t * 61) : 0;
      if (legL) this.knL.rotation.x += sp * 0.45;
      if (legR) this.hipR.rotation.x += sp * 0.3;
      if (!offS && !D.has('shR')) this.elR.rotation.x += sp * 0.6;
      if (!offS && !D.has('shL')) this.shL.rotation.z += sp * 0.25;
    }

    for (const t of this.tails) t.rotation.z = t.userData.bz + Math.sin(this.time * 4 + t.userData.ph) * 0.18;
    for (const m of this.spinners) m.rotation.set(this.time * 3, this.time * 2, 0);

    root.updateMatrixWorld(true);
    if (legL) this.legIK(this.hipL, this.knL, p, OFF.footL, p[OFF.ikL]);
    if (legR) this.legIK(this.hipR, this.knR, p, OFF.footR, p[OFF.ikR]);

    this.shadow.position.x = root.position.x;
    this.shadow.position.z = root.position.z;
    const s = Math.max(0.4, 1 - root.position.y * 0.5);
    this.shadow.scale.set(s * (p[OFF.hipY] < 0.4 ? 1.8 : 1), s * 0.7, 1);

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - 0.08);
    }
    const f = this.flash * 0.9;
    const a = this.silhouetted ? 0 : Math.min(0.5, this.auraLevel * (0.3 + 0.2 * Math.sin(this.time * 14)));
    const r = Math.max(f, this.aura.r * a), g = Math.max(f, this.aura.g * a), b = Math.max(f * 0.8, this.aura.b * a);
    for (const m of this.mats) m.emissive.setRGB(r, g, b);
  }

  legIK(hip, knee, p, footOff, w) {
    if (w <= 0.001) return;
    _v.set(p[footOff], p[footOff + 1], p[footOff + 2]);
    this.root.localToWorld(_v);
    this.pelvis.worldToLocal(_v);
    _v.sub(hip.position);
    const d = Math.min(Math.max(_v.length(), 0.1), 2 * L * 0.9995);
    const a0 = Math.atan2(-_v.z, -_v.y);
    const alpha = Math.acos(d / (2 * L));
    const hx = a0 - alpha;
    const kx = 2 * alpha;
    const hz = Math.asin(Math.max(-1, Math.min(1, _v.x / d)));
    hip.rotation.x += (hx - hip.rotation.x) * w;
    hip.rotation.y *= 1 - w;
    hip.rotation.z += (hz - hip.rotation.z) * w;
    knee.rotation.x += (kx - knee.rotation.x) * w;
    knee.rotation.y *= 1 - w;
    knee.rotation.z *= 1 - w;
  }
}

const IDLE = pose();

const STAIN_GEO = new THREE.PlaneGeometry(1, 1);
const STAIN_MATS = [0x7a0006, 0x9a000a, 0xb0100e].map((c) => lambert(c, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
const GEAR_BLOOD = new THREE.Color(0x6a0004);
const STUMP_MAT = lambert(0x7a0008);
const BONE_MAT = lambert(0xf0e8d8);

const hexc = (c) => '#' + c.toString(16).padStart(6, '0');

function drawFace(g, w, h, def, damage = 0) {
  g.clearRect(0, 0, w, h);
  const f = FACES[def.face] ?? classicFace;
  f(g, def);
  drawDamage(g, damage);
}

const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

function baseFace(g, def, { top = def.hair, brows = 'normal', mouth = 'line', skin = def.skin } = {}) {
  R(g, hexc(skin), 0, 0, 16, 20);
  if (top != null) R(g, hexc(top), 0, 0, 16, 4);
  if (brows === 'angry') { R(g, '#1a1010', 3, 5, 2, 1); R(g, '#1a1010', 5, 6, 2, 1); R(g, '#1a1010', 11, 5, 2, 1); R(g, '#1a1010', 9, 6, 2, 1); }
  else { R(g, '#1a1010', 3, 6, 4, 1); R(g, '#1a1010', 9, 6, 4, 1); }
  R(g, '#ffffff', 3, 8, 4, 2); R(g, '#ffffff', 9, 8, 4, 2);
  R(g, '#111111', 5, 8, 2, 2); R(g, '#111111', 9, 8, 2, 2);
  R(g, 'rgba(0,0,0,0.18)', 7, 11, 2, 3);
  if (mouth === 'grin') { R(g, '#3a0a0a', 4, 15, 8, 2); R(g, '#ffffff', 5, 15, 2, 1); R(g, '#ffffff', 9, 15, 2, 1); }
  else if (mouth === 'line') R(g, '#6a2a24', 5, 16, 6, 1);
}

function classicFace(g, def) {
  if (def.hairStyle === 'crest') {
    R(g, hexc(def.skin), 0, 0, 16, 20);
    R(g, '#1a1c24', 1, 6, 14, 5);
    for (const y of [13, 15, 17]) R(g, '#6a7080', 3, y, 10, 1);
    return;
  }
  if (def.hairStyle === 'mask') {
    R(g, hexc(def.hair), 0, 0, 16, 20);
    R(g, hexc(def.skin), 1, 6, 14, 5);
    R(g, '#1a1010', 3, 6, 4, 1); R(g, '#1a1010', 9, 6, 4, 1);
    R(g, '#ffffff', 3, 8, 4, 2); R(g, '#ffffff', 9, 8, 4, 2);
    R(g, '#111111', 5, 8, 2, 2); R(g, '#111111', 9, 8, 2, 2);
    return;
  }
  baseFace(g, def, { top: def.hairStyle === 'bald' ? null : def.hair });
  if (def.hairStyle === 'ponytail') { R(g, hexc(def.hair), 0, 0, 3, 9); R(g, hexc(def.hair), 13, 0, 3, 9); }
}

const FACES = {
  luchador(g, def) {
    const m = hexc(def.mask);
    const t = hexc(def.trim);
    R(g, m, 0, 0, 16, 20);
    R(g, t, 7, 0, 2, 5); R(g, t, 6, 2, 4, 1);
    R(g, t, 1, 6, 6, 5); R(g, t, 9, 6, 6, 5);
    R(g, hexc(def.skin), 2, 7, 4, 3); R(g, hexc(def.skin), 10, 7, 4, 3);
    R(g, '#111111', 4, 8, 2, 2); R(g, '#111111', 10, 8, 2, 2);
    R(g, t, 0, 12, 3, 1); R(g, t, 13, 12, 3, 1); R(g, t, 1, 13, 2, 1); R(g, t, 13, 13, 2, 1);
    R(g, t, 4, 14, 8, 5); R(g, hexc(def.skin), 5, 15, 6, 3); R(g, '#6a2a24', 6, 16, 4, 1);
  },
  shades(g, def) {
    baseFace(g, def, { mouth: 'line' });
    R(g, '#0a0a0a', 2, 7, 12, 3); R(g, '#0a0a0a', 7, 7, 2, 1);
    R(g, '#ffffff', 3, 7, 2, 1); R(g, '#ffffff', 10, 7, 2, 1);
    R(g, '#3a2418', 6, 17, 4, 1);
  },
  eyepatch(g, def) {
    baseFace(g, def, { top: def.band, brows: 'angry' });
    R(g, '#0a0a0a', 9, 6, 5, 5); R(g, '#0a0a0a', 13, 3, 1, 3); R(g, '#0a0a0a', 7, 5, 2, 1);
    const b = hexc(def.hair);
    R(g, b, 3, 14, 10, 1); R(g, b, 2, 15, 3, 5); R(g, b, 11, 15, 3, 5); R(g, b, 4, 17, 8, 3);
    R(g, '#3a0a0a', 6, 16, 4, 1);
  },
  emo(g, def) {
    const hair = hexc(def.hair);
    R(g, hexc(def.skin), 0, 0, 16, 20);
    R(g, hair, 0, 0, 16, 4);
    // big cute visible eye (viewer's left) with winged liner
    R(g, '#1a1010', 2, 5, 4, 1);
    R(g, '#ffffff', 2, 7, 5, 4);
    R(g, '#2a0a3a', 3, 7, 3, 4);
    R(g, '#b040ff', 3, 9, 3, 2);
    R(g, '#ffffff', 3, 7, 1, 1); R(g, '#ffffff', 5, 9, 1, 1);
    R(g, '#0a0a0a', 1, 6, 7, 1); R(g, '#0a0a0a', 0, 5, 2, 1); R(g, '#0a0a0a', 2, 11, 5, 1);
    // tear-drop heart under the eye
    R(g, '#ff2e8a', 4, 13, 1, 1); R(g, '#ff2e8a', 6, 13, 1, 1); R(g, '#ff2e8a', 4, 14, 3, 1); R(g, '#ff2e8a', 5, 15, 1, 1);
    // blush + tiny mouth
    R(g, '#ff9ab8', 1, 12, 2, 1); R(g, '#ff9ab8', 12, 12, 2, 1);
    R(g, '#d04070', 7, 16, 2, 1); R(g, '#d04070', 6, 15, 1, 1); R(g, '#d04070', 9, 15, 1, 1);
    // side fringe covering the other eye
    g.fillStyle = hair;
    g.beginPath(); g.moveTo(7, 0); g.lineTo(16, 0); g.lineTo(16, 13); g.lineTo(12, 11); g.lineTo(8, 5); g.closePath(); g.fill();
    g.strokeStyle = hexc(def.streak); g.lineWidth = 1;
    g.beginPath(); g.moveTo(11, 0); g.lineTo(13.5, 9); g.stroke();
  },
  fox(g) {
    R(g, '#f6f2ea', 0, 0, 16, 20);
    R(g, '#d01830', 7, 2, 2, 2);
    R(g, '#d01830', 2, 5, 4, 1); R(g, '#d01830', 10, 5, 4, 1);
    R(g, '#111111', 3, 8, 4, 1); R(g, '#111111', 9, 8, 4, 1);
    R(g, '#d01830', 2, 9, 2, 1); R(g, '#d01830', 12, 9, 2, 1);
    R(g, '#d01830', 1, 12, 3, 1); R(g, '#d01830', 12, 12, 3, 1); R(g, '#d01830', 1, 14, 3, 1); R(g, '#d01830', 12, 14, 3, 1);
    R(g, '#111111', 7, 13, 2, 1);
    R(g, '#d01830', 6, 16, 4, 1); R(g, '#d01830', 5, 15, 1, 1); R(g, '#d01830', 10, 15, 1, 1);
  },
  frost(g, def) {
    R(g, hexc(def.skin), 0, 0, 16, 20);
    R(g, hexc(def.hair), 0, 0, 16, 4);
    R(g, '#2a4a8a', 3, 6, 4, 1); R(g, '#2a4a8a', 9, 6, 4, 1);
    R(g, '#6ef8ff', 3, 8, 4, 2); R(g, '#6ef8ff', 9, 8, 4, 2);
    R(g, '#ffffff', 4, 8, 1, 1); R(g, '#ffffff', 10, 8, 1, 1);
    R(g, 'rgba(0,40,120,0.15)', 7, 11, 2, 3);
    R(g, '#6aa0d0', 6, 16, 4, 1);
    R(g, '#9ef8ff', 13, 11, 1, 1); R(g, '#9ef8ff', 12, 12, 1, 1); R(g, '#9ef8ff', 13, 13, 1, 1);
  },
  titan(g, def) {
    R(g, hexc(def.helmet), 0, 0, 16, 20);
    R(g, 'rgba(0,0,0,0.25)', 0, 0, 16, 2);
    R(g, '#0a0604', 2, 8, 12, 2); R(g, '#0a0604', 6, 10, 4, 8);
    R(g, '#ffb040', 4, 8, 2, 1); R(g, '#ffb040', 10, 8, 2, 1);
    for (const [x, y] of [[1, 3], [14, 3], [1, 16], [14, 16]]) R(g, '#ffe0a0', x, y, 1, 1);
  },
  ronin(g, def) {
    baseFace(g, def, { top: def.hair, brows: 'angry', mouth: 'none' });
    R(g, '#7a1010', 0, 12, 16, 8);
    R(g, '#4a0808', 2, 14, 12, 1); R(g, '#4a0808', 3, 18, 10, 1);
    R(g, '#ffffff', 5, 16, 6, 1);
    R(g, '#e8c030', 1, 12, 14, 1);
  },
  volt(g, def) {
    baseFace(g, def, { top: null, brows: 'angry' });
    const c = '#b0ff20';
    R(g, c, 11, 3, 2, 2); R(g, c, 10, 5, 2, 1); R(g, c, 11, 6, 2, 1); R(g, c, 10, 7, 1, 1); R(g, c, 12, 10, 2, 1); R(g, c, 11, 11, 2, 2); R(g, c, 10, 13, 1, 2);
  },
  hex(g, def) {
    R(g, hexc(def.skin), 0, 0, 16, 20);
    R(g, 'rgba(20,0,40,0.65)', 0, 0, 16, 12);
    R(g, hexc(def.hair), 0, 0, 16, 3);
    R(g, '#ff60ff', 3, 8, 4, 2); R(g, '#ff60ff', 9, 8, 4, 2);
    R(g, '#ffffff', 4, 8, 1, 1); R(g, '#ffffff', 10, 8, 1, 1);
    R(g, '#4a0a4a', 6, 16, 4, 1);
    R(g, '#d040ff', 7, 1, 2, 3);
  },
  blaze(g, def) {
    baseFace(g, def, { brows: 'angry' });
    R(g, '#7a0a0a', 4, 5, 1, 7);
    R(g, '#ffa020', 5, 8, 1, 1); R(g, '#ffa020', 10, 8, 1, 1);
  },
  dino(g, def) {
    baseFace(g, def, { top: def.hair, mouth: 'grin' });
    R(g, '#ff9ab8', 1, 12, 2, 1); R(g, '#ff9ab8', 13, 12, 2, 1);
  },
};

function drawDamage(g, level) {
  if (level <= 0) return;
  const blood = '#a0000a';
  g.fillStyle = blood;
  // bloody nose / drip from under the mask
  g.fillRect(7, 14, 1, 2);
  g.fillRect(8, 14, 1, 1);
  if (level >= 2) {
    g.fillRect(6, 17, 1, 2); // chin drip
    g.fillRect(11, 5, 3, 1); // cut brow
    g.fillRect(12, 6, 1, 3);
    g.fillRect(12, 10, 1, 2);
    g.fillStyle = 'rgba(90,30,110,0.55)'; // bruise
    g.fillRect(2, 7, 5, 4);
  }
  if (level >= 3) {
    g.fillStyle = blood;
    g.fillRect(2, 3, 2, 1); // forehead cut
    g.fillRect(3, 4, 1, 4);
    g.fillRect(13, 12, 1, 5);
    g.fillRect(5, 16, 6, 1); // split lip
    g.fillStyle = 'rgba(90,30,110,0.55)';
    g.fillRect(9, 7, 5, 4);
  }
}

// ---------------------------------------------------------------- portraits

/** Render a still of each fighter to a data URL (for menus / HUD). */
export function makePortraits(defs) {
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe2c0, 0x40304a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff3020, 0);
  rim.position.set(-3, 1, -2);
  scene.add(rim);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  const out = {};
  for (const def of defs) {
    const f = new Fighter(def, -1);
    f.homeX = 0;
    f.update(0);
    f.root.rotation.y = 0.45;
    f.root.updateMatrixWorld(true);
    scene.add(f.root);

    renderer.setSize(150, 210, false);
    cam.aspect = 150 / 210; cam.fov = 34; cam.updateProjectionMatrix();
    cam.position.set(0.25, 1.15, 3.3); cam.lookAt(0, 0.95, 0);
    renderer.render(scene, cam);
    const body = canvas.toDataURL();

    renderer.setSize(96, 96, false);
    cam.aspect = 1; cam.fov = 22; cam.updateProjectionMatrix();
    cam.position.set(0.25, 1.72, 1.35); cam.lookAt(0.02, 1.58, 0);
    renderer.render(scene, cam);
    const head = canvas.toDataURL();

    renderer.setSize(220, 220, false);
    cam.aspect = 1; cam.fov = 26; cam.updateProjectionMatrix();
    cam.position.set(0.55, 1.5, 1.35); cam.lookAt(0.0, 1.55, 0);
    rim.intensity = 3;
    renderer.render(scene, cam);
    const face = canvas.toDataURL();
    rim.intensity = 0;

    scene.remove(f.root);
    out[def.id] = { body, head, face };
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
