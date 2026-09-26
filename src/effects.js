// Hit sparks, shockwaves and dust puffs.
import * as THREE from 'three';
import { canvasTexture } from './ps1.js';

const starTex = canvasTexture(32, 32, (g, w, h) => {
  g.translate(w / 2, h / 2);
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 4 : 15;
    const a = (i / 16) * Math.PI * 2;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.fill();
});

const dotTex = canvasTexture(8, 8, (g) => {
  g.fillStyle = '#fff';
  g.fillRect(2, 0, 4, 8);
  g.fillRect(0, 2, 8, 4);
});

const ringTex = canvasTexture(32, 32, (g, w, h) => {
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(w / 2, h / 2, 13, 0, Math.PI * 2);
  g.stroke();
});

// Irregular blood splat decals (a few variants).
const splatTex = [0, 1, 2].map((seed) => canvasTexture(32, 32, (g, w, h) => {
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(w / 2, h / 2, 7 + rnd() * 3, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 6 + rnd() * 8;
    const rad = 1 + rnd() * 3;
    g.beginPath();
    g.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, rad, 0, Math.PI * 2);
    g.fill();
  }
}));

const BLOOD_COLS = [0x8a0006, 0xb0000c, 0x6a0004, 0xc01018];

// Shared materials so hundreds of droplets / splats stay cheap.
const dropMats = BLOOD_COLS.map((color) => new THREE.SpriteMaterial({ map: dotTex, color, depthWrite: false }));
const splatMats = [];
for (const tex of splatTex) {
  for (const color of BLOOD_COLS) {
    splatMats.push(new THREE.MeshBasicMaterial({
      map: tex, color, transparent: true, opacity: 0.92, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    }));
  }
}
const planeGeo = new THREE.PlaneGeometry(1, 1);
const toothGeo = new THREE.BoxGeometry(0.035, 0.045, 0.03);
const toothMat = new THREE.MeshLambertMaterial({ color: 0xf4f0e0 });

const streakTex = canvasTexture(32, 4, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 1, w, 2);
});

const flameTex = canvasTexture(8, 12, (g) => {
  g.fillStyle = '#fff';
  g.fillRect(3, 0, 2, 2);
  g.fillRect(2, 2, 4, 4);
  g.fillRect(1, 5, 6, 5);
  g.fillRect(2, 10, 4, 2);
});

const ringGeo = new THREE.PlaneGeometry(1, 1);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.decals = [];
    this.gore = 2; // 0 off, 1 arcade, 2 extreme
    this.onSplat = null;
  }

  drop(pos, vel, size) {
    const p = new THREE.Sprite(dropMats[Math.floor(Math.random() * dropMats.length)]);
    p.scale.setScalar(size);
    p.position.copy(pos);
    this.scene.add(p);
    const it = {
      s: p, life: 3, t: 0, grow: 0, vel, g: 9.8, keep: true, shared: true,
      onFloor: (d) => {
        if (Math.random() < (this.gore === 2 ? 0.7 : 0.6)) {
          this.splat(d.s.position.x, d.s.position.z, size * (2.5 + Math.random() * 2.5));
        }
        this.onSplat?.();
      },
    };
    this.items.push(it);
    return it;
  }

  /** Spray blood from pos, mostly along dir (unit-ish vector). */
  blood(pos, dir, strength = 1) {
    if (!this.gore) return;
    const extreme = this.gore === 2;
    const n = Math.min(320, Math.round((10 + strength * 14) * (extreme ? 9 : 1)));
    for (let i = 0; i < n; i++) {
      const gush = extreme && i % 3 === 0; // fast arterial stream along the hit direction
      const sp = gush ? 2 + Math.random() * 3.5 * strength : 0.5 + Math.random() * 1.6 * strength;
      const v = new THREE.Vector3(
        dir.x * sp + (Math.random() - 0.5) * (extreme ? 1.4 : 0.5),
        (gush ? 1.2 : 0.4) + Math.random() * (extreme ? 3 : 1.8),
        dir.z + (Math.random() - 0.5) * (extreme ? 2 : 0.9),
      );
      this.drop(pos, v, (extreme ? 0.05 : 0.04) + Math.random() * (extreme ? 0.09 : 0.06));
    }
    // mist cloud at the impact
    const puffs = extreme ? 2 : 1;
    for (let i = 0; i < puffs; i++) {
      const mist = this.sprite(dotTex, 0x9a0008, 0.12 + i * 0.04, false);
      mist.position.copy(pos);
      const v = dir.clone().multiplyScalar(0.6 + Math.random()).add(new THREE.Vector3(0, Math.random() * 0.5, (Math.random() - 0.5) * 0.5));
      this.items.push({ s: mist, life: 0.25 + i * 0.08, t: 0, grow: 0.9 + i * 0.4, vel: v });
    }
    // instant splash on the floor under the victim
    if (extreme) {
      for (let i = 0; i < 4; i++) {
        this.splat(pos.x + dir.x * (0.2 + Math.random() * 0.8 * strength), pos.z + (Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.35);
      }
    }
  }

  /** A single drip (for badly hurt fighters). */
  drip(pos) {
    if (!this.gore) return;
    this.drop(pos, new THREE.Vector3((Math.random() - 0.5) * 0.3, -0.2, (Math.random() - 0.5) * 0.3), 0.03 + Math.random() * 0.03);
  }

  /** Knocked-out teeth that bounce and stay on the floor. */
  teeth(pos, dir, count = 2) {
    if (this.gore < 2) return;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(toothGeo, toothMat);
      m.position.copy(pos);
      this.scene.add(m);
      const v = new THREE.Vector3(dir.x * (1.5 + Math.random() * 2), 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5);
      const spin = new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20);
      this.items.push({ s: m, life: 999, t: 0, vel: v, g: 9.8, keep: true, shared: true, tooth: true, spin, bounces: 0 });
      this.decals.push({ m, shared: true, tooth: true });
    }
  }

  splat(x, z, size) {
    const m = new THREE.Mesh(planeGeo, splatMats[Math.floor(Math.random() * splatMats.length)]);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(x, 0.014 + (this.decals.length % 200) * 0.00003, z);
    m.scale.set(size, size * (0.7 + Math.random() * 0.6), 1);
    this.scene.add(m);
    const d = { m, grow: 0, shared: true };
    this.decals.push(d);
    if (this.decals.length > 600) {
      const i = this.decals.findIndex((x) => !x.grow && !x.tooth);
      this.removeDecal(this.decals.splice(i >= 0 ? i : 0, 1)[0]);
    }
    return d;
  }

  /** A spreading pool (for a K.O.). */
  pool(x, z) {
    if (!this.gore) return;
    const extreme = this.gore === 2;
    const n = extreme ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const d = this.splat(x + (Math.random() - 0.5) * 0.4 * i, z + (Math.random() - 0.5) * 0.4 * i, 0.1);
      d.grow = extreme ? 1.4 : 0.9;
      d.max = extreme ? 2.4 - i * 0.5 : 1.1;
    }
  }

  removeDecal(d) {
    if (!d) return;
    this.scene.remove(d.m);
    if (!d.shared) { d.m.geometry.dispose(); d.m.material.dispose(); }
  }

  clearDecals() {
    for (const d of this.decals) this.removeDecal(d);
    this.decals = [];
    for (const it of this.items) if (it.tooth) it.t = it.life;
  }

  sprite(tex, color, size, additive = true) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    s.scale.setScalar(size);
    this.scene.add(s);
    return s;
  }

  /** Layered hit spark. color: tint of the star/streaks (e.g. gold for counters, cyan for supers). */
  spark(pos, strength = 1, color = 0xfff0a0) {
    const core = this.sprite(starTex, color, 0.35);
    core.position.copy(pos);
    core.material.rotation = Math.random() * Math.PI;
    this.items.push({ s: core, life: 0.2, t: 0, grow: 4.5 * (0.6 + strength * 0.6), vel: null });
    const flash = this.sprite(dotTex, 0xffffff, 0.5 + strength * 0.4);
    flash.position.copy(pos);
    this.items.push({ s: flash, life: 0.08, t: 0, grow: 6, vel: null });
    // radial streaks
    const ns = 6 + Math.round(strength * 5);
    for (let i = 0; i < ns; i++) {
      const st = this.sprite(streakTex, i % 2 ? color : 0xffffff, 1);
      const ang = Math.random() * Math.PI * 2;
      st.material.rotation = ang;
      st.scale.set(0.5 + strength * 0.45, 0.06, 1);
      st.position.copy(pos);
      const v = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).multiplyScalar(4 + strength * 3);
      this.items.push({ s: st, life: 0.14 + Math.random() * 0.08, t: 0, grow: 0, vel: v, g: 0 });
    }
    const n = 10 + Math.round(strength * 10);
    for (let i = 0; i < n; i++) {
      const p = this.sprite(dotTex, i % 2 ? 0xffc040 : 0xffffff, 0.05 + Math.random() * 0.04);
      p.position.copy(pos);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5)
        .normalize().multiplyScalar(2 + Math.random() * 4 * strength);
      this.items.push({ s: p, life: 0.35 + Math.random() * 0.25, t: 0, grow: 0, vel: v, g: 9 });
    }
    if (strength >= 1.2) {
      const ring = this.sprite(ringTex, 0x9ad8ff, 0.2);
      ring.position.copy(pos);
      this.items.push({ s: ring, life: 0.35, t: 0, grow: 10 * strength, vel: null });
    }
  }

  /** Expanding ring on the floor (landings, supers, KOs). */
  shockwave(x, z, strength = 1, color = 0xffffff) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      map: ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    m.scale.setScalar(0.3);
    this.scene.add(m);
    this.items.push({ s: m, life: 0.45, t: 0, grow: 9 * strength, vel: null, flatGrow: true });
  }

  /** Big fiery explosion (KO / super finisher). */
  explosion(pos, color = 0xff7a20) {
    for (let i = 0; i < 26; i++) {
      const p = this.sprite(dotTex, i % 3 === 0 ? 0xffffff : i % 3 === 1 ? color : 0xff2a10, 0.2 + Math.random() * 0.25);
      p.position.copy(pos);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(2 + Math.random() * 5);
      this.items.push({ s: p, life: 0.5 + Math.random() * 0.4, t: 0, grow: 1.5, vel: v, g: -1 });
    }
    const ring = this.sprite(ringTex, color, 0.3);
    ring.position.copy(pos);
    this.items.push({ s: ring, life: 0.5, t: 0, grow: 18, vel: null });
    const flash = this.sprite(starTex, 0xffffff, 0.8);
    flash.position.copy(pos);
    this.items.push({ s: flash, life: 0.18, t: 0, grow: 9, vel: null });
  }

  /** Afterimage trail: pass the fighter; ghost fades out. */
  ghost(fighter, color = 0x40c0ff) {
    const { group, mat } = fighter.ghost(color);
    this.scene.add(group);
    this.items.push({ s: group, mat, life: 0.28, t: 0, ghost: true });
  }

  /** Flame / energy particles rising around a powered-up fighter. */
  aura(pos, color, amount = 1) {
    const n = Math.max(1, Math.round(amount));
    for (let i = 0; i < n; i++) {
      const p = this.sprite(flameTex, i % 3 ? color : 0xffffff, 0.09 + Math.random() * 0.1);
      p.position.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y - 0.9 + Math.random() * 1.5, pos.z + (Math.random() - 0.5) * 0.5);
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.3, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.3);
      this.items.push({ s: p, life: 0.35 + Math.random() * 0.25, t: 0, grow: -0.2, vel: v, g: 0 });
    }
  }

  dust(pos) {
    for (let i = 0; i < 10; i++) {
      const p = this.sprite(dotTex, 0xc8a88a, 0.12, false);
      p.position.set(pos.x + (Math.random() - 0.5) * 0.8, 0.08, pos.z + (Math.random() - 0.5) * 0.5);
      const v = new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.8, (Math.random() - 0.5) * 0.6);
      this.items.push({ s: p, life: 0.6, t: 0, grow: 0.4, vel: v, g: 0.5 });
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const u = it.t / it.life;
      if (it.ghost) {
        if (u >= 1) { this.scene.remove(it.s); it.mat.dispose(); this.items.splice(i, 1); continue; }
        it.mat.opacity = 0.3 * (1 - u);
        continue;
      }
      if (u >= 1) {
        if (!it.tooth) this.scene.remove(it.s);
        if (!it.shared) it.s.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.vel) {
        it.vel.y -= (it.g || 0) * dt;
        it.s.position.addScaledVector(it.vel, dt);
        if (it.tooth) {
          it.s.rotation.x += it.spin.x * dt; it.s.rotation.y += it.spin.y * dt;
          if (it.s.position.y <= 0.02) {
            it.s.position.y = 0.02;
            if (it.bounces++ < 2) { it.vel.y = Math.abs(it.vel.y) * 0.35; it.vel.x *= 0.5; it.vel.z *= 0.5; it.spin.multiplyScalar(0.4); this.onSplat?.(); }
            else { it.vel.set(0, 0, 0); it.g = 0; it.spin.set(0, 0, 0); it.t = it.life; }
          }
        }
        if (it.onFloor && it.s.position.y <= 0.02) {
          it.onFloor(it);
          it.t = it.life; // remove next frame
        }
      }
      if (it.grow) {
        if (it.flatGrow) { it.s.scale.x += it.grow * dt; it.s.scale.y += it.grow * dt; } else it.s.scale.addScalar(it.grow * dt);
        if (it.s.scale.x < 0.01) it.s.scale.setScalar(0.01);
      }
      if (!it.keep) it.s.material.opacity = 1 - u;
    }
    for (const d of this.decals) {
      if (d.grow && d.m.scale.x < d.max) {
        d.m.scale.x += d.grow * dt * (1 - d.m.scale.x / d.max);
        d.m.scale.y = d.m.scale.x * 0.8;
      }
    }
  }
}
