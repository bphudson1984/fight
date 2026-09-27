// Graphics quality: 'hd' (high-poly, glossy PBR, reflections, shadows, native
// resolution) or 'retro' (the original PS1 look). Chosen in Fight Settings.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lambert } from './ps1.js';

const KEY = 'mathsfist.quality';
let stored = null;
try { stored = localStorage.getItem(KEY); } catch { /* ignore */ }

export const Q = { hd: stored !== 'retro' };

export function setQuality(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
}

/** Box: rounded + bevelled in HD, a plain cube in retro. */
export function boxGeo(w, h, d) {
  if (!Q.hd) return new THREE.BoxGeometry(w, h, d);
  const r = Math.min(w, h, d) * 0.24;
  return new RoundedBoxGeometry(w, h, d, Math.max(w, h, d) > 0.2 ? 2 : 1, r);
}

export function coneGeo(r, h, seg) {
  return new THREE.ConeGeometry(r, h, Q.hd ? Math.max(12, seg * 3) : seg, Q.hd ? 2 : 1);
}

export function cylGeo(rt, rb, h, seg, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, Q.hd ? Math.max(24, seg * 3) : seg, Q.hd ? 3 : 1, open);
}

export function icoGeo(r, detail = 0) {
  return new THREE.IcosahedronGeometry(r, Q.hd ? detail + 1 : detail);
}

/** Tapered chest. HD: a rounded, sculpted block; retro: the 4-sided cylinder. */
export function torsoGeo(S) {
  if (!Q.hd) {
    const tg = new THREE.CylinderGeometry(0.34 * S, 0.24 * S, 0.5, 4, 1);
    tg.rotateY(Math.PI / 4);
    tg.scale(1, 1, 0.62);
    tg.translate(0, 0.25, 0);
    return tg;
  }
  const g = new RoundedBoxGeometry(0.48 * S, 0.5, 0.3 * S, 3, 0.07);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = (y + 0.25) / 0.5; // 0 at waist, 1 at shoulders
    const sx = 0.72 + 0.28 * Math.pow(t, 0.8);
    const sz = 0.9 + 0.1 * t;
    p.setX(i, p.getX(i) * sx);
    // pecs / back curve
    const bulge = Math.sin(t * Math.PI) * 0.018;
    p.setZ(i, p.getZ(i) * sz + (p.getZ(i) > 0 ? bulge : -bulge * 0.5));
  }
  g.translate(0, 0.25, 0);
  g.computeVertexNormals();
  return g;
}

/**
 * Fighter material. HD: glossy clear-coated plastic (or polished metal).
 * Retro: flat-shaded Lambert with PS1 vertex snapping.
 */
export function fighterMat(color, { map = null, metal = false, skin = false, extra = {} } = {}) {
  if (!Q.hd) return lambert(color, map ? { map, ...extra } : extra);
  if (metal) {
    return new THREE.MeshPhysicalMaterial({
      color, map, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, ...extra,
    });
  }
  return new THREE.MeshPhysicalMaterial({
    color, map,
    metalness: 0,
    roughness: skin ? 0.45 : 0.32,
    clearcoat: skin ? 0.5 : 1,
    clearcoatRoughness: skin ? 0.18 : 0.03,
    envMapIntensity: skin ? 0.45 : 0.6,
    ...extra,
  });
}

/** Wet, glossy gore surfaces. */
export function wetMat(color, extra = {}) {
  if (!Q.hd) return lambert(color, extra);
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, ...extra });
}
