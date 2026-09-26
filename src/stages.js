// Arcade stages. Each stage builds itself into the scene and exposes
// update(dt, time), flash(amount) and dispose().
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lambert, canvasTexture } from './ps1.js';

export const STAGES = {
  temple: { name: 'SUNSET TEMPLE', music: 'temple' },
  neon: { name: 'NEON CITY', music: 'neon' },
  volcano: { name: 'MAGMA CORE', music: 'volcano' },
  cyber: { name: 'OMEGA GRID', music: 'boss' }, // final boss stage
};
export const STAGE_ORDER = ['temple', 'neon', 'volcano', 'cyber'];

export function createStage(id, scene) {
  const def = STAGES[id] ? id : 'temple';
  const kit = new Kit(scene);
  const impl = BUILDERS[def](kit, scene);
  let f = 0;
  return {
    id: def,
    name: STAGES[def].name,
    music: STAGES[def].music,
    update(dt, time) {
      f = Math.max(0, f - dt * 2.2);
      impl.update(dt, time, f);
    },
    flash(amount = 1) {
      f = Math.max(f, Math.min(1, amount));
      impl.onFlash?.(amount);
    },
    dispose() { kit.dispose(); },
  };
}

// ============================================================ helpers

const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const ADD = THREE.AdditiveBlending;

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Tracks everything a stage adds so dispose() can clean up completely. */
class Kit {
  constructor(scene) { this.scene = scene; this.objs = []; this.extra = []; }
  add(o) { this.scene.add(o); this.objs.push(o); return o; }
  track(x) { this.extra.push(x); return x; }
  dispose() {
    const seen = new Set();
    const d = (x) => { if (x && !seen.has(x)) { seen.add(x); x.dispose?.(); } };
    for (const o of this.objs) {
      this.scene.remove(o);
      o.traverse((n) => {
        if (n.isInstancedMesh) n.dispose();
        d(n.geometry);
        const ms = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of ms) { if (!m) continue; d(m.map); d(m.alphaMap); d(m); }
      });
    }
    for (const x of this.extra) d(x);
    this.objs = [];
    this.extra = [];
    this.scene.fog = null;
    this.scene.background = null;
  }
}

function xf(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const sc = typeof s === 'number' ? [s, s, s] : s;
  const rot = typeof r === 'number' ? [0, 0, 0] : r;
  const m = new THREE.Matrix4().compose(
    new V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new V3(...sc));
  return geo.applyMatrix4(m);
}

function flat(geo) {
  if (!geo.index) return geo;
  const g = geo.toNonIndexed();
  geo.dispose();
  return g;
}

/** Give a geometry a solid vertex colour (mult > 1 pushes it into bloom). */
function paint(geo, hex, mult = 1) {
  const g = flat(geo);
  const c = new THREE.Color(hex).multiplyScalar(mult);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

function merge(geos) {
  const list = geos.map(flat);
  const m = mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  return m;
}

/** One draw call for a pile of vertex-coloured, lit, flat-shaded parts. */
function solidMesh(parts) {
  return new THREE.Mesh(merge(parts), lambert(0xffffff, { vertexColors: true }));
}
function glowMesh(parts, extra = {}) {
  return new THREE.Mesh(merge(parts), new THREE.MeshBasicMaterial({ vertexColors: true, ...extra }));
}

function skyDome(stops, radius = 150) {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const cs = stops.map(([y, h]) => [y, new THREE.Color(h)]);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / radius;
    let k = 0;
    while (k < cs.length - 2 && y > cs[k + 1][0]) k++;
    const [y0, c0] = cs[k];
    const [y1, c1] = cs[k + 1];
    c.copy(c0).lerp(c1, Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1))));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

/** Smooth (linear-filtered) canvas texture for glows and gradients. */
function softTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const radialTex = () => softTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});

const dotTex = () => canvasTexture(8, 8, (g) => {
  g.fillStyle = '#fff';
  g.fillRect(2, 1, 4, 6);
  g.fillRect(1, 2, 6, 4);
});

function halo(kit, tex, color, size, pos, opacity = 1, fog = true) {
  const s = kit.add(new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, opacity, blending: ADD, depthWrite: false, fog,
  })));
  s.scale.setScalar(size);
  s.position.set(...pos);
  return s;
}

function particles(count, { tex, size, color = 0xffffff, additive = true, opacity = 1, vertexColors = false, fog = true }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (vertexColors) geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.PointsMaterial({
    map: tex, size, color, transparent: true, opacity, depthWrite: false,
    blending: additive ? ADD : THREE.NormalBlending, vertexColors, sizeAttenuation: true, fog,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts, pos, geo, mat };
}

function wrapCircle(g, x, y, r, w, h) {
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, TAU);
      g.fill();
    }
  }
}

/** Neon sign texture: dark panel, glowing frame and text. */
function signTex(text, color, { w = 128, h = 40, size = 26, frame = true, panel = true } = {}) {
  return canvasTexture(w, h, (g) => {
    g.clearRect(0, 0, w, h);
    if (panel) {
      g.fillStyle = 'rgba(8,4,20,0.9)';
      g.fillRect(2, 2, w - 4, h - 4);
    }
    g.shadowColor = color;
    g.shadowBlur = 6;
    if (frame) {
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.strokeRect(4, 4, w - 8, h - 8);
    }
    g.font = `bold ${size}px Impact, "Arial Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 1);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

function stdLights(kit, { hemiSky, hemiGround, hemi, key, keyI, rims }) {
  const L = {};
  L.hemi = kit.add(new THREE.HemisphereLight(hemiSky, hemiGround, hemi));
  L.key = kit.add(new THREE.DirectionalLight(key, keyI));
  L.key.position.set(-3, 6, 8);
  L.rims = rims.map(([c, i, p]) => {
    const d = kit.add(new THREE.DirectionalLight(c, i));
    d.position.set(...p);
    return d;
  });
  L.base = { hemi, key: keyI, rims: rims.map((r) => r[1]) };
  return L;
}

function setBg(scene, base, flashCol, f) {
  scene.background.copy(base).lerp(flashCol, f);
  scene.fog.color.copy(scene.background);
}

// ============================================================ 1. SUNSET TEMPLE

function buildTemple(kit, scene) {
  const r = rng(42);
  const bgBase = new THREE.Color(0xc86a78);
  const flashCol = new THREE.Color(0xfff0d0);
  scene.fog = new THREE.Fog(bgBase.clone(), 22, 110);
  scene.background = bgBase.clone();

  kit.add(skyDome([[-1, 0x5a2a48], [0, 0xffb060], [0.1, 0xff8a6a], [0.3, 0xd8567a], [0.65, 0x3a1a5a], [1, 0x140c30]]));

  // Sun + halo
  const sun = kit.add(new THREE.Mesh(new THREE.CircleGeometry(11, 18),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe08a).multiplyScalar(1.3), fog: false })));
  sun.position.set(24, 15, -125);
  const glow = kit.track(radialTex());
  const sunHalo = halo(kit, glow, 0xff9a50, 80, [24, 15, -123], 0.8, false);

  // Ground + platform
  const stone = canvasTexture(64, 64, (g, w, h) => {
    const rr = rng(7);
    g.fillStyle = '#5b4a4a';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = 110 + Math.floor(rr() * 30);
        g.fillStyle = `rgb(${v + 20},${v},${v - 8})`;
        g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
        for (let k = 0; k < 6; k++) {
          g.fillStyle = `rgba(0,0,0,${0.06 + rr() * 0.08})`;
          g.fillRect(x * 16 + 1 + Math.floor(rr() * 13), y * 16 + 1 + Math.floor(rr() * 13), 2, 1);
        }
      }
    }
  }, [65, 65]);
  const ground = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(260, 260), lambert(0xffffff, { map: stone })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;

  const tiles = canvasTexture(32, 32, (g, w, h) => {
    g.fillStyle = '#7a3a2a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b8805a';
    g.fillRect(1, 1, 14, 14); g.fillRect(17, 17, 14, 14);
    g.fillStyle = '#a8704c';
    g.fillRect(17, 1, 14, 14); g.fillRect(1, 17, 14, 14);
  }, [7, 4]);
  const side = lambert(0x5a2a1e);
  const plat = kit.add(new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8),
    [side, side, lambert(0xffffff, { map: tiles }), side, side, side]));
  plat.position.y = -0.15;

  // Static scenery – one merged, vertex-coloured mesh
  const S = [];
  S.push(paint(xf(new THREE.BoxGeometry(14.8, 0.22, 8.8), [0, -0.14, 0]), 0x2a1410));
  // Torii path
  for (const [z, s] of [[-14, 1], [-23, 0.92], [-32, 0.85]]) {
    for (const x of [-3.7, 3.7]) {
      S.push(paint(xf(new THREE.CylinderGeometry(0.3, 0.36, 6.5, 6), [x * s, 3.25 * s, z], 0, [s, s, s]), 0xc8302a));
      S.push(paint(xf(new THREE.BoxGeometry(0.95, 0.55, 0.95), [x * s, 0.27, z]), 0x1e1414));
    }
    S.push(paint(xf(new THREE.BoxGeometry(11, 0.5, 0.75), [0, 6.7 * s, z], [0, 0, 0], [s, 1, 1]), 0x1e1414));
    S.push(paint(xf(new THREE.BoxGeometry(10, 0.38, 0.62), [0, 6.3 * s, z], [0, 0, 0], [s, 1, 1]), 0xc8302a));
    S.push(paint(xf(new THREE.BoxGeometry(9, 0.32, 0.45), [0, 5.3 * s, z], [0, 0, 0], [s, 1, 1]), 0xc8302a));
  }
  // Low walls
  for (const x of [-14, 14]) S.push(paint(xf(new THREE.BoxGeometry(18, 1.1, 0.9), [x, 0.55, -9]), 0x8a7470));
  for (const x of [-14, 14]) S.push(paint(xf(new THREE.BoxGeometry(18.4, 0.25, 1.1), [x, 1.2, -9]), 0x4a3030));

  // Stone lanterns
  const lanternPos = [[-5.2, -5], [5.2, -5], [-8.8, 0.8], [8.8, 0.8], [-8, -12], [8, -12]];
  const G = [];
  for (const [x, z] of lanternPos) {
    S.push(paint(xf(new THREE.BoxGeometry(0.8, 0.22, 0.8), [x, 0.11, z]), 0x9a8a84));
    S.push(paint(xf(new THREE.CylinderGeometry(0.13, 0.18, 1.1, 6), [x, 0.75, z]), 0x9a8a84));
    S.push(paint(xf(new THREE.BoxGeometry(0.66, 0.14, 0.66), [x, 1.35, z]), 0x8a7a74));
    S.push(paint(xf(new THREE.ConeGeometry(0.62, 0.45, 4), [x, 1.98, z], [0, Math.PI / 4, 0]), 0x7a6a64));
    S.push(paint(xf(new THREE.BoxGeometry(0.12, 0.12, 0.12), [x, 2.26, z]), 0x7a6a64));
    G.push(paint(xf(new THREE.BoxGeometry(0.42, 0.36, 0.42), [x, 1.6, z]), 0xffc070, 1.2));
  }
  const lanternGlow = kit.add(glowMesh(G));
  const lanternHalos = lanternPos.map(([x, z]) => halo(kit, glow, 0xff9040, 2.2, [x, 1.6, z + 0.25], 0.7));

  // Cherry trees
  const cherry = [[-10, -7], [10.5, -8], [-15, -1.5], [15, -0.5], [-6.5, -16], [7, -17], [-19, -11], [19, -12], [-24, -5], [24, -4]];
  const pinks = [0xff7ab4, 0xff5c9e, 0xff9cc8, 0xf06aa6];
  for (const [x, z] of cherry) {
    const h = 3 + r() * 1.2;
    S.push(paint(xf(new THREE.CylinderGeometry(0.22, 0.4, h, 5), [x, h / 2, z], [0, 0, (r() - 0.5) * 0.2]), 0x3a2020));
    S.push(paint(xf(new THREE.CylinderGeometry(0.1, 0.16, 2, 4), [x + 0.7, h - 0.2, z], [0, 0, -0.9]), 0x3a2020));
    S.push(paint(xf(new THREE.CylinderGeometry(0.1, 0.16, 2, 4), [x - 0.7, h - 0.3, z], [0, 0, 0.9]), 0x3a2020));
    for (let k = 0; k < 6; k++) {
      const a = r() * TAU;
      const d = r() * 1.6;
      S.push(paint(xf(new THREE.IcosahedronGeometry(1.1 + r() * 0.8, 0),
        [x + Math.cos(a) * d, h + 0.4 + r() * 1.4, z + Math.sin(a) * d * 0.7], [r(), r(), r()]), pinks[k % 4]));
    }
  }

  // Pagoda
  const px = -26;
  const pz = -44;
  for (let i = 0; i < 5; i++) {
    const w = 7 - i * 1.1;
    const y = i * 2.7;
    S.push(paint(xf(new THREE.BoxGeometry(w, 2.2, w), [px, y + 1.1, pz]), 0xa0302a));
    S.push(paint(xf(new THREE.ConeGeometry(w * 0.95, 1.1, 4), [px, y + 2.6, pz], [0, Math.PI / 4, 0]), 0x2a3438));
  }
  S.push(paint(xf(new THREE.CylinderGeometry(0.12, 0.2, 4, 5), [px, 15.5, pz]), 0xd8b040));

  // Pines
  for (let i = 0; i < 30; i++) {
    const x = (r() - 0.5) * 80;
    const z = -16 - r() * 22;
    if (Math.abs(x) < 7) continue;
    const s = 0.9 + r() * 1.3;
    S.push(paint(xf(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.2 * s, 5), [x, 0.6 * s, z]), 0x3a2418));
    for (let k = 0; k < 3; k++) {
      S.push(paint(xf(new THREE.ConeGeometry((1.3 - k * 0.3) * s, 1.8 * s, 6), [x, (1.5 + k * 0.9) * s, z], [0, r() * 3, 0]), 0x1f3a2e));
    }
  }
  // Mountains
  const mcols = [0x5a3563, 0x6a3f6d, 0x4e2e5a];
  for (let i = 0; i < 16; i++) {
    const h = 12 + r() * 22;
    S.push(paint(xf(new THREE.ConeGeometry(10 + r() * 14, h, 5), [-100 + i * 13 + r() * 6, h / 2 - 1, -80 - r() * 25], [0, r() * 3, 0]), mcols[i % 3]));
  }
  kit.add(solidMesh(S));

  // Falling petals
  const petalTex = canvasTexture(8, 8, (g) => {
    g.fillStyle = '#ffd0e4';
    g.beginPath();
    g.ellipse(4, 4, 3.5, 2, 0.6, 0, TAU);
    g.fill();
  });
  const N = 500;
  const petals = particles(N, { tex: petalTex, size: 0.15, color: 0xffb0d4, additive: false });
  const ph = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    petals.pos[i * 3] = (r() - 0.5) * 34;
    petals.pos[i * 3 + 1] = r() * 10;
    petals.pos[i * 3 + 2] = -14 + r() * 22;
    ph[i] = r();
  }
  kit.add(petals.pts);

  // Clouds
  const cloudTex = softTex(64, 32, (g) => {
    const rr = rng(3);
    for (let i = 0; i < 9; i++) {
      const x = 12 + rr() * 40;
      const y = 12 + rr() * 10;
      const rad = 6 + rr() * 8;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 32);
    }
  });
  kit.track(cloudTex);
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const s = kit.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: i % 2 ? 0xffc0b0 : 0xf0a0c0, transparent: true, opacity: 0.75, fog: false, depthWrite: false })));
    s.scale.set(34 + r() * 20, 12 + r() * 6, 1);
    s.position.set(-120 + i * 32 + r() * 10, 30 + r() * 20, -120 - r() * 10);
    clouds.push(s);
  }

  // Birds
  const birdTex = [0, 1].map((f) => kit.track(canvasTexture(16, 8, (g) => {
    g.strokeStyle = '#2a1830';
    g.lineWidth = 2;
    g.beginPath();
    if (f === 0) { g.moveTo(1, 1); g.lineTo(8, 6); g.lineTo(15, 1); } else { g.moveTo(1, 5); g.lineTo(8, 4); g.lineTo(15, 5); }
    g.stroke();
  })));
  const birds = [];
  for (let i = 0; i < 6; i++) {
    const s = kit.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: birdTex[0], transparent: true, depthWrite: false })));
    s.scale.set(1.4, 0.7, 1);
    s.position.set(-50 + i * 2.5 + r() * 2, 16 + r() * 3 + (i % 2) * 1.2, -45 + r() * 4);
    birds.push(s);
  }

  const L = stdLights(kit, {
    hemiSky: 0xffd0a8, hemiGround: 0x4a3050, hemi: 1.5, key: 0xffe2b8, keyI: 2.3,
    rims: [[0xff7a5a, 1.8, [6, 4, -10]], [0xc070ff, 0.8, [-7, 3, -6]]],
  });

  const lanternBase = lanternGlow.material.color.clone();
  return {
    update(dt, t, f) {
      const p = petals.pos;
      for (let i = 0; i < N; i++) {
        const k = i * 3;
        p[k + 1] -= (0.55 + ph[i] * 0.6) * dt;
        p[k] += (0.45 + Math.sin(t * 1.3 + ph[i] * 10) * 0.7) * dt;
        p[k + 2] += Math.cos(t * 0.9 + ph[i] * 7) * 0.3 * dt;
        if (p[k + 1] < 0.02) { p[k + 1] = 9 + Math.random() * 2; p[k] = -17 + Math.random() * 30; }
        if (p[k] > 17) p[k] -= 34;
      }
      petals.geo.attributes.position.needsUpdate = true;

      const fl = 0.85 + 0.15 * Math.sin(t * 13.1) * Math.sin(t * 7.7);
      lanternGlow.material.color.copy(lanternBase).multiplyScalar(fl * (1 + f));
      lanternHalos.forEach((h, i) => { h.material.opacity = 0.55 + 0.25 * Math.sin(t * (11 + i) + i); });

      for (const c of clouds) { c.position.x += dt * 1.8; if (c.position.x > 140) c.position.x = -140; }
      birds.forEach((b, i) => {
        b.position.x += dt * 5;
        b.position.y += Math.sin(t * 2 + i) * dt * 0.4;
        if (b.position.x > 60) b.position.x = -60;
        b.material.map = birdTex[Math.floor(t * 6 + i) % 2];
      });

      L.key.intensity = L.base.key * (1 + f * 1.6);
      L.hemi.intensity = L.base.hemi * (1 + f * 0.9);
      sunHalo.scale.setScalar(80 * (1 + f * 0.8));
      sunHalo.material.opacity = 0.8 + 0.2 * f;
      setBg(scene, bgBase, flashCol, f * 0.6);
    },
  };
}

// ============================================================ 2. NEON CITY

function buildNeon(kit, scene) {
  const r = rng(77);
  const bgBase = new THREE.Color(0x0e0828);
  const flashCol = new THREE.Color(0x9a88e0);
  scene.fog = new THREE.Fog(bgBase.clone(), 18, 85);
  scene.background = bgBase.clone();
  kit.add(skyDome([[-1, 0x05030f], [0, 0x2a0c44], [0.07, 0x6a1a6a], [0.22, 0x1a0c3a], [1, 0x04020c]]));
  const glow = kit.track(radialTex());

  // Wet street
  const asphalt = canvasTexture(64, 64, (g, w, h) => {
    const rr = rng(11);
    g.fillStyle = '#1c1e32';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const v = 30 + Math.floor(rr() * 30);
      g.fillStyle = `rgba(${v},${v},${v + 30},0.5)`;
      g.fillRect(Math.floor(rr() * w), Math.floor(rr() * h), 1, 1);
    }
    g.fillStyle = 'rgba(80,90,140,0.25)';
    g.fillRect(0, 0, w, 1);
    g.fillRect(0, 0, 1, h);
  }, [80, 80]);
  const floor = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(260, 260), lambert(0xffffff, { map: asphalt })));
  floor.rotation.x = -Math.PI / 2;

  // Painted fight circle + road dashes (floor level)
  const F = [];
  const ring = new THREE.RingGeometry(3.3, 3.45, 40);
  F.push(paint(xf(ring, [0, 0.004, 0], [-Math.PI / 2, 0, 0]), 0x30d8ff, 0.55));
  for (let x = -40; x <= 40; x += 4) F.push(paint(xf(new THREE.PlaneGeometry(2, 0.2), [x, 0.004, -4.6], [-Math.PI / 2, 0, 0]), 0xd8c040, 0.6));
  kit.add(glowMesh(F, { polygonOffset: true, polygonOffsetFactor: -1 }));

  // Buildings (one merged mesh sharing a window texture)
  const winTex = canvasTexture(64, 64, (g, w, h) => {
    const rr = rng(5);
    g.fillStyle = '#0a0a16';
    g.fillRect(0, 0, w, h);
    const cols = ['#c8a060', '#c8a060', '#b89050', '#60c8e0', '#e060b8', '#a080e0'];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const lit = rr() < 0.38;
        g.fillStyle = lit ? cols[Math.floor(rr() * cols.length)] : '#161a30';
        g.fillRect(x * 16 + 3, y * 16 + 4, 10, 8);
        if (lit && rr() < 0.4) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x * 16 + 3, y * 16 + 4, 4, 8); }
      }
    }
  });
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  const B = [];
  const building = (x, z, w, h, d) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    // faces: +x,-x,+y,-y,+z,-z – 4 verts each
    for (let f = 0; f < 6; f++) {
      const sx = f < 2 ? d / 2.4 : w / 2.4;
      const sy = f === 2 || f === 3 ? d / 2.4 : h / 2.4;
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(sx)), uv.getY(i) * Math.max(1, Math.round(sy)));
      }
    }
    B.push(xf(g, [x, h / 2, z]));
    return { x, z, w, h, d, front: z + d / 2 };
  };
  const hero = {
    b1: building(-9, -26, 10, 22, 8),
    b2: building(1, -31, 10, 40, 8),
    b3: building(10.5, -25, 9, 18, 8),
    b4: building(-21, -33, 11, 30, 8),
    b5: building(21.5, -32, 11, 26, 8),
    l1: building(-16.5, -6, 9, 18, 9),
    l2: building(-17.5, 5, 11, 32, 9),
    r1: building(16.5, -5, 9, 22, 9),
    r2: building(17.5, 5.5, 11, 16, 9),
  };
  for (let i = 0; i < 26; i++) {
    const w = 7 + r() * 9;
    const h = 14 + r() * 40;
    const x = -90 + i * 7 + r() * 3;
    building(x, -38 - r() * 20, w, h, 8 + r() * 6);
  }
  for (let i = 0; i < 6; i++) {
    building(-30 - r() * 10, -14 + i * 7, 8, 16 + r() * 30, 7);
    building(30 + r() * 10, -14 + i * 7, 8, 16 + r() * 30, 7);
  }
  // skyline behind the default camera (seen by orbit cams)
  const behind = [];
  for (let i = 0; i < 12; i++) behind.push(building(-44 + i * 8 + r() * 2, 20 + r() * 8, 7 + r() * 3, 14 + r() * 34, 8));
  kit.add(new THREE.Mesh(merge(B), new THREE.MeshBasicMaterial({ map: winTex })));

  // Neon edge tubes, beacons, lamp heads, vending machine fronts (glow)
  const neonCols = [0xff2bd6, 0x20f0ff, 0xa060ff, 0xffe040, 0x40ff90];
  const N = [];
  Object.values(hero).forEach((b, i) => {
    const c = neonCols[i % neonCols.length];
    if (b.front > -5) return;
    for (const sx of [-1, 1]) N.push(paint(xf(new THREE.BoxGeometry(0.16, b.h - 2, 0.16), [b.x + sx * (b.w / 2 - 0.1), b.h / 2, b.front + 0.08]), c, 1.6));
    N.push(paint(xf(new THREE.BoxGeometry(b.w, 0.16, 0.16), [b.x, b.h - 0.6, b.front + 0.08]), c, 1.6));
  });
  // inner faces of side buildings
  for (const b of [hero.l1, hero.r1]) {
    const inner = b.x + (b.x < 0 ? b.w / 2 : -b.w / 2) + (b.x < 0 ? 0.08 : -0.08);
    N.push(paint(xf(new THREE.BoxGeometry(0.16, 0.16, b.d), [inner, 3.2, b.z]), b.x < 0 ? 0xff2bd6 : 0x20f0ff, 1.6));
    N.push(paint(xf(new THREE.BoxGeometry(0.16, 0.16, b.d), [inner, b.h - 0.5, b.z]), b.x < 0 ? 0x20f0ff : 0xff2bd6, 1.6));
  }
  // barrier rail + lamp heads + vending fronts
  N.push(paint(xf(new THREE.BoxGeometry(22, 0.1, 0.1), [0, 1.05, -7.0]), 0x20f0ff, 1.4));
  N.push(paint(xf(new THREE.PlaneGeometry(24, 2.4), [0, 1.5, -10.2]), 0x5a1680, 0.55));
  N.push(paint(xf(new THREE.BoxGeometry(24, 0.12, 0.12), [0, 2.75, -10.15]), 0xff2bd6, 1.5));
  N.push(paint(xf(new THREE.BoxGeometry(22, 0.1, 0.1), [0, 0.55, -7.0]), 0xff2bd6, 1.2));
  for (const x of [-7.5, 7.5]) N.push(paint(xf(new THREE.BoxGeometry(0.9, 0.2, 0.5), [x, 5.2, -6.2]), 0xffd8f0, 1.5));
  for (const x of [-11, 11]) N.push(paint(xf(new THREE.BoxGeometry(1.1, 1.3, 0.05), [x, 1.2, -8.47]), x < 0 ? 0x40c0ff : 0xff5070, 1.3));
  kit.add(glowMesh(N));

  const beaconGeo = [];
  for (const b of Object.values(hero)) beaconGeo.push(paint(xf(new THREE.BoxGeometry(0.4, 0.4, 0.4), [b.x, b.h + 1.6, b.z]), 0xff2020, 1.6));
  const beacons = kit.add(glowMesh(beaconGeo));

  // Solid street furniture (lit)
  const S = [];
  S.push(paint(xf(new THREE.BoxGeometry(80, 0.18, 1.2), [0, 0.09, -6.6]), 0x3a3a50));
  for (const x of [-7.5, 7.5]) {
    S.push(paint(xf(new THREE.CylinderGeometry(0.08, 0.12, 5.2, 5), [x, 2.6, -6.6]), 0x2a2a3a));
    S.push(paint(xf(new THREE.BoxGeometry(0.1, 0.1, 0.6), [x, 5.2, -6.35]), 0x2a2a3a));
  }
  for (const x of [-11, 11]) S.push(paint(xf(new THREE.BoxGeometry(1.3, 2.2, 0.9), [x, 1.1, -8.95]), 0x303048));
  for (const b of Object.values(hero)) S.push(paint(xf(new THREE.BoxGeometry(0.1, 3, 0.1), [b.x + 1, b.h + 1.5, b.z - 1]), 0x3a3a4a));
  // barrier posts
  for (let x = -10; x <= 10; x += 2.5) S.push(paint(xf(new THREE.BoxGeometry(0.12, 1.1, 0.12), [x, 0.55, -7.0]), 0x2a2a3a));
  kit.add(solidMesh(S));

  // Neon signs
  const signs = [];
  const sign = (text, color, w, h, pos, rotY = 0, opts = {}) => {
    const tex = signTex(text, color, opts);
    const m = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.35, 1.35, 1.35) })));
    m.position.set(...pos);
    m.rotation.y = rotY;
    signs.push({ m, base: 1.35, next: 1 + r() * 6, off: 0, color: new THREE.Color(color) });
    return m;
  };
  sign('ARCADE', '#ff38e0', 8, 2.5, [hero.b1.x, 5.2, hero.b1.front + 0.12]);
  sign('7×8=56', '#ffe040', 8, 2.5, [hero.b2.x, 12.5, hero.b2.front + 0.12]);
  sign('MATHS', '#30f0ff', 7, 2.2, [hero.b3.x, 6.5, hero.b3.front + 0.12]);
  sign('HI-SCORE', '#ff9030', 8, 2.2, [hero.b4.x, 9, hero.b4.front + 0.12], 0, { w: 160, size: 24 });
  sign('×÷+−', '#b070ff', 6, 2.4, [hero.b5.x, 7.5, hero.b5.front + 0.12]);
  sign('GAME ON', '#30f0ff', 8, 2.4, [behind[5].x, 6, behind[5].z - behind[5].d / 2 - 0.12], Math.PI, { w: 160, size: 26 });
  sign('9×9=81', '#ff38e0', 7, 2.2, [behind[8].x, 8, behind[8].z - behind[8].d / 2 - 0.12], Math.PI);
  sign('FIGHT', '#ff3030', 6, 2, [hero.l1.x + hero.l1.w / 2 + 0.12, 7.5, hero.l1.z], Math.PI / 2);
  sign('24H', '#40ff90', 3.5, 1.6, [hero.r1.x - hero.r1.w / 2 - 0.12, 5.5, hero.r1.z + 1], -Math.PI / 2, { w: 96 });
  sign('NOODLES', '#ffb040', 5, 1.5, [hero.r1.x - hero.r1.w / 2 - 0.12, 10.5, hero.r1.z - 1.5], -Math.PI / 2, { w: 160, size: 24 });

  // Giant video screen cycling messages
  const screenMsgs = [['READY?', '#30f0ff'], ['FIGHT!', '#ff3030'], ['COMBO!', '#ffe040'], ['K.O.', '#ff38e0'], ['9×9=81', '#40ff90']];
  const screenTex = screenMsgs.map(([t, c]) => kit.track(signTex(t, c, { w: 128, h: 72, size: 34 })));
  const screen = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), new THREE.MeshBasicMaterial({ map: screenTex[0], transparent: true, color: new THREE.Color(1.2, 1.2, 1.2) })));
  screen.position.set(hero.b2.x, 5.5, hero.b2.front + 0.12);

  // Wet-floor reflection streaks + light pools
  const streakTex = kit.track(softTex(16, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(3, 0, w - 6, h);
    g.clearRect(0, 20, w, 2);
    g.clearRect(0, 38, w, 2);
    g.clearRect(0, 52, w, 1);
  }));
  const refl = [];
  const addStreak = (x, zStart, w, len, color, op = 0.35) => {
    const m = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({
      map: streakTex, color, transparent: true, opacity: op, blending: ADD, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1,
    })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.006, zStart + len / 2);
    refl.push(m);
  };
  addStreak(hero.b1.x, hero.b1.front, 4, 24, 0xff38e0);
  addStreak(hero.b3.x, hero.b3.front, 3.5, 23, 0x30f0ff);
  addStreak(hero.b2.x, hero.b2.front, 5, 28, 0x30f0ff, 0.25);
  addStreak(-7.5, -6.6, 1.6, 9, 0xffd8f0, 0.3);
  addStreak(7.5, -6.6, 1.6, 9, 0xffd8f0, 0.3);
  addStreak(-11, -8.5, 1.2, 6, 0x40c0ff, 0.3);
  addStreak(11, -8.5, 1.2, 6, 0xff5070, 0.3);
  const pools = [[-7.5, -5.5, 0xffb0e0], [7.5, -5.5, 0xffb0e0], [0, 1.5, 0x6040ff]].map(([x, z, c]) => {
    const m = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({
      map: glow, color: c, transparent: true, opacity: 0.22, blending: ADD, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
    })));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.005, z);
    return m;
  });
  const lampHalos = [-7.5, 7.5].map((x) => halo(kit, glow, 0xffb0e0, 3, [x, 5.0, -6.1], 0.8));

  // Crowd (instanced silhouettes behind the barrier)
  const crowdGeo = merge([
    xf(new THREE.BoxGeometry(0.42, 0.75, 0.26), [0, 0.38, 0]),
    xf(new THREE.BoxGeometry(0.56, 0.62, 0.3), [0, 1.05, 0]),
    xf(new THREE.BoxGeometry(0.26, 0.28, 0.26), [0, 1.55, 0]),
    xf(new THREE.BoxGeometry(0.12, 0.55, 0.12), [0.36, 1.6, 0], [0, 0, -0.35]),
    xf(new THREE.BoxGeometry(0.12, 0.55, 0.12), [-0.36, 1.6, 0], [0, 0, 0.35]),
  ]);
  const CN = 34;
  const crowd = kit.add(new THREE.InstancedMesh(crowdGeo, lambert(0x3a3058), CN));
  const crowdData = [];
  for (let i = 0; i < CN; i++) {
    const row = i % 2;
    crowdData.push({ x: -10 + (i / CN) * 20 + (r() - 0.5) * 0.4, z: -7.8 - row * 0.9, s: 0.9 + r() * 0.25, ph: r() * TAU, sp: 5 + r() * 4, ry: (r() - 0.5) * 0.6 });
  }
  const dummy = new THREE.Object3D();

  // Flying traffic
  const CARS = 26;
  const cars = kit.add(new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.15, 0.15), new THREE.MeshBasicMaterial(), CARS));
  const carData = [];
  const lanes = [[9, -21, 1], [13, -27, -1], [17, -31, 1], [21, -35, -1], [11, -12, -1]];
  for (let i = 0; i < CARS; i++) {
    const [y, z, dir] = lanes[i % lanes.length];
    carData.push({ x: -70 + r() * 140, y: y + (r() - 0.5), z, v: dir * (14 + r() * 12) });
    cars.setColorAt(i, dir > 0 ? new THREE.Color(1.6, 1.6, 2.0) : new THREE.Color(2.0, 0.25, 0.25));
  }

  // Rain
  const RN = 700;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RN * 6);
  const rainData = new Float32Array(RN * 3);
  for (let i = 0; i < RN; i++) {
    rainData[i * 3] = (r() - 0.5) * 26;
    rainData[i * 3 + 1] = r() * 13;
    rainData[i * 3 + 2] = -12 + r() * 20;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = kit.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xa0c0ff, transparent: true, opacity: 0.4, depthWrite: false })));
  rain.frustumCulled = false;

  const L = stdLights(kit, {
    hemiSky: 0x7080ff, hemiGround: 0x401838, hemi: 1.4, key: 0xd8d8ff, keyI: 2.0,
    rims: [[0xff30c0, 2.4, [-8, 4, -8]], [0x20e0ff, 2.4, [8, 4, -8]]],
  });

  let lightningT = 6;
  let lf = 0;
  let screenIdx = 0;
  return {
    update(dt, t, f) {
      // random ambient lightning
      lightningT -= dt;
      if (lightningT <= 0) { lf = 0.7; lightningT = 8 + Math.random() * 10; }
      lf = Math.max(0, lf - dt * 4);
      const flick = lf > 0 && Math.sin(t * 60) > 0 ? lf : lf * 0.3;
      const F2 = Math.max(f, flick);

      for (const s of signs) {
        s.next -= dt;
        if (s.next <= 0) {
          if (s.off > 0) { s.off = 0; s.next = 2 + Math.random() * 7; } else { s.off = 1; s.next = 0.05 + Math.random() * 0.2; }
        }
        const k = s.off ? 0.12 : s.base * (1 + F2 * 1.2);
        s.m.material.color.setScalar(k);
      }
      const si = Math.floor(t / 1.1) % screenTex.length;
      if (si !== screenIdx) { screenIdx = si; screen.material.map = screenTex[si]; }
      screen.material.color.setScalar(1.1 + 0.15 * Math.sin(t * 20) + F2);
      beacons.material.color.setScalar(Math.sin(t * 3) > 0.3 ? 1 : 0.1);
      for (const p of pools) p.material.opacity = 0.2 + F2 * 0.3;
      for (const h of lampHalos) h.material.opacity = 0.7 + 0.1 * Math.sin(t * 17);
      for (const m of refl) m.material.opacity = (m.userData.o ??= m.material.opacity) * (0.85 + 0.15 * Math.sin(t * 3 + m.position.x) + F2);

      crowdData.forEach((c, i) => {
        dummy.position.set(c.x, Math.abs(Math.sin(t * c.sp + c.ph)) * 0.14, c.z);
        dummy.rotation.set(0, c.ry, Math.sin(t * c.sp * 0.5 + c.ph) * 0.05);
        dummy.scale.setScalar(c.s);
        dummy.updateMatrix();
        crowd.setMatrixAt(i, dummy.matrix);
      });
      crowd.instanceMatrix.needsUpdate = true;

      carData.forEach((c, i) => {
        c.x += c.v * dt;
        if (c.x > 75) c.x -= 150;
        if (c.x < -75) c.x += 150;
        dummy.position.set(c.x, c.y + Math.sin(t + i) * 0.2, c.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        cars.setMatrixAt(i, dummy.matrix);
      });
      cars.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < RN; i++) {
        const k = i * 3;
        rainData[k + 1] -= 16 * dt;
        rainData[k] += 2 * dt;
        if (rainData[k + 1] < 0) { rainData[k + 1] += 13; rainData[k] = (Math.random() - 0.5) * 26; }
        const j = i * 6;
        rainPos[j] = rainData[k]; rainPos[j + 1] = rainData[k + 1]; rainPos[j + 2] = rainData[k + 2];
        rainPos[j + 3] = rainData[k] - 0.06; rainPos[j + 4] = rainData[k + 1] + 0.45; rainPos[j + 5] = rainData[k + 2];
      }
      rainGeo.attributes.position.needsUpdate = true;

      L.hemi.intensity = L.base.hemi * (1 + F2 * 1.5);
      L.key.intensity = L.base.key * (1 + F2 * 0.8);
      setBg(scene, bgBase, flashCol, F2 * 0.7);
    },
  };
}

// ============================================================ 3. MAGMA CORE

function buildVolcano(kit, scene) {
  const r = rng(1234);
  const bgBase = new THREE.Color(0x3a0c06);
  const flashCol = new THREE.Color(0xff8a30);
  scene.fog = new THREE.Fog(bgBase.clone(), 26, 150);
  scene.background = bgBase.clone();
  kit.add(skyDome([[-1, 0x100202], [0, 0xa02a08], [0.08, 0x5a1206], [0.3, 0x240604], [1, 0x080101]]));
  const glow = kit.track(radialTex());

  const lavaDraw = (seed) => (g, w, h) => {
    const rr = rng(seed);
    g.fillStyle = '#ff4a00';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb020';
    for (let i = 0; i < 40; i++) wrapCircle(g, rr() * w, rr() * h, 2 + rr() * 5, w, h);
    g.fillStyle = '#fff080';
    for (let i = 0; i < 26; i++) wrapCircle(g, rr() * w, rr() * h, 1 + rr() * 2, w, h);
    g.fillStyle = 'rgba(80,10,0,0.9)';
    for (let i = 0; i < 22; i++) wrapCircle(g, rr() * w, rr() * h, 2 + rr() * 6, w, h);
  };
  const lavaTex = canvasTexture(64, 64, lavaDraw(9), [60, 60]);
  const lavaTex2 = canvasTexture(64, 64, lavaDraw(21), [23, 23]);
  const lava = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: lavaTex, color: new THREE.Color(1.25, 1.1, 1) })));
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -0.6;
  const lava2 = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshBasicMaterial({ map: lavaTex2, transparent: true, opacity: 0.35, blending: ADD, depthWrite: false })));
  lava2.rotation.x = -Math.PI / 2;
  lava2.position.y = -0.58;

  // Basalt platform
  const basalt = canvasTexture(128, 128, (g, w, h) => {
    const rr = rng(31);
    g.fillStyle = '#1a1210';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const v = 44 + Math.floor(rr() * 22);
        g.fillStyle = `rgb(${v + 8},${v - 4},${v - 10})`;
        g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(x * 16 + 1, y * 16 + 12, 14, 3);
      }
    }
  });
  const rockSide = lambert(0x2e1c16);
  const plat = kit.add(new THREE.Mesh(new THREE.CylinderGeometry(7.6, 8.8, 1.2, 10), [rockSide, lambert(0xffffff, { map: basalt }), rockSide]));
  plat.position.y = -0.6;

  const crackTex = canvasTexture(128, 128, (g, w, h) => {
    const rr = rng(55);
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineCap = 'square';
    for (let i = 0; i < 11; i++) {
      let x = w / 2 + (rr() - 0.5) * 30;
      let y = h / 2 + (rr() - 0.5) * 30;
      let a = rr() * TAU;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 14; k++) {
        a += (rr() - 0.5) * 1.1;
        x += Math.cos(a) * 5;
        y += Math.sin(a) * 5;
        g.lineTo(x, y);
        if (k === 7) g.lineWidth = 1;
      }
      g.stroke();
    }
  });
  const cracks = kit.add(new THREE.Mesh(new THREE.CircleGeometry(7.5, 10), new THREE.MeshBasicMaterial({
    map: crackTex, color: new THREE.Color(1.4, 0.5, 0.12), transparent: true, blending: ADD, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  })));
  cracks.rotation.x = -Math.PI / 2;
  cracks.position.y = 0.003;

  const G = [];
  G.push(paint(xf(new THREE.TorusGeometry(8.3, 0.18, 3, 10), [0, -0.52, 0], [Math.PI / 2, 0, 0]), 0xff6a10, 1.5));

  // Rocks, pillars, cliffs, volcano
  const S = [];
  const rockCols = [0x2a1a16, 0x3a241c, 0x221412, 0x4a2a1e];
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU;
    const d = 13 + r() * 26;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d * 0.8 - 4;
    if (z > 4 && Math.abs(x) < 12) continue;
    if (z < -8 && Math.abs(x) < 10) continue;
    const h = 2 + r() * (d > 22 ? 16 : 7);
    S.push(paint(xf(new THREE.ConeGeometry(0.8 + r() * 2.2, h, 5), [x, h / 2 - 0.6, z], [r() * 0.2, r() * 3, r() * 0.2]), rockCols[i % 4]));
  }
  // cliffs behind with lava falls
  const cliffs = [[-17, -34, 7], [18, -36, 7.5], [-33, -30, 8], [34, -32, 8.5], [-9, -52, 6], [11, -55, 6.5]];
  for (const [x, z, s] of cliffs) {
    S.push(paint(xf(new THREE.IcosahedronGeometry(s, 0), [x, s * 0.7, z], [r(), r(), r()], [1.3, 1.6, 1]), rockCols[Math.floor(r() * 4)]));
  }
  // volcano
  S.push(paint(xf(new THREE.ConeGeometry(52, 36, 9), [0, 16, -125]), 0x2a1410));
  S.push(paint(xf(new THREE.ConeGeometry(40, 30, 7), [-70, 13, -105]), 0x1e100c));
  S.push(paint(xf(new THREE.ConeGeometry(45, 34, 7), [75, 15, -110]), 0x24120e));
  kit.add(solidMesh(S));

  // crater glow
  G.push(paint(xf(new THREE.CylinderGeometry(6, 8.5, 1.5, 9), [0, 33.5, -125]), 0xff8a20, 1.6));
  const glowStatic = kit.add(glowMesh(G));
  const craterHalo = halo(kit, glow, 0xff6010, 55, [0, 36, -123], 0.9, false);

  // lava falls (vertical scrolling)
  const fallTex = canvasTexture(64, 64, lavaDraw(77), [1, 3]);
  const falls = [];
  for (const [x, z, h] of [[-15.5, -28, 13], [16, -29.5, 14], [-30, -23.5, 14]]) {
    const m = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, h), new THREE.MeshBasicMaterial({ map: fallTex, color: new THREE.Color(1.3, 1.1, 1) })));
    m.position.set(x, h / 2 - 0.6, z);
    falls.push(m);
    halo(kit, glow, 0xff7020, 9, [x, 0.3, z + 1], 0.8);
  }
  // lava streams on the volcano
  const streamTex = canvasTexture(64, 64, lavaDraw(90), [1, 6]);
  const slopeA = Math.atan2(36, 52);
  for (const ang of [-0.4, 0.12, 0.55]) {
    const grp = new THREE.Group();
    grp.position.set(0, -2, -125);
    grp.rotation.y = ang;
    const len = Math.hypot(36, 52) * 0.8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len), new THREE.MeshBasicMaterial({ map: streamTex, color: new THREE.Color(1.0, 0.85, 0.8), fog: false }));
    m.rotation.x = -(Math.PI / 2 - slopeA);
    m.position.set(0, 36 * 0.6 + 0.4, 52 * 0.4 + 0.4);
    grp.add(m);
    kit.add(grp);
  }

  // embers
  const EN = 520;
  const emberTex = kit.track(dotTex());
  const embers = particles(EN, { tex: emberTex, size: 0.09, vertexColors: true });
  const eCol = embers.geo.attributes.color.array;
  const eSpd = new Float32Array(EN);
  for (let i = 0; i < EN; i++) {
    embers.pos[i * 3] = (r() - 0.5) * 36;
    embers.pos[i * 3 + 1] = r() * 12;
    embers.pos[i * 3 + 2] = -18 + r() * 26;
    const c = new THREE.Color().setHSL(0.02 + r() * 0.08, 1, 0.55);
    eCol[i * 3] = c.r * 1.8; eCol[i * 3 + 1] = c.g * 1.6; eCol[i * 3 + 2] = c.b;
    eSpd[i] = 0.6 + r() * 1.6;
  }
  kit.add(embers.pts);

  // eruption bursts
  const BN = 180;
  const burst = particles(BN, { tex: emberTex, size: 2.2, color: 0xffa040, fog: false });
  const bVel = new Float32Array(BN * 3);
  burst.pts.visible = false;
  kit.add(burst.pts);
  let burstT = 3;
  let burstLife = 0;
  const erupt = () => {
    for (let i = 0; i < BN; i++) {
      burst.pos[i * 3] = (Math.random() - 0.5) * 6;
      burst.pos[i * 3 + 1] = 34;
      burst.pos[i * 3 + 2] = -125 + (Math.random() - 0.5) * 6;
      bVel[i * 3] = (Math.random() - 0.5) * 28;
      bVel[i * 3 + 1] = 14 + Math.random() * 26;
      bVel[i * 3 + 2] = (Math.random() - 0.5) * 16 + 4;
    }
    burst.pts.visible = true;
    burstLife = 3.2;
  };

  const L = stdLights(kit, {
    hemiSky: 0xff9060, hemiGround: 0x2a0808, hemi: 1.2, key: 0xffd0b0, keyI: 2.1,
    rims: [[0xff5010, 2.8, [0, -3, -6]], [0xff8a30, 1.5, [7, 3, -5]]],
  });

  const lavaBase = lava.material.color.clone();
  const fallBase = falls[0].material.color.clone();
  const glowBase = glowStatic.material.color.clone();
  return {
    update(dt, t, f) {
      lavaTex.offset.x += dt * 0.025;
      lavaTex.offset.y += dt * 0.012;
      lavaTex2.offset.x -= dt * 0.04;
      lavaTex2.offset.y += dt * 0.02;
      fallTex.offset.y += dt * 0.9;
      streamTex.offset.y += dt * 0.15;
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.3);
      lava.material.color.copy(lavaBase).multiplyScalar(pulse * (1 + f * 0.8));
      for (const m of falls) m.material.color.copy(fallBase).multiplyScalar(1 + f * 0.6);
      glowStatic.material.color.copy(glowBase).multiplyScalar(pulse * (1 + f));
      cracks.material.opacity = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.7)) + f * 0.5;
      craterHalo.material.opacity = 0.7 + 0.3 * Math.sin(t * 5) * Math.sin(t * 3.1) + f * 0.3;

      const p = embers.pos;
      for (let i = 0; i < EN; i++) {
        const k = i * 3;
        p[k + 1] += eSpd[i] * dt;
        p[k] += Math.sin(t * 2 + i) * 0.3 * dt;
        if (p[k + 1] > 12) { p[k + 1] = 0; p[k] = (Math.random() - 0.5) * 36; }
      }
      embers.geo.attributes.position.needsUpdate = true;

      burstT -= dt;
      if (burstT <= 0) { erupt(); burstT = 5 + Math.random() * 5; }
      if (burstLife > 0) {
        burstLife -= dt;
        for (let i = 0; i < BN; i++) {
          const k = i * 3;
          bVel[k + 1] -= 18 * dt;
          burst.pos[k] += bVel[k] * dt;
          burst.pos[k + 1] += bVel[k + 1] * dt;
          burst.pos[k + 2] += bVel[k + 2] * dt;
        }
        burst.geo.attributes.position.needsUpdate = true;
        burst.mat.opacity = Math.min(1, burstLife);
        if (burstLife <= 0) burst.pts.visible = false;
      }

      L.rims[0].intensity = L.base.rims[0] * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.7)) * (1 + f);
      L.key.intensity = L.base.key * (1 + f * 1.2);
      L.hemi.intensity = L.base.hemi * (1 + f * 0.8);
      setBg(scene, bgBase, flashCol, f * 0.55);
    },
    onFlash(a) { if (a >= 0.7 && burstLife <= 0) erupt(); },
  };
}

// ============================================================ 4. OMEGA GRID

function buildCyber(kit, scene) {
  const r = rng(999);
  const bgBase = new THREE.Color(0x1c0838);
  const flashCol = new THREE.Color(0xa050ff);
  scene.fog = new THREE.Fog(bgBase.clone(), 30, 190);
  scene.background = bgBase.clone();
  kit.add(skyDome([[-1, 0x05010c], [0, 0x2a0a48], [0.05, 0xc0306a], [0.14, 0x5a1470], [0.4, 0x1a0636], [1, 0x04010a]]));
  const glow = kit.track(radialTex());

  // Stars
  const SN = 700;
  const starTex = kit.track(dotTex());
  const stars = particles(SN, { tex: starTex, size: 1.2, color: 0xffffff, fog: false });
  for (let i = 0; i < SN; i++) {
    const a = r() * TAU;
    const el = 0.08 + r() * 1.4;
    stars.pos[i * 3] = Math.cos(a) * Math.cos(el) * 140;
    stars.pos[i * 3 + 1] = Math.sin(el) * 140;
    stars.pos[i * 3 + 2] = Math.sin(a) * Math.cos(el) * 140;
  }
  kit.add(stars.pts);

  // Retro sun
  const sunTex = kit.track(softTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#fff26a');
    gr.addColorStop(0.5, '#ff9a3a');
    gr.addColorStop(1, '#ff2a9a');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 1, 0, TAU);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let y = 62, k = 1; y < h; y += 10, k++) g.fillRect(0, y, w, Math.min(8, 1 + k));
  }));
  const sun = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, color: new THREE.Color(0.72, 0.72, 0.72), depthWrite: false })));
  sun.position.set(0, 13, -140);
  const sunHalo = halo(kit, glow, 0xff4aa0, 110, [0, 13, -138], 0.18, false);

  // Neon grid floor (scrolls)
  const gridTex = canvasTexture(32, 32, (g, w, h) => {
    g.fillStyle = '#0c0420';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff38d8';
    g.fillRect(0, 0, w, 2);
    g.fillRect(0, 0, 2, h);
  }, [100, 100]);
  gridTex.minFilter = THREE.LinearMipmapLinearFilter;
  gridTex.generateMipmaps = true;
  gridTex.anisotropy = 4;
  gridTex.needsUpdate = true;
  const grid = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ map: gridTex, color: new THREE.Color(1.1, 1.1, 1.1) })));
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.25;

  // Hex platform
  const circuit = canvasTexture(64, 64, (g, w, h) => {
    const rr = rng(8);
    g.fillStyle = '#1a1030';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a4a9a';
    g.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      let x = Math.floor(rr() * 8) * 8;
      let y = Math.floor(rr() * 8) * 8;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (rr() < 0.5) x += (rr() < 0.5 ? -1 : 1) * 8 * (1 + Math.floor(rr() * 3));
        else y += (rr() < 0.5 ? -1 : 1) * 8 * (1 + Math.floor(rr() * 3));
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = '#5a6ad0';
      g.fillRect(x - 1, y - 1, 3, 3);
    }
  }, [5, 5]);
  const pside = lambert(0x160c2a);
  const plat = kit.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.3, 6), [pside, lambert(0xffffff, { map: circuit }), pside]));
  plat.position.y = -0.15;
  plat.rotation.y = Math.PI / 6;

  const hexRing = (R, t, y, hex, mult) => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const m = Math.PI / 6 + i * (Math.PI / 3) + Math.PI / 6;
      const ap = R * Math.cos(Math.PI / 6);
      parts.push(paint(xf(new THREE.BoxGeometry(R + t, t, t), [Math.sin(m) * ap, y, Math.cos(m) * ap], [0, m, 0]), hex, mult));
    }
    return parts;
  };
  const ringParts = [...hexRing(7.02, 0.09, 0.02, 0x30f0ff, 1.6), ...hexRing(7.42, 0.12, -0.28, 0xff38d8, 1.6)];
  const rings = kit.add(glowMesh(ringParts));
  const floorRing = kit.add(new THREE.Mesh(new THREE.RingGeometry(3.25, 3.4, 48), new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.3, 0.3, 1.1), transparent: true, opacity: 0.8, blending: ADD, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -1,
  })));
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.004;

  // Wireframe mountains
  const ridge = (cx, cz, w, d, amp, seg, hex, seed) => {
    const rr = rng(seed);
    const g = new THREE.PlaneGeometry(w, d, seg, 6);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const ph = [rr() * 10, rr() * 10, rr() * 10];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const edge = Math.sin(((z / d) + 0.5) * Math.PI);
      const side = 0.35 + Math.min(1, Math.abs(x + cx) / 45);
      const n = Math.abs(Math.sin(x * 0.11 + ph[0]) + Math.sin(x * 0.23 + ph[1]) * 0.6 + Math.sin(x * 0.05 + ph[2]) * 0.8) + rr() * 0.4;
      pos.setY(i, n * amp * edge * side);
    }
    g.translate(cx, -0.3, cz);
    return paint(g, hex, 1.0);
  };
  const ridgeGeo = merge([
    ridge(0, -85, 200, 30, 11, 40, 0xff38d8, 4),
    ridge(0, -112, 240, 30, 20, 40, 0x30f0ff, 6),
  ]);
  kit.add(new THREE.Mesh(ridgeGeo, new THREE.MeshBasicMaterial({ color: 0x0e0420, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
  const wire = kit.add(new THREE.Mesh(ridgeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, wireframe: true })));

  // Pillars (pulse to the beat) + dark bases
  const P = [[], []];
  const S = [];
  const pillarPos = [[-10, -8], [10, -8], [-14, -15], [14, -15], [-18, -23], [18, -23], [-23, -32], [23, -32]];
  pillarPos.forEach(([x, z], i) => {
    P[i % 2].push(paint(xf(new THREE.BoxGeometry(0.3, 12, 0.3), [x, 6.5, z]), i % 2 ? 0xff38d8 : 0x30f0ff, 1.1));
    S.push(paint(xf(new THREE.BoxGeometry(1.4, 0.6, 1.4), [x, 0.05, z]), 0x1e1238));
    S.push(paint(xf(new THREE.BoxGeometry(0.9, 0.3, 0.9), [x, 12.6, z]), 0x1e1238));
  });
  kit.add(solidMesh(S));
  const pillars = P.map((parts) => kit.add(glowMesh(parts)));

  // Floating geometry
  const shapes = [];
  const geos = [
    () => new THREE.OctahedronGeometry(2.2, 0),
    () => new THREE.IcosahedronGeometry(2.3, 0),
    () => new THREE.TorusGeometry(2.2, 0.35, 4, 10),
    () => new THREE.TetrahedronGeometry(2.4, 0),
    () => new THREE.BoxGeometry(2.8, 2.8, 2.8),
  ];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI + (r() - 0.5) * 2.6;
    const d = 20 + r() * 20;
    const col = i % 2 ? 0x30f0ff : 0xff38d8;
    const geo = geos[i % geos.length]();
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(1.1), wireframe: true })));
    grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: ADD, depthWrite: false })));
    grp.position.set(Math.sin(a) * d, 7 + r() * 11, Math.cos(a) * d - 6);
    grp.scale.setScalar(0.7 + r() * 0.8);
    kit.add(grp);
    shapes.push({ grp, y: grp.position.y, sx: (r() - 0.5) * 1.2, sy: (r() - 0.5) * 1.2, ph: r() * TAU });
  }

  // Searchlight beams
  const beamGeo = new THREE.CylinderGeometry(0.1, 1.1, 80, 6, 1, true);
  beamGeo.translate(0, 40, 0);
  const beams = [[-26, -42, 0x30f0ff], [26, -42, 0xff38d8], [-44, -62, 0xff38d8], [44, -62, 0x30f0ff]].map(([x, z, c], i) => {
    const m = kit.add(new THREE.Mesh(i === 0 ? beamGeo : beamGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, blending: ADD, depthWrite: false, side: THREE.DoubleSide })));
    m.position.set(x, 0, z);
    return m;
  });

  // OMEGA hologram
  const holoTex = canvasTexture(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'bold 52px Impact, "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#30f0ff';
    g.shadowBlur = 8;
    g.strokeStyle = '#30f0ff';
    g.lineWidth = 3;
    g.strokeText('OMEGA', w / 2, h / 2 + 2);
    g.fillStyle = 'rgba(48,240,255,0.35)';
    g.fillText('OMEGA', w / 2, h / 2 + 2);
    g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
  const holo = kit.add(new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, blending: ADD, depthWrite: false, color: new THREE.Color(0.7, 0.7, 0.7) })));
  holo.position.set(0, 14, -48);

  const L = stdLights(kit, {
    hemiSky: 0x9a70ff, hemiGround: 0x200040, hemi: 1.4, key: 0xffe0ff, keyI: 2.0,
    rims: [[0x30f0ff, 2.6, [-7, 4, -8]], [0xff30d0, 2.6, [7, 4, -8]]],
  });

  const pillarBase = pillars.map((m) => m.material.color.clone());
  const ringBase = rings.material.color.clone();
  const wireBase = wire.material.color.clone();
  return {
    update(dt, t, f) {
      gridTex.offset.y += dt * 0.35;
      const beat = Math.pow(0.5 + 0.5 * Math.cos(t * TAU * 2.5), 3); // ~150 bpm
      const beat2 = Math.pow(0.5 + 0.5 * Math.cos(t * TAU * 2.5 + Math.PI), 3);
      pillars[0].material.color.copy(pillarBase[0]).multiplyScalar((0.45 + 0.6 * beat) * (1 + f * 1.5));
      pillars[1].material.color.copy(pillarBase[1]).multiplyScalar((0.45 + 0.6 * beat2) * (1 + f * 1.5));
      rings.material.color.copy(ringBase).multiplyScalar((0.8 + 0.4 * beat) * (1 + f));
      wire.material.color.copy(wireBase).multiplyScalar(1 + f * 0.8);
      grid.material.color.setScalar(1.1 * (1 + f * 1.2));
      floorRing.material.opacity = 0.5 + 0.4 * beat + f * 0.5;
      for (const s of shapes) {
        s.grp.rotation.x += s.sx * dt;
        s.grp.rotation.y += s.sy * dt;
        s.grp.position.y = s.y + Math.sin(t * 0.8 + s.ph) * 0.8;
      }
      beams.forEach((b, i) => {
        b.rotation.z = Math.sin(t * 0.4 + i * 1.3) * 0.45;
        b.rotation.x = Math.cos(t * 0.3 + i) * 0.15 - 0.2;
        b.material.opacity = 0.06 + 0.05 * (i % 2 ? beat2 : beat) + f * 0.15;
      });
      holo.material.opacity = Math.random() < 0.04 ? 0.3 : 0.85 + 0.15 * Math.sin(t * 30);
      holo.material.color.setScalar(0.7 * (1 + f));
      holo.position.y = 14 + Math.sin(t * 0.7) * 0.4;
      stars.mat.opacity = 0.7 + 0.3 * Math.sin(t * 1.3);
      stars.pts.rotation.y = t * 0.004;
      sunHalo.material.opacity = 0.18 + f * 0.4;
      sun.material.color.setScalar(0.72 * (1 + f * 0.6));
      L.hemi.intensity = L.base.hemi * (1 + f * 1.2);
      L.key.intensity = L.base.key * (1 + f * 0.8);
      setBg(scene, bgBase, flashCol, f * 0.6);
    },
  };
}

const BUILDERS = { temple: buildTemple, neon: buildNeon, volcano: buildVolcano, cyber: buildCyber };
