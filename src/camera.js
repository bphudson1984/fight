// Camera director: fight tracking, cinematic super/KO/replay angles, FOV punches,
// shake and dutch-angle roll.
import * as THREE from 'three';

const _p = new THREE.Vector3();
const _l = new THREE.Vector3();

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'attract';
    this.t = 0;
    this.target = null;
    this.other = null;
    this.side = 1;
    this.pos = new THREE.Vector3(0, 2, 6);
    this.look = new THREE.Vector3(0, 1, 0);
    this.shakeAmt = 0;
    this.fovKick = 0;
    this.rollAmt = 0;
    this.baseFov = 40;
    this.snap = true;
    this.previewX = 0;
  }

  /** Switch mode. cut=true jumps instantly (arcade hard cut). */
  set(mode, { target = null, other = null, cut = false, side = null } = {}) {
    this.mode = mode;
    this.t = 0;
    this.target = target;
    this.other = other;
    this.side = side ?? (Math.random() < 0.5 ? 1 : -1);
    if (cut) this.snap = true;
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  /** Scripted shot: pos/look are Vector3s or functions of time returning one. */
  shot(pos, look, follow = 6, cut = false) {
    this.set('shot', { cut });
    this.shotPos = pos;
    this.shotLook = look;
    this.shotFollow = follow;
  }

  /** Track a flying object (e.g. a head) for `dur` seconds, then orbit `back`. */
  follow(obj, dur, back) {
    this.set('follow');
    this.followObj = obj;
    this.followDur = dur;
    this.followBack = back;
  }
  punch(a) { this.fovKick = Math.min(14, this.fovKick + a); }
  roll(a) { this.rollAmt = a; }

  update(rdt, dt, p1, p2, aspect) {
    this.t += dt;
    const portrait = aspect < 1;
    this.baseFov = portrait ? 62 : 40;
    const mid = p1 && p2 ? (p1.root.position.x + p2.root.position.x) / 2 : 0;
    const sep = p1 && p2 ? Math.abs(p1.root.position.x - p2.root.position.x) : 2;
    let follow = 6;
    const t = this.t;

    switch (this.mode) {
      case 'attract': {
        const a = t * 0.18;
        _p.set(Math.sin(a) * 5.4, 1.5 + Math.sin(t * 0.4) * 0.4, Math.cos(a) * 5.4 + 0.3);
        _l.set(0, 1.0, 0);
        follow = 3;
        break;
      }
      case 'fight-attract': { // demo play: fight cam that drifts around
        const a = Math.sin(t * 0.25) * 0.5;
        const d = 5 + Math.sin(t * 0.33) * 0.6;
        _p.set(mid + Math.sin(a) * d, 1.4 + Math.sin(t * 0.5) * 0.3, Math.cos(a) * d);
        _l.set(mid, 1.1, 0);
        follow = 4;
        break;
      }
      case 'select': {
        const a = 0.35 + Math.sin(t * 0.5) * 0.25;
        _p.set(this.previewX + Math.sin(a) * 3.7, 1.45, Math.cos(a) * 3.7);
        _l.set(this.previewX + 0.95, 1.15, 0);
        follow = 5;
        break;
      }
      case 'intro': {
        const u = Math.min(1, t / 1.6);
        const e = 1 - Math.pow(1 - u, 3);
        const a = (1 - e) * 1.6 * this.side;
        const d = (portrait ? 5.2 : 5.3) + (1 - e) * 2.5;
        _p.set(mid + Math.sin(a) * d, (portrait ? 1.3 : 1.55) + (1 - e) * 1.8, Math.cos(a) * d);
        _l.set(mid, portrait ? 0.75 : 1.2, 0);
        follow = 40;
        break;
      }
      case 'super': { // low, close, circling the attacker
        const f = this.target || p1;
        const c = f.root.position;
        const a = -f.facing * (0.6 - t * 0.4); // behind-side of the attacker, sweeping round
        const r = portrait ? 3.2 : 2.5;
        _p.set(c.x + Math.sin(a) * r, 0.85, Math.cos(a) * r);
        _l.set(c.x + f.facing * 0.3, 1.3, 0);
        follow = 30;
        break;
      }
      case 'rush': { // wide low tracking shot of both fighters
        const a = this.side * (0.5 + Math.sin(t * 0.8) * 0.25);
        const d = portrait ? 4.8 : 3.9;
        _p.set(mid + Math.sin(a) * d, 0.9, Math.cos(a) * d);
        _l.set(mid, 1.25, 0);
        follow = 10;
        break;
      }
      case 'impact': { // quick low swoop on a big hit, then back to the fight cam
        const f = this.target || p2;
        const c = f.root.position;
        const a = this.side * 0.75;
        const r = portrait ? 4.4 : 3.2;
        _p.set(c.x + Math.sin(a) * r, 0.6, Math.cos(a) * r);
        _l.set((c.x + mid) / 2, 1.25, 0);
        follow = 12;
        if (t > 0.7) this.set(this.back || 'fight');
        break;
      }
      case 'shot': {
        const r = (v) => (typeof v === 'function' ? v(t) : v);
        _p.copy(r(this.shotPos));
        _l.copy(r(this.shotLook));
        if (portrait) _p.sub(_l).multiplyScalar(1.35).add(_l);
        follow = this.shotFollow;
        break;
      }
      case 'follow': {
        // frame the flying object together with the body it came from
        this.followObj.getWorldPosition(_l);
        if (this.followBack) {
          const c = this.followBack.root.position;
          _l.set((_l.x + c.x) / 2, Math.max(0.9, (_l.y + 1.0) / 2), (_l.z + c.z) / 2 * 0.5);
        }
        const a = this.side * (0.3 + t * 0.25);
        const r = portrait ? 6.2 : 4.8;
        _p.set(_l.x + Math.sin(a) * r, 1.3 + _l.y * 0.35, Math.max(2.5, _l.z + Math.cos(a) * r));
        follow = 6;
        if (t > this.followDur) this.set('ko', { target: this.followBack });
        break;
      }
      case 'ko': {
        const f = this.target || p1;
        const c = f.root.position;
        const a = this.side * (0.25 + t * 0.5);
        const r = portrait ? 5.2 : 4.0;
        _p.set(c.x + Math.sin(a) * r, 1.2, Math.cos(a) * r);
        _l.set(c.x, 0.8, 0);
        follow = 8;
        break;
      }
      case 'victory': {
        const f = this.target || p1;
        const c = f.root.position;
        const a = this.side * (0.35 + t * 0.25);
        const r = portrait ? 4.8 : 3.9;
        _p.set(c.x + Math.sin(a) * r, 1.2, Math.cos(a) * r);
        _l.set(c.x, 1.15, 0);
        follow = 6;
        break;
      }
      case 'replay': {
        const shot = Math.floor(t / 1.3) % 3;
        const f = this.target || p1;
        const c = f.root.position;
        if (shot === 0) { _p.set(c.x - f.facing * 2.6, 0.5, 2.2); _l.set(c.x, 1.2, 0); }
        else if (shot === 1) { _p.set(mid, 3.6, 3.2); _l.set(mid, 0.8, 0); }
        else { _p.set(c.x + f.facing * 3.4, 1.3, -1.8); _l.set(c.x, 1.0, 0); }
        follow = 50;
        break;
      }
      default: { // 'fight'
        const d = (portrait ? 5.8 : 5.3) + Math.max(0, sep - 2) * 0.8;
        const sway = Math.sin(t * 0.35) * 0.25;
        _p.set(mid + sway, portrait ? 1.3 : 1.55, d);
        _l.set(mid, portrait ? 0.75 : 1.2, 0);
        follow = 6;
      }
    }

    if (this.snap) {
      this.pos.copy(_p);
      this.look.copy(_l);
      this.snap = false;
    } else {
      const k = 1 - Math.exp(-rdt * follow);
      this.pos.lerp(_p, k);
      this.look.lerp(_l, k);
    }

    const cam = this.camera;
    cam.position.copy(this.pos);
    if (this.shakeAmt > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shakeAmt;
      cam.position.y += (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt = Math.max(0, this.shakeAmt - rdt * 2.2);
    }
    cam.lookAt(this.look);
    this.rollAmt *= Math.exp(-rdt * 3);
    cam.rotateZ(this.rollAmt);
    this.fovKick *= Math.exp(-rdt * 7);
    const fov = this.baseFov - this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }
}
