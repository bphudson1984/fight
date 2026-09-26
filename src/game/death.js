// K.O. finishers: varied (and, on Extreme gore, gross) death sequences.
// Handles the choreography, flying body-part physics, blood emitters and the
// data the replay needs to show it all again.
import * as THREE from 'three';
import { G } from './context.js';
import { T, slowmo } from './time.js';
import { sfx, say } from '../audio/sfx.js';
import { hud, screenSplatter } from '../ui/hud.js';

export const DEATH_NAMES = {
  classic: '',
  decap: 'HEADLESS!',
  gib: 'OBLITERATED!',
  armrip: 'DISARMED!',
  spinesnap: 'SPINE BREAKER!',
  crumple: 'FACEPLANT!',
  launchsplat: 'SKY-HIGH SPLAT!',
  spinout: 'HELICOPTER!',
};

let lastDeath = null;

/** Testing hook: set DEATH_DEBUG.force to a variant name. */
export const DEATH_DEBUG = { force: null };

/** Choose a finisher from the killing blow and the gore level. */
export function pickDeath({ finisher = false, kind = 'high', gore = 0 }) {
  if (DEATH_DEBUG.force) return DEATH_DEBUG.force;
  let pool;
  if (gore === 2) {
    if (finisher) pool = ['gib', 'decap', 'gib', 'armrip', 'launchsplat'];
    else if (kind === 'launch') pool = ['decap', 'launchsplat', 'spinout', 'gib'];
    else if (kind === 'mid') pool = ['spinesnap', 'crumple', 'armrip', 'gib', 'spinesnap'];
    else pool = ['decap', 'armrip', 'classic', 'crumple', 'spinesnap', 'decap'];
  } else if (gore === 1) {
    pool = kind === 'launch' || finisher ? ['launchsplat', 'spinout', 'spinesnap'] : ['spinesnap', 'crumple', 'classic', 'spinout'];
  } else {
    pool = kind === 'launch' || finisher ? ['launchsplat', 'spinout'] : ['crumple', 'classic', 'spinout', 'launchsplat'];
  }
  const options = pool.filter((d) => d !== lastDeath);
  lastDeath = options[Math.floor(Math.random() * options.length)];
  return lastDeath;
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _box = new THREE.Box3();
const UP = new THREE.Vector3(0, 1, 0);

export class DeathDirector {
  constructor(fight) {
    this.fight = fight;
    this.clock = 0;
    this.tasks = [];
    this.emitters = [];
    this.gibs = [];
  }

  reset() {
    this.tasks = [];
    this.emitters = [];
    this.gibs = [];
  }

  // ------------------------------------------------------------ recorded primitives
  record(ev) { this.fight.events.push({ t: T.now, ...ev }); }
  at(delay, fn) { this.tasks.push({ at: this.clock + delay, fn }); }

  bleed(pos, dir, strength) {
    G.fx.blood(pos, dir, strength);
    this.record({ type: 'blood', at: pos.clone(), dir: dir.clone(), strength });
  }

  pool(x, z) {
    G.fx.pool(x, z);
    this.record({ type: 'pool', x, z });
  }

  sound(name, ...args) {
    sfx[name]?.(...args);
    this.record({ type: 'sound', name, args });
  }

  emit(spec) {
    this.emitters.push({ ...spec, age: 0 });
    this.record({ type: 'emitter', spec });
  }

  /** Detach a part and throw it. */
  throwPart(f, name, vel, spin) {
    const obj = f.detach(name, G.scene);
    if (!obj) return null;
    this.gibs.push({ obj, vel, spin, f, name, rest: false, bounces: 0 });
    if (G.settings.gore === 2) this.emit({ kind: 'trail', f, name, dur: 1.6 });
    return obj;
  }

  // ------------------------------------------------------------ finishers
  /** Start a finisher. Returns how long it takes (game seconds). */
  start(variant, att, def) {
    const gore = G.settings.gore;
    const back = -def.facing; // world x direction away from the attacker
    const chest = def.chest();
    const dirBack = new THREE.Vector3(back, 0, 0);
    const name = DEATH_NAMES[variant];
    if (name) {
      setTimeout(() => {
        if (this.fight.phase !== 'ko') return;
        hud.sub(name, 'red');
        say(name.replace(/[!-]/g, ' '), { rate: 1.05, pitch: 0.5 });
      }, 700);
    }

    switch (variant) {
      case 'decap': {
        slowmo(0.35, 0.9);
        def.play('decapBody');
        const head = this.throwPart(def, 'head',
          new THREE.Vector3(back * 1.6, 5.8, (Math.random() - 0.5) * 1.2),
          new THREE.Vector3(9 + Math.random() * 4, 6, 12 * back));
        this.sound('ripOff');
        this.sound('screamCut', def.def.voice);
        this.bleed(chest.clone().add(new THREE.Vector3(0, 0.45, 0)), dirBack, 3);
        this.emit({ kind: 'geyser', f: def, source: 'head', dur: 2.6, power: 1 });
        screenSplatter(4);
        if (head) G.cam.follow(head, 1.5, def);
        this.at(2.3, () => this.pool(def.chest().x, def.chest().z));
        this.at(2.4, () => def.twitch(3));
        return 3.2;
      }

      case 'gib': {
        def.play('gibBody');
        this.sound('gibExplode');
        G.post.pulse({ flash: 0.3, flashColor: 0xff1010, invert: 2, zoom: 0.6, aberr: 1 });
        G.fx.shockwave(chest.x, 0, 2.5, 0xff2020);
        for (let i = 0; i < 4; i++) {
          const d = new THREE.Vector3(Math.cos(i * 1.6) * 0.8 + back * 0.5, 0.3, Math.sin(i * 1.6) * 0.8);
          this.bleed(chest.clone(), d, 3);
        }
        const out = (x, y, z, s = 1) => new THREE.Vector3(x * s, y * s, z * s);
        const spin = () => new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
        this.throwPart(def, 'head', out(back * 1.5, 6.5, 0.4), spin());
        this.throwPart(def, 'shL', out(back * 0.8 + 1.2, 4.2, 1.8), spin());
        this.throwPart(def, 'shR', out(back * 0.8 - 1.2, 4.6, -1.6), spin());
        this.throwPart(def, 'hipL', out(back * 1.2 + 0.6, 3.2, 1.4), spin());
        this.throwPart(def, 'hipR', out(back * 1.4 - 0.6, 3.4, -1.3), spin());
        this.throwPart(def, 'spine', out(back * 2.2, 3.8, 0), spin());
        this.throwPart(def, 'pelvis', out(back * 1.6, 2.2, 0.2), spin());
        screenSplatter(6);
        G.cam.shake(0.8);
        this.at(0.15, () => { this.bleed(chest.clone(), new THREE.Vector3(0, 1, 0), 2.5); this.sound('splat', 1); });
        this.at(1.6, () => {
          this.pool(chest.x + back * 1.2, 0.3);
          this.pool(chest.x + back * 2.2, -0.4);
          this.pool(chest.x, 0);
        });
        return 2.8;
      }

      case 'armrip': {
        const lead = def.isDetached('shL') ? 'shR' : 'shL';
        def.play('armripBody');
        this.throwPart(def, lead, new THREE.Vector3(back * 2.8, 4.5, 1.2 * (Math.random() < 0.5 ? 1 : -1)), new THREE.Vector3(14, 3, 9));
        this.sound('ripOff');
        this.sound('scream', def.def.voice);
        this.bleed(chest.clone(), dirBack, 2.5);
        this.emit({ kind: 'geyser', f: def, source: lead, dur: 2.2, power: 0.8 });
        screenSplatter(3);
        this.at(1.5, () => this.sound('thud', 1));
        this.at(1.9, () => this.pool(def.chest().x, def.chest().z));
        this.at(1.6, () => def.twitch(2.5));
        return 2.9;
      }

      case 'spinesnap': {
        slowmo(0.4, 0.5);
        def.play('spinesnap');
        this.sound(gore ? 'spineCrack' : 'thud', 1);
        this.sound('scream', def.def.voice);
        if (gore) this.bleed(def.head.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0, 1, 0), 1.2);
        if (gore === 2) this.emit({ kind: 'drool', f: def, dur: 2.4 });
        this.at(0.45, () => { if (gore) this.sound('spineCrack'); });
        this.at(1.2, () => this.sound('thud', 1.2));
        this.at(1.4, () => def.twitch(3));
        this.at(1.7, () => { if (gore) this.pool(def.head.getWorldPosition(_v).x, 0); });
        G.cam.follow(def.spine, 2.2, def);
        return 2.4;
      }

      case 'crumple': {
        def.play('crumple');
        sfx.groan(def.def.voice);
        this.at(1.55, () => {
          this.sound('splat', 0.9);
          G.cam.shake(0.3);
          const h = def.head.getWorldPosition(new THREE.Vector3());
          if (gore) this.bleed(h, new THREE.Vector3(back, 0.2, 0), 1.6);
          if (gore === 2) G.fx.teeth(h, new THREE.Vector3(-back, 0, 0), 3);
        });
        this.at(1.9, () => { if (gore) this.pool(def.head.getWorldPosition(_v).x, def.head.getWorldPosition(_v).z); def.twitch(2.5); });
        return 2.6;
      }

      case 'launchsplat': {
        def.play('launchsplat');
        sfx.whooshBig();
        this.sound('scream', def.def.voice);
        G.cam.follow(def.spine, 2.4, def);
        if (gore === 2) this.emit({ kind: 'trailBody', f: def, dur: 1.2 });
        this.at(1.27, () => {
          this.sound('splat', 1.5);
          G.cam.shake(0.6);
          G.post.pulse({ flash: 0.4, aberr: 1 });
          G.fx.shockwave(def.root.position.x, 0, 2.4, 0xffffff);
          const p = def.chest();
          if (gore) {
            for (let i = 0; i < 3; i++) this.bleed(p, new THREE.Vector3(Math.cos(i * 2.1), 0.5, Math.sin(i * 2.1)), gore === 2 ? 2.4 : 1);
            this.pool(p.x, p.z);
          }
          if (gore === 2) screenSplatter(3);
        });
        this.at(1.5, () => def.twitch(3));
        return 2.6;
      }

      case 'spinout': {
        def.play('spinout');
        sfx.whooshBig();
        this.sound('scream', def.def.voice);
        G.cam.follow(def.spine, 1.6, def);
        this.at(1.05, () => {
          this.sound('thud', 1.4);
          G.cam.shake(0.5);
          G.fx.dust(def.root.position);
          if (gore) this.bleed(def.chest(), new THREE.Vector3(back, 0.4, 0), 1.2);
        });
        this.at(1.3, () => def.twitch(2));
        return 2.2;
      }

      default: // classic head-snap K.O.
        def.play('ko');
        sfx.scream(def.def.voice);
        this.at(1.0, () => def.twitch(1.5));
        return 1.6;
    }
  }

  // ------------------------------------------------------------ per frame
  /** live=true while playing; false during the replay (emitters only). */
  update(dt, live = true) {
    if (live) {
      this.clock += dt;
      for (let i = this.tasks.length - 1; i >= 0; i--) {
        if (this.clock >= this.tasks[i].at) { const t = this.tasks[i]; this.tasks.splice(i, 1); t.fn(); }
      }
      for (const g of this.gibs) this.stepGib(g, dt);
    }
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.age += dt;
      if (e.age >= e.dur) { this.emitters.splice(i, 1); continue; }
      this.runEmitter(e, dt);
    }
  }

  stepGib(g, dt) {
    if (g.rest || dt <= 0) return;
    g.vel.y -= 9.8 * dt;
    g.obj.position.addScaledVector(g.vel, dt);
    _e.set(g.spin.x * dt, g.spin.y * dt, g.spin.z * dt);
    _q.setFromEuler(_e);
    g.obj.quaternion.premultiply(_q);
    g.obj.updateMatrixWorld(true);
    _box.setFromObject(g.obj);
    if (_box.min.y < 0) {
      g.obj.position.y -= _box.min.y;
      if (g.vel.y < 0) {
        const impact = -g.vel.y;
        g.bounces++;
        g.vel.y = impact * 0.32;
        g.vel.x *= 0.55;
        g.vel.z *= 0.55;
        g.spin.multiplyScalar(0.5);
        if (impact > 1.5) {
          const p = g.obj.getWorldPosition(new THREE.Vector3());
          if (G.settings.gore) G.fx.splat(p.x, p.z, 0.25 + Math.random() * 0.25);
          sfx.gore(G.settings.gore || 1, { strength: 0.6 });
        }
        if (impact < 1.2 || g.bounces > 3) g.vel.y = 0;
      }
      g.vel.x *= Math.max(0, 1 - 4 * dt);
      g.vel.z *= Math.max(0, 1 - 4 * dt);
      g.spin.multiplyScalar(Math.max(0, 1 - 4 * dt));
      if (g.vel.lengthSq() < 0.01 && g.bounces > 0) g.rest = true;
    }
  }

  runEmitter(e, dt) {
    if (G.settings.gore === 0 || dt <= 0) return;
    const f = e.f;
    const fx = G.fx;
    const n = (rate) => {
      const want = rate * dt;
      return Math.floor(want) + (Math.random() < want % 1 ? 1 : 0);
    };
    if (e.kind === 'geyser') {
      // pulsing arterial spray from the stump
      const u = e.age / e.dur;
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(e.age * 11));
      const rate = 260 * (1 - u) * pulse * e.power;
      let src;
      const dir = new THREE.Vector3();
      if (e.source === 'head') {
        src = f.neck.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0));
        dir.copy(UP).applyQuaternion(f.spine.getWorldQuaternion(_q));
      } else {
        const sx = e.source === 'shL' ? 1 : -1;
        src = f.spine.localToWorld(new THREE.Vector3(sx * 0.26 * f.S, 0.44, 0));
        dir.set(sx, 0.6, 0).applyQuaternion(f.spine.getWorldQuaternion(_q));
      }
      if (Math.sin(e.age * 11) > 0.95 && e.lastPulse !== Math.floor(e.age * 11 / (Math.PI * 2))) {
        e.lastPulse = Math.floor(e.age * 11 / (Math.PI * 2));
        sfx.spurt(0.5 * (1 - u) + 0.1);
      }
      for (let i = n(rate); i > 0; i--) {
        const v = dir.clone().multiplyScalar(2.5 + Math.random() * 3.5 * (1 - u * 0.5))
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.5, (Math.random() - 0.5) * 0.9));
        fx.drop(src, v, 0.05 + Math.random() * 0.07);
      }
    } else if (e.kind === 'trail') {
      const obj = f.detached.get(e.name)?.obj;
      if (!obj) return;
      const p = obj.getWorldPosition(new THREE.Vector3());
      for (let i = n(90 * (1 - e.age / e.dur)); i > 0; i--) {
        fx.drop(p, new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8), 0.04 + Math.random() * 0.05);
      }
    } else if (e.kind === 'trailBody') {
      const p = f.chest();
      for (let i = n(70); i > 0; i--) fx.drop(p, new THREE.Vector3((Math.random() - 0.5), Math.random(), (Math.random() - 0.5)), 0.05);
    } else if (e.kind === 'drool') {
      const p = f.head.getWorldPosition(new THREE.Vector3());
      for (let i = n(25); i > 0; i--) fx.drop(p, new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.2, (Math.random() - 0.5) * 0.3), 0.035);
    }
  }

  // ------------------------------------------------------------ replay support
  /** World transforms of every detached part (recorded each frame). */
  snapshot(p1, p2) {
    let out = null;
    for (const [i, f] of [[0, p1], [1, p2]]) {
      for (const [name, d] of f.detached) {
        (out ??= []).push([i, name, d.obj.position.clone(), d.obj.quaternion.clone()]);
      }
    }
    return out;
  }

  /** Re-fire a recorded event during the replay. */
  replayEvent(e) {
    if (e.type === 'blood') G.fx.blood(e.at, e.dir, e.strength);
    else if (e.type === 'pool') G.fx.pool(e.x, e.z);
    else if (e.type === 'sound') sfx[e.name]?.(...(e.args || []));
    else if (e.type === 'emitter') this.emitters.push({ ...e.spec, age: 0 });
  }
}
