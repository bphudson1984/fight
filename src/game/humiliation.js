// HUMILIATION finishers – triggered when the player wins a fight 2-0.
// Each one is a scripted sequence of props, camera shots and sounds. Props and
// fighter transforms are snapshotted every frame so the replay can show it all.
import * as THREE from 'three';
import { G } from './context.js';
import { hitstop } from './time.js';
import { sfx, say } from '../audio/sfx.js';
import { hud, screenSplatter } from '../ui/hud.js';
import { canvasTexture } from '../ps1.js';
import { Q, boxGeo, coneGeo, cylGeo, icoGeo, fighterMat, wetMat } from '../quality.js';
import { SLOT } from '../maths.js';

export const HUMILIATIONS = {
  foot: 'SQUASHED!',
  comet: 'EXTINCT!',
  divzero: 'DIVIDE BY ZERO!',
  crunch: 'NUMBER CRUNCHED!',
  tetris: 'LINE CLEAR!',
  shark: 'CHOMPED!',
  ufo: 'ABDUCTED!',
  ruler: 'DETENTION!',
  sharpen: 'SHARPENED!',
  bonk: 'HUD BONK!',
};

/** Testing hook: set HUM_DEBUG.force to a finisher id to always trigger it. */
export const HUM_DEBUG = { force: null };

let bag = [];
export function pickHumiliation() {
  if (HUM_DEBUG.force) return HUM_DEBUG.force;
  if (!bag.length) bag = Object.keys(HUMILIATIONS).sort(() => Math.random() - 0.5);
  return bag.pop();
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = {
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inOut: (u) => u * u * (3 - 2 * u),
  back: (u) => 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2),
};
const rnd = (a = 1) => (Math.random() - 0.5) * 2 * a;

const softTex = canvasTexture(32, 32, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
});
const starTex = canvasTexture(16, 16, (g) => {
  g.fillStyle = '#fff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3 : 8;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(8 + Math.cos(a) * r, 8 + Math.sin(a) * r);
  }
  g.fill();
});

function textTex(w, h, draw) {
  const t = canvasTexture(w, h, draw);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  return t;
}

// Seven-segment calculator digits (a b c d e f g)
const SEGS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };

export class HumiliationDirector {
  constructor(fight) {
    this.fight = fight;
    this.props = [];
    this.disposables = [];
    this.tasks = [];
    this.tweens = [];
    this.clock = 0;
    this.active = false;
    this.overlays = new Set();
  }

  get death() { return this.fight.death; }

  // ------------------------------------------------------------ timeline
  at(t, fn) { this.tasks.push({ at: t, fn }); }
  tween(t0, dur, fn) { this.tweens.push({ t0, dur, fn, done: false }); }

  update(dt) {
    if (!this.active || dt <= 0) return;
    this.clock += dt;
    for (let i = 0; i < this.tasks.length; i++) {
      const t = this.tasks[i];
      if (this.clock >= t.at) { this.tasks.splice(i--, 1); t.fn(); }
    }
    for (const w of this.tweens) {
      if (w.done || this.clock < w.t0) continue;
      const age = this.clock - w.t0;
      const u = Math.min(1, age / w.dur);
      w.fn(u, dt, age);
      if (u >= 1) w.done = true;
    }
  }

  // ------------------------------------------------------------ props
  track(m) { this.disposables.push(m); return m; }
  glossy(c, o = {}) { return this.track(fighterMat(c, o)); }
  glow(c, extra = {}) { return this.track(new THREE.MeshBasicMaterial({ color: c, ...extra })); }
  add(obj) {
    G.scene.add(obj);
    this.props.push(obj);
    if (Q.hd) obj.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });
    return obj;
  }
  /** Move a child object to the scene root, keeping it tracked. */
  adopt(obj) {
    G.scene.attach(obj);
    this.props.push(obj);
    return obj;
  }
  mesh(geo, mat, parent = null) {
    const m = new THREE.Mesh(geo, mat);
    this.disposables.push(geo);
    if (parent) parent.add(m); else this.add(m);
    return m;
  }
  sprite(tex, color, sx, sy = sx, extra = {}) {
    const s = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, ...extra })));
    s.scale.set(sx, sy, 1);
    return this.add(s);
  }
  gib(obj, vel, spin = V(rnd(10), rnd(10), rnd(10))) {
    this.death.gibs.push({ obj, vel, spin, rest: false, bounces: 0 });
  }
  /** Water / debris droplets (visual only, not replayed). */
  spray(pos, n, color, speed = 4) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color, transparent: true, depthWrite: false }));
      s.scale.setScalar(0.08 + Math.random() * 0.1);
      s.position.copy(pos);
      G.scene.add(s);
      G.fx.items.push({ s, life: 0.7 + Math.random() * 0.4, t: 0, grow: 0, vel: V(rnd(1), 0.6 + Math.random(), rnd(1)).normalize().multiplyScalar(speed * (0.5 + Math.random())), g: 9 });
    }
  }

  clear() {
    for (const o of this.props) {
      o.parent?.remove(o);
      o.traverse((c) => { if (c.geometry && !this.disposables.includes(c.geometry)) c.geometry.dispose?.(); });
    }
    for (const d of this.disposables) d.dispose?.();
    this.props = [];
    this.disposables = [];
    this.tasks = [];
    this.tweens = [];
    this.active = false;
    for (const name of [...this.overlays]) this.setOverlay(name, false);
    this.death.gibs = this.death.gibs.filter((g) => g.f);
  }

  // ------------------------------------------------------------ recorded helpers
  sound(name, ...args) { this.death.sound(name, ...args); }
  bleed(pos, dir, s) { if (G.settings.gore) this.death.bleed(pos, dir, s); }
  pool(x, z) { if (G.settings.gore) this.death.pool(x, z); }
  overlay(name, on) {
    this.setOverlay(name, on);
    this.death.record({ type: 'hum', kind: 'overlay', name, on });
  }
  setOverlay(name, on) {
    if (on) this.overlays.add(name); else this.overlays.delete(name);
    if (name === 'matherror') document.querySelector('#hum-err')?.classList.toggle('hidden', !on);
    if (name === 'hudbar') document.querySelector('#hud .side.p1 .bar')?.classList.toggle('bonked', on);
  }
  replayEvent(e) { if (e.kind === 'overlay') this.setOverlay(e.name, e.on); }
  shot(pos, look, follow = 6, cut = false) { G.cam.shot(pos, look, follow, cut); }

  impact(x, z, strength = 1) {
    G.fx.shockwave(x, z, 2 * strength, 0xffffff);
    G.fx.dust(V(x, 0, z));
    G.fx.dust(V(x + 0.5, 0, z));
    G.fx.dust(V(x - 0.5, 0, z));
    G.cam.shake(0.6 * strength);
    G.post.pulse({ flash: 0.35, aberr: 0.8 * strength, invert: strength > 1.5 ? 2 : 0 });
    G.stage?.flash(0.6);
    this.sound('impact', Math.min(2, strength));
  }

  // ------------------------------------------------------------ replay support
  snapshot() {
    if (!this.props.length) return null;
    const out = [];
    for (const p of this.props) {
      p.traverse((o) => {
        if (o === p || o.userData.rec) out.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]);
      });
    }
    return out;
  }

  applySnapshot(snap) {
    for (const p of this.props) p.visible = false;
    if (!snap) return;
    for (const [o, pos, quat, scale, vis] of snap) {
      o.position.copy(pos);
      o.quaternion.copy(quat);
      o.scale.copy(scale);
      o.visible = vis;
    }
  }

  // ------------------------------------------------------------ entry
  /** Start a humiliation. Returns its total duration (game seconds). */
  start(variant, att, def) {
    this.clear();
    this.active = true;
    this.clock = 0;
    this.att = att;
    this.def = def;
    this.vx = def.root.position.x;
    this.back = -def.facing;
    def.play('dizzy');
    this.at(0.35, () => att.play('victory2'));
    // winner steps back to give the show some room
    this.tween(0.35, 0.6, (u) => { att.xform.dx = -this.back * 1.7 * ease.out(u); });
    this.dizzyStars(0.2, 2.0);
    this.at(0.25, () => this.shot(V(this.vx - this.back * 1.3, 1.55, 3.0), V(this.vx, 1.5, 0), 3));
    this.at(0.9, () => {
      hud.banner('HUMILIATION!', 'pink', 1300);
      say('Humiliation!', { rate: 0.9, pitch: 0.5 });
      this.sound('humSting');
      this.sound('crowdLaugh');
      G.post.pulse({ flash: 0.3, flashColor: 0xff2ea6 });
    });
    const S = 2.1;
    this.at(S + 0.1, () => {
      hud.sub(HUMILIATIONS[variant], 'pink');
      say(HUMILIATIONS[variant].replace(/!/g, '').toLowerCase(), { rate: 1.05, pitch: 0.5 });
    });
    const end = this[variant](S);
    this.replayFrom = S - 0.2;
    this.at(end, () => { G.post.setDim(0); });
    return end + 0.5;
  }

  dizzyStars(t0, dur) {
    const stars = [];
    for (let i = 0; i < 5; i++) stars.push(this.sprite(starTex, 0xffe040, 0.16));
    const head = new THREE.Vector3();
    this.tween(t0, dur, (u, dt, age) => {
      this.def.head.getWorldPosition(head);
      stars.forEach((s, i) => {
        const a = age * 5 + (i / 5) * Math.PI * 2;
        s.position.set(head.x + Math.cos(a) * 0.28, head.y + 0.2 + Math.sin(age * 7 + i) * 0.03, head.z + Math.sin(a) * 0.28);
        s.visible = u < 1;
      });
    });
  }

  // ================================================================ 1. giant foot
  foot(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const skin = this.glossy(0xe6b48e, { skin: true });
    const nail = this.glossy(0xfff0f0);
    const g = new THREE.Group();
    this.mesh(cylGeo(0.95, 1.1, 30, 12), skin, g).position.y = 16.2;
    this.mesh(boxGeo(2.2, 1.2, 3.6), skin, g).position.set(0, 0.6, 0.4);
    const heel = this.mesh(icoGeo(1.05, 1), skin, g);
    heel.position.set(0, 0.95, -0.9);
    [[-0.78, 0.28], [-0.38, 0.32], [0.02, 0.36], [0.42, 0.3], [0.78, 0.26]].forEach(([x, r]) => {
      const toe = this.mesh(icoGeo(r, 1), skin, g);
      toe.position.set(x, r * 0.9, 2.3 - Math.abs(x) * 0.35);
      toe.scale.set(1, 0.9, 1.25);
      this.mesh(boxGeo(r * 1.1, 0.07, r * 0.9), nail, g).position.set(x, r * 1.75, 2.45 - Math.abs(x) * 0.35);
    });
    g.position.set(vx, 30, 0);
    g.rotation.y = 0.15;
    this.add(g);
    const shadow = this.mesh(new THREE.CircleGeometry(1.8, 32), this.glow(0x000000, { transparent: true, opacity: 0.55, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(vx, 0.025, 0.3);
    shadow.scale.setScalar(0.05);

    this.at(s, () => {
      def.play('lookup');
      this.sound('rumble', 1.5);
      G.post.setDim(0.25);
      this.shot(V(vx - this.back * 3.2, 0.7, 6.2), () => V(vx, Math.min(g.position.y * 0.3 + 1.2, 3.4), 0), 5);
    });
    this.tween(s, 1.35, (u) => { g.position.y = 30 - 21 * ease.inOut(u); shadow.scale.setScalar(0.05 + 0.6 * u); G.cam.shake(0.04 + u * 0.1); });
    this.tween(s + 1.35, 0.14, (u) => { g.position.y = 9 * (1 - u * u); shadow.scale.setScalar(0.65 + 0.35 * u); });
    this.at(s + 1.49, () => {
      G.post.setDim(0);
      X.sy = 0.035; X.sx = 2.6; X.sz = 2.4;
      this.sound('stomp');
      this.impact(vx, 0.3, 2.2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.bleed(V(vx, 0.2, 0.3), V(Math.cos(a), 0.1, Math.sin(a)), gore === 2 ? 2.6 : 1);
      }
      this.pool(vx + 0.6, 0.4); this.pool(vx - 0.6, -0.3); this.pool(vx, 0.9);
      if (gore === 2) screenSplatter(6);
      this.shot(V(vx - this.back * 3.4, 1.6, 5.4), V(vx, 1.8, 0), 8, true);
    });
    this.at(s + 2.7, () => {
      this.sound('rumble', 1.2);
      this.shot(V(vx - this.back * 0.6, 4.6, 3.2), V(vx, 0, 0.2), 4);
    });
    this.tween(s + 2.7, 1.3, (u) => {
      g.position.y = 26 * ease.in(u);
      shadow.scale.setScalar(1 - u);
      shadow.material.opacity = 0.55 * (1 - u);
    });
    if (gore < 2) {
      this.at(s + 4.0, () => {
        this.sound('whooshBig');
        this.shot(V(vx - this.back * 1.6, 1.5, 4.6), () => V(def.root.position.x, def.root.position.y + 0.8, 0), 6);
      });
      this.tween(s + 4.0, 1.6, (u, dt, age) => {
        X.rx = -Math.PI / 2 * Math.min(1, u * 3);
        X.dy = 0.05 + u * u * 4;
        X.dx = Math.sin(age * 5) * 0.5 * u;
        X.rz = Math.sin(age * 5) * 0.4;
      });
      return s + 5.6;
    }
    return s + 4.2;
  }

  // ================================================================ 2. comet
  comet(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const g = new THREE.Group();
    this.mesh(icoGeo(0.7, 1), this.glow(0xfff4d0), g);
    this.mesh(icoGeo(1.3, 1), this.glow(0xff8a20, { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), g);
    const tailGeo = coneGeo(1.3, 10, 16);
    tailGeo.rotateX(Math.PI / 2);
    tailGeo.translate(0, 0, 5);
    this.mesh(tailGeo, this.glow(0xff5a10, { transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), g);
    const start = V(vx + this.back * 45, 48, -75);
    const end = V(vx, 1.0, 0);
    g.position.copy(start);
    this.add(g);

    this.at(s, () => {
      def.play('lookup');
      this.sound('whistleFall', 1.7);
      G.post.setDim(0.4);
      this.shot(V(vx - this.back * 3.5, 0.8, 6.6), () => new THREE.Vector3().lerpVectors(V(vx, 1.6, 0), g.position, 0.3), 5);
    });
    this.tween(s, 1.7, (u) => {
      g.position.lerpVectors(start, end, Math.pow(u, 2.2));
      g.lookAt(start);
      G.fx.aura(g.position, 0xff8a20, 2);
      G.cam.shake(u * 0.12);
    });
    this.at(s + 1.7, () => {
      g.visible = false;
      G.post.setDim(0);
      G.post.pulse({ flash: 1, invert: 4, aberr: 1.5, zoom: 0.9 });
      G.stage?.flash(1);
      G.cam.shake(1.8);
      this.sound('stomp');
      this.sound('gibExplode');
      G.fx.explosion(V(vx, 0.8, 0), 0xff8a20);
      [0, 0.08, 0.16].forEach((d, i) => this.at(s + 1.7 + d, () => G.fx.shockwave(vx, 0, 3 + i * 1.5, i ? 0xff8a20 : 0xffffff)));
      const crater = this.mesh(new THREE.CircleGeometry(2.6, 40), this.glow(0x1a0e08, { transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
      crater.rotation.x = -Math.PI / 2;
      crater.position.set(vx, 0.018, 0);
      this.shot(V(vx - this.back * 4.5, 2.4, 8.4), V(vx, 1.8, 0), 6, true);
      if (gore === 2) {
        for (const p of ['head', 'shL', 'shR', 'hipL', 'hipR', 'spine', 'pelvis']) {
          this.death.throwPart(def, p, V(rnd(3), 9 + Math.random() * 6, rnd(2.5)), V(rnd(15), rnd(15), rnd(15)));
        }
        for (let i = 0; i < 5; i++) this.bleed(V(vx, 1, 0), V(Math.cos(i * 1.3), 1, Math.sin(i * 1.3)), 3);
        screenSplatter(8);
        this.at(s + 3.6, () => { this.pool(vx + 1, 0.4); this.pool(vx - 1.2, -0.3); this.pool(vx, 0.2); });
      } else {
        X.tint = 0x141010;
        X.tintAmt = 0.95;
        if (gore) this.bleed(V(vx, 1, 0), V(0, 1, 0), 0.8);
      }
    });
    // mushroom cloud
    const smoke = [];
    for (let i = 0; i < 18; i++) {
      const sp = this.sprite(softTex, 0x6a5a58, 0.5, 0.5, { opacity: 0.9 });
      sp.visible = false;
      smoke.push(sp);
    }
    this.tween(s + 1.7, 2.8, (u) => {
      smoke.forEach((sp, i) => {
        const k = i / smoke.length;
        const top = k > 0.55;
        const a = i * 2.4;
        const r = top ? 0.4 + u * 3 * (k - 0.4) : 0.3 + 0.25 * u;
        sp.visible = u < 1;
        sp.position.set(vx + Math.cos(a) * r, 0.5 + u * 6.5 * (top ? 1 : k * 1.6), Math.sin(a) * r * 0.6);
        sp.scale.setScalar(0.8 + u * (top ? 3.2 : 1.6));
        sp.material.opacity = 0.85 * (1 - u * u);
      });
    });
    if (gore === 2) return s + 4.4;
    this.at(s + 3.3, () => this.sound('rumble', 0.9));
    this.tween(s + 3.3, 1.1, (u) => {
      X.sy = 1 - 0.93 * u;
      X.sx = X.sz = 1 + 0.6 * u;
      if (Math.random() < 0.35) G.fx.dust(def.root.position);
    });
    this.at(s + 4.4, () => {
      X.vis = false;
      this.mesh(coneGeo(0.6, 0.4, 16), this.glossy(0x3a3432), null).position.set(vx, 0.2, 0);
    });
    return s + 5.0;
  }

  // ================================================================ 3. divide by zero
  divzero(s) {
    const { def, vx } = this;
    const X = def.xform;
    const signTex = this.track(textTex(128, 64, (g, w, h) => {
      g.font = 'bold 54px Impact, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = '#ff0030';
      g.shadowBlur = 12;
      g.fillStyle = '#ff2a40';
      g.fillText('÷ 0', w / 2, h / 2 + 2);
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.fillText('÷ 0', w / 2, h / 2 + 2);
    }));
    const signStart = V(vx, 3.3, 0);
    const sign = this.sprite(signTex, 0xffffff, 0.01, 0.01);
    sign.position.copy(signStart);
    const holePos = V(vx, 1.2, 0.1);
    const hole = new THREE.Group();
    this.mesh(icoGeo(0.45, 2), this.glow(0x000000), hole);
    const ring1 = this.mesh(new THREE.TorusGeometry(0.85, 0.09, 10, 48), this.glow(0xb040ff, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), hole);
    const ring2 = this.mesh(new THREE.TorusGeometry(1.15, 0.04, 8, 48), this.glow(0xffffff, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), hole);
    ring1.rotation.x = ring2.rotation.x = 1.25;
    ring1.userData.rec = ring2.userData.rec = true;
    hole.position.copy(holePos);
    hole.scale.setScalar(0.001);
    this.add(hole);

    this.at(s, () => {
      this.sound('slam');
      this.sound('glitch', 1.9);
      this.overlay('matherror', true);
      this.shot(V(vx - this.back * 1.6, 1.6, 3.6), V(vx, 1.8, 0), 5);
    });
    this.tween(s, 0.35, (u) => { const k = ease.back(u); sign.scale.set(2.6 * k, 1.3 * k, 1); });
    this.tween(s + 0.3, 1.7, (u) => {
      X.dx = rnd(0.12 * u);
      X.dy = rnd(0.04);
      X.sx = 1 + rnd(0.25 * u);
      X.sy = 1 + rnd(0.18 * u);
      X.rz = rnd(0.18 * u);
      if (Math.random() < 0.35) { X.tint = [0xff00ff, 0x00ffff, 0xffffff, 0x00ff00][Math.floor(Math.random() * 4)]; X.tintAmt = 0.85; } else X.tintAmt = 0;
      if (Math.random() < 0.25) G.post.pulse({ aberr: 0.5 });
      G.cam.shake(0.04);
    });
    this.at(s + 2.0, () => {
      this.overlay('matherror', false);
      Object.assign(X, { dx: 0, dy: 0, sx: 1, sy: 1, rz: 0, tintAmt: 0 });
      this.sound('blackHole', 2.0);
      G.post.setDim(0.35);
      this.shot(V(vx, 1.3, 3.8), V(vx, 1.3, 0), 5);
    });
    this.tween(s + 2.0, 0.4, (u) => hole.scale.setScalar(Math.max(0.001, ease.out(u))));
    this.tween(s + 2.0, 0.7, (u) => {
      sign.position.lerpVectors(signStart, holePos, u);
      sign.scale.set(2.6 * (1 - u) + 0.001, 1.3 * (1 - u) + 0.001, 1);
    });
    this.tween(s + 2.0, 1.9, (u, dt) => { ring1.rotation.z += dt * 6; ring2.rotation.z -= dt * 9; });
    this.tween(s + 2.3, 1.4, (u, dt) => {
      let sy;
      let sxz;
      if (u < 0.6) { const k = u / 0.6; sy = 1 + 2.8 * k; sxz = 1 - 0.8 * k; } else { const k = (u - 0.6) / 0.4; sy = 3.8 * (1 - k); sxz = 0.2 * (1 - k); }
      X.sy = Math.max(0.001, sy);
      X.sx = X.sz = Math.max(0.001, sxz);
      X.dy = 1.2 - 1.2 * X.sy;
      X.ry += dt * (4 + u * 30);
      if (G.settings.gore) {
        for (let i = 0; i < 3; i++) {
          const a = Math.random() * Math.PI * 2;
          const p = holePos.clone().add(V(Math.cos(a) * 1.4, Math.sin(a) * 0.8, Math.sin(a) * 1.0));
          const v = holePos.clone().sub(p).normalize().multiplyScalar(3).add(V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(2));
          G.fx.drop(p, v, 0.05);
        }
      } else G.fx.aura(holePos, 0xb040ff, 2);
      G.post.pulse({ aberr: 0.15 });
      G.cam.shake(0.05);
    });
    this.at(s + 3.7, () => {
      X.vis = false;
      this.sound('pop');
      G.post.setDim(0);
      G.post.pulse({ invert: 2, flash: 0.6, flashColor: 0xb040ff });
      G.fx.explosion(holePos, 0xb040ff);
      G.cam.shake(0.6);
    });
    this.tween(s + 3.7, 0.25, (u) => hole.scale.setScalar(Math.max(0.001, 1 - u)));
    return s + 4.4;
  }

  // ================================================================ 4. number crunched
  makeNumber(str, size, mat) {
    const g = new THREE.Group();
    const H = size;
    const W = size * 0.56;
    const t = size * 0.17;
    const d = size * 0.35;
    const hSeg = boxGeo(W, t, d);
    const vSeg = boxGeo(t, H / 2, d);
    this.disposables.push(hSeg, vSeg);
    const pos = { a: [0, H / 2, 1], g: [0, 0, 1], d: [0, -H / 2, 1], b: [W / 2, H / 4, 0], c: [W / 2, -H / 4, 0], f: [-W / 2, H / 4, 0], e: [-W / 2, -H / 4, 0] };
    const chars = [...str];
    const step = W + size * 0.4;
    chars.forEach((ch, i) => {
      const cx = (i - (chars.length - 1) / 2) * step;
      const put = (geo, x, y, rz = 0) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(cx + x, y + H / 2 + t / 2, 0);
        m.rotation.z = rz;
        g.add(m);
      };
      if (SEGS[ch]) {
        for (const k of SEGS[ch]) { const [x, y, horiz] = pos[k]; put(horiz ? hSeg : vSeg, x, y); }
      } else if (ch === '×' || ch === 'x') {
        const bar = boxGeo(W * 1.3, t, d);
        this.disposables.push(bar);
        put(bar, 0, 0, Math.PI / 4);
        put(bar, 0, 0, -Math.PI / 4);
      } else if (ch === '=') {
        put(hSeg, 0, H * 0.14);
        put(hSeg, 0, -H * 0.14);
      } else if (ch === '÷') {
        put(hSeg, 0, 0);
        const dot = boxGeo(t * 1.2, t * 1.2, d);
        this.disposables.push(dot);
        put(dot, 0, H * 0.28);
        put(dot, 0, -H * 0.28);
      }
    });
    return g;
  }

  crunch(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const q = this.fight.lastQ ?? { parts: [9, '×', 9, '=', SLOT], answer: 81 };
    const tokens = q.parts.map((p) => (p === SLOT ? String(q.answer) : String(p)));
    const gold = this.glossy(0xffc830, { metal: true });
    const cyan = this.glossy(0x2ef2ff);
    const pink = this.glossy(0xff2e8a);
    const squash = [0.78, 0.6, 0.45, 0.34];
    const notes = [72, 76, 79, 83];
    const n = tokens.length;
    this.at(s, () => this.shot(V(vx, 1.9, 6.6), V(vx, 1.6, 0), 5));
    tokens.forEach((tok, i) => {
      const last = i === n - 1;
      const isOp = /[×÷=x]/.test(tok);
      const size = last ? 1.7 : isOp ? 0.8 : 1.0;
      const num = this.makeNumber(tok, size, last ? pink : isOp ? cyan : gold);
      num.position.set(vx, 12, 0);
      num.visible = false;
      this.add(num);
      const t0 = s + 0.2 + i * 0.62 + (last ? 0.35 : 0);
      const fall = last ? 0.7 : 0.45;
      let landY = 0;
      this.at(t0, () => {
        num.visible = true;
        if (last) this.sound('whistleFall', fall);
      });
      this.tween(t0, fall, (u) => {
        landY = 1.97 * X.sy;
        num.position.y = 12 - (12 - landY) * ease.in(u);
        num.rotation.z = (1 - u) * (i % 2 ? 0.6 : -0.6);
      });
      this.at(t0 + fall, () => {
        this.sound('note', notes[i % notes.length] - (last ? 12 : 0), last ? 0.5 : 0.3);
        if (last) {
          this.sound('stomp');
          this.sound('note', 67, 0.4);
          this.sound('note', 72, 0.4);
          this.impact(vx, 0, 2);
          X.sy = 0.03; X.sx = 1.8; X.sz = 1.6;
          for (let k = 0; k < 6; k++) this.bleed(V(vx, 0.2, 0), V(Math.cos(k * 1.05), 0.15, Math.sin(k * 1.05)), gore === 2 ? 2.4 : 0.8);
          this.pool(vx, 0.2);
          if (gore === 2) screenSplatter(5);
          this.shot(V(vx - this.back * 3, 0.55, 4.2), V(vx, 1.1, 0), 7, true);
        } else {
          this.sound('impact', 0.9);
          G.cam.shake(0.35);
          this.bleed(V(vx, 1.97 * X.sy, 0), V(this.back, 0.6, 0), gore === 2 ? 1.2 : 0.5);
          sfx.grunt(def.def.voice);
        }
      });
      if (!last) {
        const from = squash[i - 1] ?? 1;
        const to = squash[Math.min(i, squash.length - 1)];
        this.tween(t0 + fall, 0.12, (u) => {
          X.sy = from + (to - from) * ease.out(u);
          X.sx = X.sz = 1 + (1 - X.sy) * 0.5;
          num.position.y = 1.97 * X.sy;
        });
        const side = vx + (i % 2 ? 1 : -1) * (1.5 + 0.55 * Math.floor(i / 2));
        this.tween(t0 + fall + 0.12, 0.45, (u) => {
          const y0 = 1.97 * X.sy;
          num.position.x = vx + (side - vx) * u;
          num.position.y = y0 * (1 - u) + Math.sin(u * Math.PI) * 1.1;
          num.rotation.z = u * (i % 2 ? -1.2 : 1.2) * (1 - u) * 2;
        });
      } else {
        this.tween(t0 + fall + 0.1, 1.6, (u, dt, age) => {
          const k = 0.35 + 0.35 * Math.sin(age * 10);
          pink.emissive.setRGB(k, k * 0.15, k * 0.5);
        });
      }
    });
    return s + 0.2 + (n - 1) * 0.62 + 0.35 + 0.7 + 1.7;
  }

  // ================================================================ 5. line clear
  tetris(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const cell = 0.62;
    const cx = (c) => (c - 5) * cell;
    const cy = (r) => r * cell + cell / 2;
    const P = [
      { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], col: 0x00e8f0 },
      { cells: [[7, 0], [8, 0], [9, 0], [10, 0]], col: 0x00e8f0 },
      { cells: [[4, 0], [4, 1], [3, 1], [2, 1]], col: 0x2050ff },
      { cells: [[6, 0], [6, 1], [7, 1], [8, 1]], col: 0xff8a00 },
      { cells: [[0, 1], [1, 1], [0, 2], [1, 2]], col: 0xf0e000 },
      { cells: [[9, 1], [10, 1], [9, 2], [10, 2]], col: 0xf0e000 },
      { cells: [[2, 2], [3, 2], [4, 2]], col: 0xb040ff },
      { cells: [[6, 2], [7, 2], [8, 2]], col: 0x40e040 },
    ];
    const blockGeo = boxGeo(cell * 0.94, cell * 0.94, cell * 0.94);
    this.disposables.push(blockGeo);
    const mats = {};
    const blocks = [];
    const groups = P.map((p, i) => {
      mats[p.col] ??= this.glossy(p.col);
      const g = new THREE.Group();
      for (const [c, r] of p.cells) {
        const b = new THREE.Mesh(blockGeo, mats[p.col]);
        b.position.set(cx(c), cy(r), 0);
        g.add(b);
        blocks.push(b);
      }
      g.position.set(vx, 9, 0);
      g.visible = false;
      this.add(g);
      const t0 = s + 0.25 + i * 0.42;
      this.at(t0, () => { g.visible = true; });
      this.tween(t0, 0.7, (u) => { g.position.y = 9 * (1 - Math.floor(u * 16) / 16); });
      this.at(t0 + 0.7, () => { g.position.y = 0; this.sound('lock'); G.cam.shake(0.12); });
      return g;
    });
    this.at(s, () => {
      this.sound('korobeiniki');
      this.shot(V(vx, 1.5, 7.4), V(vx, 1.3, 0), 5);
    });
    const lastLand = s + 0.25 + (P.length - 1) * 0.42 + 0.7;
    this.at(lastLand + 0.05, () => this.sound('lineClear'));
    this.tween(lastLand + 0.05, 0.6, (u) => {
      const on = Math.floor(u * 6) % 2 === 0 && u < 1;
      for (const m of Object.values(mats)) m.emissive.setScalar(on ? 0.9 : 0);
      X.tint = 0xffffff;
      X.tintAmt = on ? 0.9 : 0;
    });
    const clear = lastLand + 0.7;
    this.at(clear, () => {
      X.tintAmt = 0;
      X.vis = false;
      G.post.pulse({ flash: 0.5 });
      if (gore === 2) {
        this.sound('gibExplode');
        for (const b of blocks) {
          this.adopt(b);
          this.gib(b, V((b.position.x - vx) * 2 + rnd(1.5), 4 + Math.random() * 4, rnd(2.5)));
        }
        const meat = this.glossy(0x8a0008);
        const meatGeo = boxGeo(0.2, 0.2, 0.2);
        this.disposables.push(meatGeo);
        for (let i = 0; i < 26; i++) {
          const m = this.mesh(meatGeo, i % 2 ? meat : this.track(wetMat(0xb0100e)));
          m.position.set(vx + rnd(0.3), 0.3 + Math.random() * 1.5, rnd(0.2));
          this.gib(m, V(rnd(4), 3 + Math.random() * 5, rnd(3)));
        }
        for (let i = 0; i < 4; i++) this.bleed(V(vx, 1, 0), V(Math.cos(i * 1.6), 0.8, Math.sin(i * 1.6)), 2.5);
        screenSplatter(6);
        this.at(clear + 1.1, () => this.pool(vx, 0));
      } else {
        this.sound('pop');
        for (const g of groups) g.visible = false;
        for (let c = 0; c <= 10; c++) G.fx.spark(V(vx + cx(c), cy(1), 0.1), 0.6, Object.keys(mats)[c % 4] * 1);
      }
    });
    return clear + 1.3;
  }

  // ================================================================ 6. shark
  shark(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const waterBlue = new THREE.Color(0x1e6aa8);
    const waterMat = this.glossy(0x1e6aa8, { extra: { transparent: true, opacity: 0.9 } });
    const water = this.mesh(new THREE.CircleGeometry(2.6, 48), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(vx, 0.03, 0);
    water.scale.setScalar(0.001);
    const foam = this.mesh(new THREE.TorusGeometry(2.6, 0.07, 6, 64), this.glossy(0xf4faff));
    foam.rotation.x = Math.PI / 2;
    foam.position.set(vx, 0.04, 0);
    foam.scale.setScalar(0.001);
    const ripples = [0, 1, 2].map(() => {
      const r = this.mesh(new THREE.TorusGeometry(1, 0.025, 4, 48), this.glow(0xdff4ff, { transparent: true, opacity: 0.6 }));
      r.rotation.x = Math.PI / 2;
      r.position.set(vx, 0.05, 0);
      r.visible = false;
      return r;
    });
    const grey = this.glossy(0x6f7f90);
    const white = this.glossy(0xeef0f2);
    const fin = this.mesh(coneGeo(0.35, 0.8, 3), grey);
    fin.scale.set(1, 1, 0.3);
    fin.visible = false;

    const shark = new THREE.Group();
    this.mesh(icoGeo(1, 2), grey, shark).scale.set(0.95, 2.4, 0.95);
    const belly = this.mesh(icoGeo(1, 2), white, shark);
    belly.scale.set(0.8, 2.1, 0.7);
    belly.position.z = 0.3;
    const jaws = [-1, 1].map((sx) => {
      const j = new THREE.Group();
      j.position.set(0, 1.95, 0);
      const wedge = this.mesh(boxGeo(0.9, 1.15, 0.95), grey, j);
      wedge.position.set(sx * 0.45, 0.55, 0);
      for (let k = 0; k < 5; k++) {
        const tooth = this.mesh(coneGeo(0.08, 0.26, 4), white, j);
        tooth.position.set(sx * 0.02, 0.2 + k * 0.2, 0.2);
        tooth.rotation.z = sx * Math.PI / 2;
      }
      j.userData.rec = true;
      shark.add(j);
      return j;
    });
    for (const sx of [-1, 1]) {
      this.mesh(icoGeo(0.12, 1), this.glow(0x050505), shark).position.set(sx * 0.66, 1.55, 0.35);
      const pf = this.mesh(coneGeo(0.35, 1.0, 3), grey, shark);
      pf.scale.set(1, 1, 0.25);
      pf.position.set(sx * 1.0, 0.1, 0);
      pf.rotation.z = sx * 2.0;
      const tf = this.mesh(coneGeo(0.35, 1.2, 3), grey, shark);
      tf.scale.set(1, 1, 0.25);
      tf.position.set(sx * 0.45, -2.6, 0);
      tf.rotation.z = Math.PI + sx * 0.6;
    }
    shark.position.set(vx, -5.5, 0);
    this.add(shark);

    this.at(s, () => {
      this.sound('splash', 0.7);
      def.play('panic');
      this.shot(V(vx - this.back * 0.5, 3.6, 4.4), V(vx, 0, 0), 5);
    });
    this.tween(s, 0.5, (u) => {
      const k = Math.max(0.001, ease.out(u));
      water.scale.setScalar(k);
      foam.scale.setScalar(k);
      X.dy = -0.45 * u;
    });
    this.tween(s + 0.5, 2.3, (u, dt, age) => {
      X.dy = -0.45 + Math.sin(age * 3) * 0.06;
      ripples.forEach((r, i) => {
        const k = ((age + i * 0.4) % 1.2) / 1.2;
        r.visible = u < 1;
        r.scale.setScalar(0.3 + k * 2.2);
        r.material.opacity = 0.6 * (1 - k);
      });
    });
    this.at(s + 0.5, () => { fin.visible = true; this.sound('sharkTheme', 2.1); });
    this.tween(s + 0.5, 2.1, (u, dt, age) => {
      const a = age * 6.2;
      const r = 1.9 - 0.8 * u;
      fin.position.set(vx + Math.cos(a) * r, 0.3 + 0.05 * Math.sin(age * 9), Math.sin(a) * r);
      fin.rotation.y = -a;
    });
    this.at(s + 2.6, () => {
      fin.visible = false;
      this.sound('splash', 1.3);
      G.cam.shake(0.6);
      this.spray(V(vx, 0.2, 0), 40, 0xcfefff, 5);
      this.shot(V(vx - this.back * 4.4, 1.3, 7.6), V(vx, 2.3, 0), 10, true);
    });
    this.tween(s + 2.6, 0.32, (u) => {
      shark.position.y = -5.5 + 5.8 * ease.out(u);
      jaws[0].rotation.z = 0.85 * u;
      jaws[1].rotation.z = -0.85 * u;
      X.dy = -0.45 + 1.4 * u;
    });
    this.at(s + 2.95, () => {
      this.sound('chomp');
      X.vis = false;
      G.cam.shake(0.9);
      G.post.pulse({ flash: 0.3, aberr: 0.8 });
      if (gore) {
        for (let i = 0; i < 4; i++) this.bleed(V(vx, 1.6, 0), V(Math.cos(i * 1.6), 0.6, Math.sin(i * 1.6)), gore === 2 ? 2.5 : 1);
        if (gore === 2) screenSplatter(4);
      }
    });
    this.tween(s + 2.95, 0.07, (u) => { jaws[0].rotation.z = 0.85 * (1 - u); jaws[1].rotation.z = -0.85 * (1 - u); });
    if (gore) {
      const blood = new THREE.Color(0x8a0008);
      this.tween(s + 2.95, 0.6, (u) => waterMat.color.lerpColors(waterBlue, blood, u * (gore === 2 ? 1 : 0.5)));
    }
    this.tween(s + 3.05, 0.9, (u) => {
      shark.rotation.z = -this.back * 1.7 * ease.inOut(u);
      shark.position.y = 0.3 + Math.sin(u * Math.PI) * 0.9 - u * u * 6;
    });
    this.at(s + 3.9, () => {
      this.sound('splash', 1);
      shark.visible = false;
      this.spray(V(vx, 0.2, 0), 25, 0xcfefff, 4);
      this.shot(V(vx - this.back * 1.6, 1.9, 5.0), V(vx, 0.4, 0), 5);
    });
    this.at(s + 4.4, () => {
      this.sound('burp');
      const hat = this.mesh(boxGeo(0.3, 0.08, 0.3), this.glossy(def.band ?? def.hair));
      hat.position.set(vx, 0.1, 0);
      this.gib(hat, V(0.6 * this.back, 4.4, 0.5));
      if (gore === 2) this.death.throwPart(def, 'shL', V(-0.6 * this.back, 3.2, 0.4), V(4, 2, 6));
    });
    return s + 5.5;
  }

  // ================================================================ 7. UFO
  ufo(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const metal = this.glossy(0xc8ced8, { metal: true });
    const ufo = new THREE.Group();
    this.mesh(icoGeo(1, 3), metal, ufo).scale.set(2.3, 0.4, 2.3);
    const rim = this.mesh(new THREE.TorusGeometry(2.25, 0.09, 8, 48), this.glossy(0x7a808c, { metal: true }), ufo);
    rim.rotation.x = Math.PI / 2;
    this.mesh(new THREE.SphereGeometry(0.85, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.glossy(0x80f0ff, { extra: { transparent: true, opacity: 0.55 } }), ufo).position.y = 0.28;
    const alien = this.mesh(icoGeo(0.24, 1), this.glow(0x60ff60), ufo);
    alien.position.y = 0.5;
    for (const sx of [-1, 1]) this.mesh(icoGeo(0.06, 0), this.glow(0x000000), ufo).position.set(sx * 0.09, 0.55, 0.2);
    const lights = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const l = this.mesh(icoGeo(0.11, 1), this.glow(0xffffff), ufo);
      l.position.set(Math.cos(a) * 2.05, -0.02, Math.sin(a) * 2.05);
      lights.push(l);
    }
    const under = this.mesh(new THREE.CircleGeometry(1.0, 32), this.glow(0x80ffb0, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), ufo);
    under.rotation.x = Math.PI / 2;
    under.position.y = -0.38;
    const beamG = new THREE.Group();
    beamG.position.y = -0.35;
    beamG.userData.rec = true;
    const H = 5.4;
    const beamGeo = cylGeo(0.45, 1.5, H, 24, true);
    beamGeo.translate(0, -H / 2, 0);
    const beam = this.mesh(beamGeo, this.glow(0x70ffa0, { transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }), beamG);
    beamG.scale.y = 0.001;
    beamG.visible = false;
    ufo.add(beamG);
    const hover = V(vx, 5.8, 0);
    const startP = V(vx + this.back * 14, 15, -30);
    ufo.position.copy(startP);
    this.add(ufo);
    let red = false;

    this.at(s, () => {
      this.sound('ufoSiren', 6.5);
      this.shot(V(vx - this.back * 2.8, 1.0, 6.6), V(vx, 3.2, 0), 4);
    });
    this.tween(s, 1.4, (u) => {
      ufo.position.lerpVectors(startP, hover, ease.out(u));
      ufo.rotation.z = (1 - u) * 0.4 * this.back;
    });
    this.tween(s, 6.4, (u, dt, age) => {
      ufo.rotation.y += dt * 1.5;
      lights.forEach((l, i) => l.material.color.setHSL(red ? 0 : ((age * 2 + i / 10) % 1), 1, red && Math.floor(age * 12) % 2 ? 0.2 : 0.55));
      alien.position.y = 0.5 + Math.sin(age * 6) * 0.04;
    });
    this.at(s + 1.4, () => { beamG.visible = true; this.sound('zap'); });
    this.tween(s + 1.4, 0.3, (u) => { beamG.scale.y = Math.max(0.001, u); });
    this.tween(s + 1.4, 2.0, (u, dt, age) => { beam.material.opacity = 0.25 + 0.12 * Math.sin(age * 20); });
    this.at(s + 1.7, () => {
      def.play('panic');
      this.shot(V(vx - this.back * 3.0, 2.4, 8.0), () => V(vx, Math.min(def.root.position.y + 1.2, 4.2), 0), 4);
    });
    this.tween(s + 1.7, 1.6, (u, dt, age) => {
      X.dy = 4.5 * ease.inOut(u);
      X.ry += dt * 2.5;
      X.rz = Math.sin(age * 4) * 0.25;
    });
    this.at(s + 3.3, () => { X.vis = false; this.sound('pop'); });
    this.tween(s + 3.3, 0.25, (u) => { beamG.scale.y = Math.max(0.001, 1 - u); });
    this.at(s + 3.55, () => { beamG.visible = false; red = true; });
    [3.5, 3.8, 4.05, 4.35].forEach((d) => this.at(s + d, () => { this.sound('ufoBang'); G.cam.shake(0.25); }));
    if (gore === 2) this.at(s + 3.6, () => this.sound('grind', 1.1));
    this.tween(s + 3.4, 1.3, (u, dt, age) => {
      ufo.position.x = vx + Math.sin(age * 40) * 0.08;
      ufo.rotation.z = Math.sin(age * 33) * 0.12;
    });
    this.at(s + 4.8, () => {
      Object.assign(X, { vis: true, ry: 0, rz: 0, dy: 4.6 });
      if (gore === 2) Object.assign(X, { tint: 0xefe6d2, tintAmt: 1, bare: true });
      else def.rearrange();
      def.play('ko');
      this.shot(V(vx - this.back * 1.8, 1.4, 4.6), V(vx, 0.7, 0), 5);
    });
    this.tween(s + 4.8, 0.55, (u) => { X.dy = 4.6 * (1 - u * u); });
    if (gore === 2) {
      this.tween(s + 4.8, 0.9, () => {
        for (let i = 0; i < 3; i++) G.fx.drop(V(vx + rnd(0.8), 5.4, rnd(0.8)), V(0, -1, 0), 0.06);
      });
    }
    this.at(s + 5.35, () => {
      X.dy = 0;
      this.sound('thud', 1.3);
      G.fx.dust(def.root.position);
      G.cam.shake(0.4);
      this.bleed(def.chest(), V(0, 0.5, 0), gore === 2 ? 1.8 : 0.6);
      this.pool(vx, 0);
    });
    this.at(s + 5.6, () => { this.sound('zip'); red = false; });
    this.tween(s + 5.6, 0.7, (u) => ufo.position.lerpVectors(hover, V(vx - this.back * 30, 32, -70), ease.in(u)));
    return s + 6.4;
  }

  // ================================================================ 8. ruler
  ruler(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const skin = this.glossy(0xe6b48e, { skin: true });
    const rulerTex = this.track(canvasTexture(32, 256, (g, w, h) => {
      g.fillStyle = '#e8c078';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a2410';
      for (let y = 4; y < h; y += 8) g.fillRect(0, y, (y / 8) % 4 === 0 ? 12 : 6, 1);
      g.font = 'bold 9px monospace';
      for (let i = 0; i < 8; i++) g.fillText(String(i * 4), 14, 8 + i * 32);
    }));
    const H = new THREE.Group();
    this.mesh(boxGeo(1.2, 1.0, 1.1), skin, H);
    this.mesh(boxGeo(0.4, 0.35, 0.7), skin, H).position.set(0.25, 0.5, 0.35);
    const cuff = this.mesh(cylGeo(0.62, 0.62, 0.35, 16), this.glossy(0xf4f0e8), H);
    cuff.rotation.z = Math.PI / 2;
    cuff.position.x = -0.75;
    const sleeve = this.mesh(cylGeo(0.66, 0.78, 7, 16), this.glossy(0x5a4030), H);
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.x = -4.4;
    this.mesh(boxGeo(6.8, 0.12, 0.8), this.glossy(0xffffff, { map: rulerTex }), H).position.set(3.6, 0, 0);
    const D = 4.6;
    const pivot = V(vx + this.back * D, 3.1, 0);
    const pivotStart = V(vx + this.back * 12, 8.5, -0.8);
    H.position.copy(pivotStart);
    H.rotation.set(0, this.back > 0 ? Math.PI : 0, 0.85);
    this.add(H);

    this.at(s, () => {
      this.sound('whooshBig');
      this.shot(V(vx - this.back * 1.5, 2.4, 9.2), V(vx + this.back * 1.6, 2.0, 0), 5);
    });
    this.tween(s, 0.8, (u) => { H.position.lerpVectors(pivotStart, pivot, ease.out(u)); });
    const whack = (t, i) => {
      let aHit = 0;
      this.at(t, () => { aHit = Math.asin(Math.max(-0.9, Math.min(0.9, (1.97 + X.dy - pivot.y) / D))); });
      this.tween(t, 0.11, (u) => { H.rotation.z = 0.85 + (aHit - 0.85) * ease.in(u); });
      this.at(t + 0.11, () => {
        this.sound('thwack');
        sfx.grunt(def.def.voice);
        G.cam.shake(0.45);
        G.fx.dust(def.root.position);
        const head = def.head.getWorldPosition(new THREE.Vector3());
        this.bleed(head, V(rnd(0.5), 1, rnd(0.5)), gore === 2 ? 1.2 + 0.3 * i : 0.4);
        if (i === 2 && gore === 2) screenSplatter(4);
        if (i === 0) {
          const crack = this.mesh(new THREE.CircleGeometry(0.75, 24), this.glow(0x201008, { transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
          crack.rotation.x = -Math.PI / 2;
          crack.position.set(vx, 0.02, 0);
        }
      });
      this.tween(t + 0.11, 0.08, (u) => { X.dy = -0.5 * i - 0.5 * u; });
      this.tween(t + 0.25, 0.35, (u) => { H.rotation.z = aHit + (0.85 - aHit) * ease.out(u); });
    };
    whack(s + 1.0, 0);
    whack(s + 1.7, 1);
    whack(s + 2.4, 2);
    this.at(s + 2.5, () => this.shot(V(vx - this.back * 1.0, 1.1, 3.2), V(vx, 0.55, 0), 6));
    const fTex = this.track(textTex(128, 96, (g, w, h) => {
      g.strokeStyle = '#ff2020';
      g.lineWidth = 6;
      g.beginPath();
      g.ellipse(w / 2, h / 2, w / 2 - 6, h / 2 - 6, -0.1, 0, Math.PI * 2);
      g.stroke();
      g.font = 'bold 60px Impact, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ff2020';
      g.fillText('F-', w / 2, h / 2 + 3);
    }));
    const fSign = this.sprite(fTex, 0xffffff, 0.001, 0.001);
    fSign.position.set(vx, 1.35, 0.25);
    this.at(s + 3.0, () => this.sound('schoolBell'));
    this.tween(s + 3.0, 0.3, (u) => { const k = ease.back(u); fSign.scale.set(0.9 * k + 0.001, 0.68 * k + 0.001, 1); });
    this.tween(s + 3.1, 1.0, (u, dt, age) => { H.rotation.x = Math.sin(age * 14) * 0.35 * (1 - u); });
    this.tween(s + 4.1, 0.6, (u) => H.position.lerpVectors(pivot, pivotStart, ease.in(u)));
    return s + 4.8;
  }

  // ================================================================ 9. pencil sharpener
  sharpen(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const metal = this.glossy(0xc6ccd6, { metal: true });
    const dark = this.glow(0x111111);
    const box = new THREE.Group();
    this.mesh(boxGeo(1.8, 2.2, 1.6), metal, box);
    this.mesh(coneGeo(0.6, 0.9, 24), dark, box).position.y = -1.1 + 0.45;
    const labelTex = this.track(textTex(256, 64, (g, w, h) => {
      g.fillStyle = '#d02020';
      g.fillRect(0, 0, w, h);
      g.font = 'bold 34px Impact, "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.fillText('SHARP-O-MATIC', w / 2, h / 2 + 2);
    }));
    this.mesh(new THREE.PlaneGeometry(1.5, 0.38), this.glossy(0xffffff, { map: labelTex }), box).position.set(0, 0.55, 0.81);
    this.mesh(boxGeo(0.9, 0.12, 0.05), dark, box).position.set(0, -0.55, 0.81);
    const crank = new THREE.Group();
    crank.position.set(0.95, 0.2, 0);
    crank.userData.rec = true;
    const axle = this.mesh(cylGeo(0.08, 0.08, 0.3, 12), metal, crank);
    axle.rotation.z = Math.PI / 2;
    axle.position.x = 0.15;
    this.mesh(boxGeo(0.12, 0.9, 0.12), metal, crank).position.set(0.3, -0.35, 0);
    const knob = this.mesh(cylGeo(0.12, 0.12, 0.35, 12), this.glossy(0xd02020), crank);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.45, -0.75, 0);
    box.add(crank);
    box.position.set(vx, 10, 0);
    this.add(box);

    const shaveGeo = new THREE.TorusGeometry(0.13, 0.04, 6, 14, Math.PI * 1.4);
    this.disposables.push(shaveGeo);
    const shaveMats = {};
    const shaveMat = (c) => (shaveMats[c] ??= this.glossy(c));
    const red = this.track(wetMat(0x9a000a));

    this.at(s, () => {
      this.sound('whooshBig');
      this.shot(V(vx - this.back * 2.2, 2.6, 8.6), V(vx, 2.6, 0), 5);
    });
    this.tween(s, 0.8, (u) => { box.position.y = 10 - 5.8 * ease.out(u); });
    this.at(s + 0.8, () => { this.sound('ufoBang'); G.cam.shake(0.2); });
    this.at(s + 0.9, () => def.play('panic'));
    this.tween(s + 0.9, 0.6, (u) => { X.dy = 1.15 * ease.inOut(u); });
    this.at(s + 1.5, () => this.sound('grind', 2.3));
    this.tween(s + 1.5, 2.2, (u, dt) => {
      X.dy = 1.15 + 2.2 * u;
      crank.rotation.x -= dt * 16;
      box.position.x = vx + rnd(0.03);
      box.position.y = 4.2 + rnd(0.02);
      G.cam.shake(0.03);
      if (Math.random() < dt * 24) {
        const c = u < 0.3 ? def.hair : u < 0.65 ? def.top : u < 0.9 ? def.bottom : def.shin;
        const m = this.mesh(shaveGeo, gore === 2 && Math.random() < 0.5 ? red : shaveMat(c));
        m.position.set(vx + rnd(0.4), 3.55, 0.85);
        m.rotation.set(rnd(3), rnd(3), rnd(3));
        this.gib(m, V(rnd(1.6), 0.6 + Math.random() * 0.8, 1.2 + Math.random() * 1.2), V(rnd(12), rnd(12), rnd(12)));
      }
      if (gore === 2 && Math.random() < dt * 30) G.fx.drop(V(vx + rnd(0.3), 3.05, rnd(0.3)), V(0, -0.5, 0), 0.05);
    });
    this.at(s + 3.7, () => {
      X.vis = false;
      this.sound('ding');
      if (gore === 2) {
        for (const sx of [-1, 1]) {
          const shoe = this.mesh(boxGeo(0.14, 0.09, 0.28), this.glossy(def.shoe));
          shoe.position.set(vx + sx * 0.12, 3.0, 0);
          this.gib(shoe, V(sx * 0.4, 0, 0.3), V(rnd(6), rnd(6), rnd(6)));
        }
      }
      this.shot(V(vx - this.back * 1.5, 1.1, 4.2), V(vx, 0.35, 0.8), 5);
    });
    this.at(s + 4.0, () => this.sound('zip'));
    this.tween(s + 4.0, 0.7, (u) => { box.position.y = 4.2 + 8 * ease.in(u); });
    return s + 4.9;
  }

  // ================================================================ 10. HUD bonk
  bonk(s) {
    const { def, vx } = this;
    const X = def.xform;
    const gore = G.settings.gore;
    const barTex = this.track(canvasTexture(8, 32, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#fffbd0');
      gr.addColorStop(0.3, '#ffe23a');
      gr.addColorStop(0.7, '#f2b010');
      gr.addColorStop(1, '#b86a00');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }));
    const B = new THREE.Group();
    this.mesh(boxGeo(3.4, 0.46, 0.26), this.glossy(0xffffff, { map: barTex }), B).position.x = 1.7;
    this.mesh(boxGeo(3.5, 0.58, 0.18), this.glossy(0xffffff), B).position.set(1.7, 0, -0.03);
    B.visible = false;
    this.add(B);
    const camPos = () => V(-0.62, 0.38, -1.3).applyMatrix4(G.camera.matrixWorld);
    const P = V(vx - this.back * 1.9, 1.2, 0.9);
    const hit = Math.atan2(0.9, this.back * 1.9);
    const wind = hit + 2.3;
    const follow = hit - 1.6;
    let from = null;

    this.at(s, () => {
      this.overlay('hudbar', true);
      this.sound('whooshBig');
      from = camPos();
      B.position.copy(from);
      B.scale.setScalar(0.3);
      B.visible = true;
      this.shot(V(vx - this.back * 2.4, 1.9, 7.8), V(vx - this.back * 0.4, 1.3, 0), 6);
    });
    this.tween(s, 0.9, (u) => {
      B.position.lerpVectors(from, P, ease.inOut(u));
      B.scale.setScalar(0.3 + 0.7 * u);
      B.rotation.set((1 - u) * 6, wind * u, 0);
    });
    this.tween(s + 0.9, 0.5, (u, dt, age) => { B.rotation.y = wind + Math.sin(age * 14) * 0.12; });
    this.tween(s + 1.4, 0.16, (u) => { B.rotation.y = wind + (follow - wind) * ease.in(u); });
    this.at(s + 1.49, () => {
      this.sound('batCrack');
      this.sound('crowd', 0.8, 1.5);
      hitstop(0.08);
      G.post.pulse({ flash: 0.5, invert: 2, zoom: 0.8, aberr: 1 });
      G.cam.shake(0.9);
      G.fx.spark(def.chest(), 2.2, 0xffe060);
      this.sound('impact', 1.6);
      if (gore === 2) {
        for (const p of ['head', 'shL', 'shR', 'hipL', 'hipR', 'spine', 'pelvis']) {
          this.death.throwPart(def, p, V(this.back * (6 + Math.random() * 4), 3 + Math.random() * 4, rnd(2)), V(rnd(15), rnd(15), rnd(15)));
        }
        for (let i = 0; i < 3; i++) this.bleed(def.chest(), V(this.back, 0.4 + i * 0.2, rnd(0.5)), 3);
        screenSplatter(6);
        this.at(s + 2.8, () => this.pool(vx + this.back * 2.5, 0));
      } else {
        this.shot(V(vx - this.back * 2.5, 1.2, 6.4), () => def.root.position.clone(), 5);
      }
    });
    if (gore < 2) {
      this.tween(s + 1.49, 2.0, (u, dt, age) => {
        X.dx = this.back * 9 * age;
        X.dy = 11 * age - 1.5 * age * age;
        X.dz = -16 * age;
        X.rz += dt * 14;
        X.rx += dt * 9;
      });
      const tw = this.sprite(starTex, 0xffffff, 0.001, 0.001, { blending: THREE.AdditiveBlending });
      this.at(s + 3.5, () => {
        X.vis = false;
        tw.position.copy(def.root.position);
        this.sound('twinkle');
      });
      this.tween(s + 3.5, 0.7, (u) => { const k = Math.sin(u * Math.PI) * 2.2 + 0.001; tw.scale.set(k, k, 1); tw.material.rotation = u * 3; });
    }
    let back = null;
    this.at(s + 1.9, () => { back = camPos(); });
    this.tween(s + 1.9, 0.8, (u) => {
      B.position.lerpVectors(P, back, ease.in(u));
      B.scale.setScalar(1 - 0.7 * u);
    });
    this.at(s + 2.7, () => { B.visible = false; this.overlay('hudbar', false); });
    return gore === 2 ? s + 3.3 : s + 4.3;
  }
}
