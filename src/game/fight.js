// One fight (best-of-N rounds) between p1 and a CPU – or CPU vs CPU in demo mode.
// Answering questions drives the action: the next question appears the moment
// you answer, attacks queue up and chain into combos, and the CPU strikes when
// its fuse burns out.
import * as THREE from 'three';
import { G } from './context.js';
import { T, sleep, sleepReal, slowmo, hitstop, Abort } from './time.js';
import { hud, comboName, screenSplatter } from '../ui/hud.js';
import { sfx, say } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { VICTORIES } from '../fighter.js';
import { DIFFICULTIES } from '../maths.js';
import { DeathDirector, pickDeath } from './death.js';

const BASE_DMG = { jab: 7, cross: 8, kick: 10, elbow: 9, knee: 11, sweep: 10, uppercut: 12, spinKick: 14, rushL: 3, rushR: 3, rushKick: 3.5 };
const CHAIN = ['jab', 'cross', 'kick', 'elbow', 'cross', 'knee', 'jab', 'sweep'];
const HEAVY = ['kick', 'knee', 'elbow', 'sweep'];
const CPU_MOVES = ['jab', 'cross', 'kick', 'elbow', 'knee', 'sweep'];
const RUSH_MOVES = ['rushL', 'rushR', 'rushL', 'rushKick'];
const ROUND_TIME = { rookie: 90, fighter: 75, champion: 60, legend: 50 };
const PARRY_TIME = { rookie: 6, fighter: 4.5, champion: 3.6, legend: 3 };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Fight {
  constructor({ p1, p2, attract = false, cpuScale = 1, boss = false }) {
    this.p1 = p1;
    this.p2 = p2;
    this.attract = attract;
    this.cpuScale = cpuScale;
    this.boss = boss;
    this.diff = DIFFICULTIES[G.settings.difficulty];
    this.wins = [0, 0];
    this.round = 1;
    this.meter = [0, 0];
    this.phase = 'idle';
    this.queue = [];
    this.acting = false;
    this.q = null;
    this.qAt = Infinity;
    this.typed = '';
    this.combo = 0;
    this.frames = [];
    this.events = [];
    this.frame = 0;
    this.rejects = new Set();
    this.death = new DeathDirector(this);
    this.lastBeat = 0;
    this.lastTick = 99;
  }

  // ------------------------------------------------------------ plumbing
  wait(setter) {
    return new Promise((resolve, reject) => {
      this.rejects.add(reject);
      setter((v) => { this.rejects.delete(reject); resolve(v); });
    });
  }

  abort() {
    for (const r of this.rejects) r(new Abort());
    this.rejects.clear();
    hud.hideQuestion();
    hud.rush(false);
    hud.letterbox(false);
    hud.replayTag(false);
    hud.superButton(false);
    G.post.setDim(0);
    G.post.setDanger(0);
  }

  get need() { return this.attract ? 1 : G.settings.rounds; }

  // ------------------------------------------------------------ match / rounds
  async run() {
    hud.setWins(0, 0, this.need);
    for (;;) {
      await this.playRound();
      if (this.wins[0] >= this.need || this.wins[1] >= this.need) break;
      this.round++;
    }
    this.phase = 'done';
    G.post.setDanger(0);
    music.setTempoScale(1);
    return this.wins[0] >= this.need;
  }

  async playRound() {
    const { p1, p2 } = this;
    p1.reset();
    p2.reset();
    G.fx.clearDecals();
    hud.splatterClear();
    this.time = this.attract ? 99 : ROUND_TIME[G.settings.difficulty] ?? 60;
    this.combo = 0;
    this.maxCombo = 0;
    this.firstAttack = true;
    this.queue = [];
    this.acting = false;
    this.q = null;
    this.qAt = Infinity;
    this.frames = [];
    this.events = [];
    this.superRequested = false;
    this.cpuSuperRequested = false;
    this.death.reset();
    hud.setTimer(this.time);
    hud.combo(0);
    hud.hideQuestion();
    this.phase = 'intro';
    G.cam.set('intro', { cut: true });

    if (!this.attract) {
      const final = this.need > 1 && this.wins[0] === this.need - 1 && this.wins[1] === this.need - 1;
      hud.banner(final ? 'FINAL<br>ROUND' : `ROUND ${this.round}`, 'gold', 900);
      sfx.slam();
      say(final ? 'Final round' : `Round ${this.round}`, { rate: 1.05 });
      p1.play('taunt');
      await sleep(0.3);
      p2.play('taunt');
      await sleep(0.8);
      hud.banner('FIGHT!!', 'fire huge', 600);
      sfx.slam();
      sfx.impact(0.8);
      G.post.pulse({ flash: 0.5, aberr: 0.8, zoom: 0.3 });
      G.cam.shake(0.25);
      say('Fight!', { rate: 1.15 });
      await sleep(0.4);
    } else {
      await sleep(0.8);
    }
    G.cam.set(this.attract ? 'fight-attract' : 'fight');
    this.phase = 'fight';
    this.nextQuestion(0);
    this.demoNext = T.now + 0.4;

    const res = await this.wait((r) => { this.endRound = r; });
    hud.hideQuestion();
    hud.superButton(false);
    hud.rush(false);
    hud.combo(0);
    G.post.setDanger(0);
    music.setTempoScale(1);

    if (res.timeover) {
      hud.banner('TIME!', 'red', 1200);
      sfx.slam();
      say('Time!');
      await sleep(1.4);
    } else {
      await sleep(res.deathDur ?? 1.5);
      if (!this.attract) await this.replay(res.deathDur ?? 1.5);
    }

    if (res.draw) {
      hud.banner('DRAW', 'gold', 1500);
      say('Draw');
      await sleep(1.8);
      return;
    }

    const { winner, loser } = res;
    const p1Won = winner === p1;
    winner.play(pick(VICTORIES));
    if (res.timeover) loser.play('lose');
    G.cam.set('victory', { target: winner, cut: true });
    this.wins[p1Won ? 0 : 1]++;
    hud.setWins(this.wins[0], this.wins[1], this.need);
    const perfect = winner.health >= 100;
    if (this.attract) {
      hud.banner(`${winner.def.name} WINS`, 'gold small', 1800);
    } else if (p1Won) {
      hud.banner(perfect ? 'PERFECT!!' : 'YOU WIN', 'fire', 1900);
      say(perfect ? 'Perfect!' : 'You win!');
    } else {
      hud.banner(`${winner.def.name}<br>WINS`, 'red small', 1900);
      say(`${winner.def.name} wins`);
    }
    sfx.victory(winner.def.voice);
    sfx.crowd(0.6);
    G.post.pulse({ flash: 0.3 });

    if (p1Won && !this.attract) {
      await sleep(0.8);
      const rows = [
        { label: 'TIME BONUS', value: Math.ceil(Math.max(0, this.time)) * 100 },
        { label: 'LIFE BONUS', value: Math.round(winner.health) * 100 },
        { label: `MAX COMBO x${this.maxCombo}`, value: this.maxCombo * 500 },
      ];
      if (perfect) rows.push({ label: 'PERFECT BONUS', value: 50000 });
      const bonus = await hud.tally(rows, () => sfx.scoreTick());
      G.run.score += bonus;
    } else {
      await sleep(2.4);
    }
  }

  // ------------------------------------------------------------ questions
  nextQuestion(delay = 0) {
    this.q = null;
    this.qAt = T.now + delay;
  }

  spawnQuestion(mode = 'normal') {
    const q = G.run.gen.next();
    const cpuTime = mode === 'parry' ? PARRY_TIME[G.settings.difficulty] ?? 4
      : rand(...this.diff.cpu) * this.cpuScale;
    this.q = { q, mode, start: T.now, startReal: T.real, cpuTime, locked: false };
    this.typed = '';
    const tag = mode === 'rush' ? `RUSH x${this.rushHits}` : mode === 'parry' ? 'PARRY IT!' : '';
    hud.question(q, { mode, tag });
  }

  digit(d) {
    const q = this.q;
    if (!q || q.locked || this.typed.length >= 3) return;
    this.typed += d;
    sfx.key();
    hud.renderQ(q.q, this.typed);
    if (this.typed.length >= String(q.q.answer).length) this.submit();
  }

  back() {
    if (!this.q || this.q.locked) return;
    this.typed = this.typed.slice(0, -1);
    hud.renderQ(this.q.q, this.typed);
  }

  submit() {
    const q = this.q;
    if (!q || q.locked || !this.typed) return;
    q.locked = true;
    const given = +this.typed;
    const correct = given === q.q.answer;
    const elapsed = q.mode === 'normal' ? T.now - q.start : T.real - q.startReal;
    G.run.gen.report(q.q, correct);
    G.run.log.push({ q: q.q, kind: correct ? 'correct' : 'wrong', time: elapsed, given, mode: q.mode });
    hud.result(q.q, this.typed, correct);
    if (q.mode === 'rush') this.onRushAnswer(correct);
    else if (q.mode === 'parry') this.onParryAnswer(correct);
    else if (correct) this.onCorrect(elapsed, q);
    else this.onWrong(q, false);
  }

  superKey() {
    if (this.meter[0] >= 100 && this.phase === 'fight' && !this.attract) this.superRequested = true;
  }

  // ------------------------------------------------------------ answer outcomes
  onCorrect(elapsed, q) {
    const r = elapsed / q.cpuTime;
    const { p1, p2 } = this;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    G.run.maxCombo = Math.max(G.run.maxCombo, this.combo);
    const lightning = r < 0.3;
    const great = r < 0.55;
    const clutch = r > 0.82;

    let move;
    const airborne = p2.airborne || p2.animName === 'launch' || p2.animName === 'juggle';
    if (this.combo % 5 === 0) move = 'uppercut';
    else if (airborne) move = pick(['cross', 'kick', 'knee']);
    else if (lightning) move = pick(HEAVY);
    else move = CHAIN[(this.combo - 1) % CHAIN.length];

    const speedMult = lightning ? 1.35 : great ? 1.15 : 1;
    const dmg = BASE_DMG[move] * speedMult * (1 + Math.min(this.combo, 12) * 0.04);
    const strength = lightning ? 1.5 : great ? 1.15 : 0.9;
    let pts = Math.round((100 + (1 - Math.min(1, r)) * 400) * (1 + this.combo * 0.15));
    if (lightning) pts += 500;

    this.meter[0] = Math.min(100, this.meter[0] + (lightning ? 18 : great ? 13 : 9));
    sfx.correct();
    sfx.combo(this.combo);
    hud.combo(this.combo);

    const label = lightning ? 'LIGHTNING!' : great ? 'GREAT!' : 'GOOD';
    let bonus = '';
    if (this.firstAttack) { bonus = 'FIRST ATTACK!'; pts += 1000; this.firstAttack = false; }
    else if (clutch) { bonus = 'CLOSE CALL!'; pts += 300; }
    if (bonus) hud.sub(bonus);
    const name = comboName(this.combo);
    if (name && this.combo >= 3 && name !== comboName(this.combo - 1)) {
      say(name.replace(/!/g, ''), { rate: 1.2, pitch: 0.7 });
    }

    this.queue.push({ att: p1, def: p2, move, dmg, strength, pts, label, lightning, rate: this.queue.length ? 1.7 : 1.35 });
    this.nextQuestion(0.1);
  }

  onWrong(q, timeout) {
    const { p1, p2 } = this;
    if (this.combo >= 3) {
      hud.sub('COMBO BREAKER!', 'red');
      say('Combo breaker!', { rate: 1.1 });
    }
    this.combo = 0;
    hud.combo(0);
    this.meter[1] = Math.min(100, this.meter[1] + (timeout ? 34 : 28));
    if (timeout) {
      G.run.gen.report(q.q, false);
      G.run.log.push({ q: q.q, kind: 'timeout', time: q.cpuTime, given: null, mode: 'normal' });
      hud.result(q.q, '', false);
      $tag(`TOO SLOW!`);
    } else {
      sfx.wrong();
      $tag('NOT QUITE!');
    }
    if (this.meter[1] >= 100) {
      this.cpuSuperRequested = true;
    } else {
      const move = pick(CPU_MOVES);
      const dmg = this.diff.cpuDmg * (this.boss ? 1.15 : 1) * rand(0.85, 1.15);
      this.queue.push({ att: p2, def: p1, move, dmg, strength: HEAVY.includes(move) ? 1.3 : 1, rate: 1.35 });
    }
    this.nextQuestion(timeout ? 1.0 : 1.2);
  }

  // ------------------------------------------------------------ attacks
  /** Play an attack now; resolves when the attacker's animation ends. */
  attackNow(a) {
    const { att, def, move } = a;
    const n = move === 'combo' ? 3 : 1;
    let hitNo = 0;
    return att.play(move, {
      rate: a.rate ?? 1.35,
      onHit: (kind) => {
        const part = a.dmg / n;
        hitNo++;
        this.applyHit(att, def, kind, part, a, hitNo === n);
      },
    });
  }

  startAction(a) {
    this.acting = true;
    this.actionMove = a.move;
    if (a.att === this.p1 && a.label) {
      const p = G.project(a.def.chest());
      hud.popup(a.label, p.x, p.y - 60, a.lightning ? 'cyan' : 'gold');
    }
    sfx.whoosh();
    this.attackNow(a).then(() => { this.acting = false; });
  }

  applyHit(att, def, kind, dmg, a, last) {
    if (def.health <= 0 || this.phase === 'ko' || this.phase === 'timeover') return;
    const { fx, cam, post } = G;
    const gore = G.settings.gore;
    const parried = !!a.parried;
    const strength = a.strength ?? 1;
    const color = a.color ?? (strength >= 1.4 ? 0x9ef0ff : 0xfff0a0);
    const at = def.hitPoint(kind);
    const dir = new THREE.Vector3(-def.facing, 0, 0);

    if (parried) {
      def.health = Math.max(1, def.health - dmg);
      fx.spark(at, 1, 0x60a0ff);
      sfx.parry();
      def.play('block', { rate: 1.6 });
      cam.shake(0.1);
      hitstop(0.05);
      this.events.push({ t: T.now, at, dir, strength: 1, color: 0x60a0ff, parried: true });
      return;
    }

    let hp = def.health - dmg;
    if (a.rush && hp < 1) hp = 1; // rush hits never finish – the finisher does
    def.health = Math.max(0, hp);
    const ko = def.health <= 0;
    def.hurt();

    fx.spark(at, ko ? 1.8 : strength, color);
    fx.blood(at, dir, ko && gore === 2 ? strength * 2.2 : strength);
    this.events.push({ t: T.now, at, dir, strength, color });
    if (gore) {
      def.setDamage(def.health < 25 ? 3 : def.health < 50 ? 2 : def.health < 80 ? 1 : 0);
      def.stain(kind === 'mid' ? 'mid' : 'high', gore === 2 ? 6 : 2);
      if (gore === 2) def.stain(kind === 'mid' ? 'high' : 'mid', 3);
      att.bloodyGear(gore === 2 ? 0.1 : 0.04);
      if (gore === 2 && kind !== 'mid' && (kind === 'launch' || Math.random() < 0.3)) fx.teeth(at, dir, kind === 'launch' ? 3 : 1 + Math.floor(Math.random() * 2));
      const bone = kind === 'mid' || kind === 'launch' || strength >= 1.3;
      sfx.gore(gore, { strength, bone, rip: a.finisher || strength >= 1.4 });
      if (gore === 2 && (def === this.p1 || strength >= 1.4)) screenSplatter(Math.round(2 + strength * 2));
    }
    if (def === this.p1 && !this.attract) hud.hurt(strength);
    sfx.hit(Math.min(1.6, strength));
    if (last || Math.random() < 0.5) sfx.kiai(att.def.voice, a.move.startsWith('rush') ? 'jab' : a.move);

    // screen punch
    cam.shake(0.06 + 0.12 * strength);
    cam.punch(1.5 + strength * 2.5);
    if (strength >= 1.3) cam.roll((Math.random() - 0.5) * 0.12);
    post.pulse({ aberr: 0.25 * strength, zoom: strength >= 1.4 ? 0.25 : 0, center: projectUV(at) });
    if (strength >= 1.3) G.stage?.flash(0.3 * strength);
    if (strength >= 1.4 && !a.rush && this.phase === 'fight' && Math.random() < 0.4) {
      cam.back = this.attract ? 'fight-attract' : 'fight';
      cam.set('impact', { target: def });
    }
    hitstop(0.035 + 0.03 * strength);

    // score
    if (att === this.p1 && !this.attract) {
      const pts = a.pts ?? Math.round(dmg * 60);
      G.run.score += pts;
      const p = G.project(at);
      hud.popup(`+${pts.toLocaleString()}`, p.x + (Math.random() - 0.5) * 60, p.y, 'score');
    }
    if (this.attract) this.meter[att === this.p1 ? 0 : 1] = Math.min(100, this.meter[att === this.p1 ? 0 : 1] + 12);

    if (ko) { this.ko(att, def, a, kind); return; }

    const juggling = def.airborne || def.animName === 'launch' || def.animName === 'juggle';
    if (juggling && !a.rush) {
      def.play('juggle');
      if (att === this.p1 && !this.attract) hud.sub('AIR COMBO!', 'cyan');
    } else if (kind === 'launch') {
      def.play('launch');
      fx.shockwave(def.root.position.x, 0, 1);
    } else if (a.rush) {
      def.play(kind === 'mid' ? 'hitMid' : 'hitHigh', { rate: 1.8 });
    } else if (strength >= 1.3) {
      def.play('hitHeavy');
    } else {
      def.play(kind === 'mid' ? 'hitMid' : 'hitHigh');
    }
    if (!a.rush && (last || Math.random() < 0.4)) sfx.grunt(def.def.voice);
  }

  ko(att, def, a, kind = 'high') {
    this.phase = 'ko';
    this.koTime = T.now;
    this.q = null;
    hud.combo(0);
    hud.hideQuestion();
    hud.superButton(false);
    hud.rush(false);
    const { fx, cam, post } = G;
    post.pulse({ invert: 3, flash: 0.55, zoom: 0.8, aberr: 1.2, center: projectUV(def.chest()) });
    slowmo(0.25, 0.6);
    if (a.finisher) fx.explosion(def.chest(), def.def.aura ?? 0xff7a20);
    fx.shockwave(def.root.position.x, 0, 2.2, 0xffd23f);
    G.stage?.flash(0.5);
    sfx.ko();
    sfx.impact(1.5);
    cam.set('ko', { target: def, cut: true });
    cam.shake(0.5);
    hud.banner('K.O.', 'huge fire', 1500);
    say('K.O.!', { rate: 0.8 });
    const variant = pickDeath({ finisher: !!a.finisher, kind, gore: G.settings.gore });
    this.deathVariant = variant;
    const deathDur = this.death.start(variant, att, def);
    this.endRound?.({ winner: att, loser: def, deathDur });
  }

  // ------------------------------------------------------------ supers
  async playerSuper() {
    const { p1, p2 } = this;
    this.phase = 'cinematic';
    this.superRequested = false;
    this.meter[0] = 0;
    this.q = null;
    hud.hideQuestion();
    hud.superButton(false);
    await this.superIntro(p1, false);
    if (this.phase === 'ko') return;

    // RUSH: answer as many as possible in 6 seconds
    this.phase = 'rush';
    this.rushHits = 0;
    this.rushEnd = T.real + 6;
    this.rushLen = 6;
    G.cam.set('rush', { cut: true });
    hud.rush(true, 1);
    hud.banner('RUSH!', 'cyan', 500);
    this.spawnQuestion('rush');
    await this.wait((r) => { this.rushDone = r; });
    hud.rush(false);
    hud.hideQuestion();
    this.q = null;

    // finisher
    this.phase = 'cinematic';
    G.cam.set('super', { target: p1, cut: true, side: -1 });
    G.post.pulse({ zoom: 0.6, aberr: 1 });
    const dmg = 10 + this.rushHits * 3;
    const pts = 5000 + this.rushHits * 1000;
    await this.attackNow({ att: p1, def: p2, move: 'spinKick', dmg, strength: 2.2, color: p1.def.aura, finisher: true, pts, rate: 1.1 });
    p1.setAura(0);
    if (this.phase !== 'ko') {
      G.post.pulse({ invert: 2, flash: 0.6 });
      hud.sub(`${this.rushHits}-HIT SUPER!`, 'cyan');
      await sleep(0.5);
      this.phase = 'fight';
      G.cam.set('fight');
      this.nextQuestion(0.2);
    }
  }

  onRushAnswer(correct) {
    const { p1, p2 } = this;
    if (correct) {
      this.rushHits++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      G.run.maxCombo = Math.max(G.run.maxCombo, this.combo);
      hud.combo(this.combo);
      sfx.combo(this.combo);
      const move = RUSH_MOVES[(this.rushHits - 1) % RUSH_MOVES.length];
      this.attackNow({ att: p1, def: p2, move, dmg: 2.5, strength: 1.2, rush: true, color: p1.def.aura, pts: 300 * this.rushHits, rate: 1.2 });
      G.fx.ghost(p1, p1.def.aura);
    } else {
      sfx.wrong();
      G.cam.shake(0.1);
    }
    setTimeout(() => { if (this.phase === 'rush' && T.real < this.rushEnd) this.spawnQuestion('rush'); }, correct ? 60 : 500);
  }

  async cpuSuper() {
    const { p1, p2 } = this;
    this.phase = 'cinematic';
    this.cpuSuperRequested = false;
    this.meter[1] = 0;
    this.q = null;
    hud.hideQuestion();
    await this.superIntro(p2, true);

    // Parry challenge
    let parried = false;
    if (!this.attract) {
      this.phase = 'parry';
      G.post.setDim(0.4);
      hud.banner('PARRY IT!', 'cyan small', 700);
      this.spawnQuestion('parry');
      parried = await this.wait((r) => { this.parryDone = r; });
      G.post.setDim(0);
      hud.hideQuestion();
      this.q = null;
      this.phase = 'cinematic';
      if (parried) {
        hud.sub('PARRY!', 'cyan');
        say('Parry!');
        G.run.score += 3000;
      }
    }

    G.cam.set('rush', { cut: true, side: -1 });
    const dmg = this.diff.cpuDmg * (this.boss ? 1.2 : 1);
    for (const move of RUSH_MOVES) {
      await this.attackNow({ att: p2, def: p1, move, dmg: parried ? 0.3 : dmg * 0.18, strength: 1.2, rush: true, parried, color: p2.def.aura, rate: 1.2 });
      G.fx.ghost(p2, p2.def.aura);
    }
    G.cam.set('super', { target: p2, cut: true });
    await this.attackNow({ att: p2, def: p1, move: 'spinKick', dmg: parried ? 1 : dmg * 1.1, strength: 2.2, parried, finisher: true, color: p2.def.aura, rate: 1.1 });
    p2.setAura(0);
    if (this.phase !== 'ko') {
      if (!parried) G.post.pulse({ invert: 2, flash: 0.5, flashColor: 0xff2020 });
      await sleep(0.4);
      this.phase = 'fight';
      G.cam.set(this.attract ? 'fight-attract' : 'fight');
      this.nextQuestion(0.3);
    }
  }

  onParryAnswer(correct) {
    if (correct) sfx.parry(); else sfx.wrong();
    const done = this.parryDone;
    this.parryDone = null;
    setTimeout(() => done?.(correct), correct ? 150 : 600);
  }

  async superIntro(f, right) {
    const face = G.portraits[f.def.id].face;
    G.cam.set('super', { target: f, cut: true, side: right ? -1 : 1 });
    G.post.setDim(0.75);
    hud.letterbox(true);
    f.play('charge');
    f.setAura(2);
    sfx.superCharge();
    hud.cutIn(f.def, face, right);
    say(f.def.special, { rate: 1.1, pitch: 0.5 });
    G.post.pulse({ zoom: 0.5, aberr: 0.8 });
    for (let i = 0; i < 6; i++) G.fx.aura(f.chest(), f.def.aura, 4);
    await sleepReal(1.05);
    G.post.setDim(0);
    hud.letterbox(false);
    G.post.pulse({ flash: 0.6, flashColor: f.def.aura });
    G.fx.shockwave(f.root.position.x, 0, 1.5, f.def.aura);
  }

  async demoSuper(att, def) {
    this.phase = 'cinematic';
    this.meter[att === this.p1 ? 0 : 1] = 0;
    await this.superIntro(att, att === this.p2);
    G.cam.set('rush', { cut: true });
    for (const move of RUSH_MOVES) {
      await this.attackNow({ att, def, move, dmg: 2.5, strength: 1.2, rush: true, color: att.def.aura, rate: 1.2 });
      G.fx.ghost(att, att.def.aura);
    }
    G.cam.set('super', { target: att, cut: true, side: -1 });
    await this.attackNow({ att, def, move: 'spinKick', dmg: 18, strength: 2.2, finisher: true, color: att.def.aura, rate: 1.1 });
    att.setAura(0);
    if (this.phase !== 'ko') {
      await sleep(0.4);
      this.phase = 'fight';
      G.cam.set('fight-attract');
    }
  }

  // ------------------------------------------------------------ replay
  async replay(deathDur = 1.5) {
    const from = this.koTime - 1.1;
    const to = this.koTime + Math.min(deathDur, 2.8);
    const frames = this.frames.filter((f) => f.t >= from && f.t <= to);
    if (frames.length < 10) return;
    const { p1, p2 } = this;
    const saved = [p1.anim, p2.anim];
    p1.anim = null;
    p2.anim = null;
    p1.restoreParts();
    p2.restoreParts();
    this.death.emitters = [];
    const loser = p1.health <= 0 ? p1 : p2;
    hud.letterbox(true);
    hud.replayTag(true);
    G.cam.set('replay', { target: loser, cut: true });
    G.fx.clearDecals();
    await this.wait((done) => {
      this.replaying = { frames, i: 0, t: from, to, events: this.events.filter((e) => e.t >= from && e.t <= to), ei: 0, done };
    });
    this.replaying = null;
    this.death.emitters = [];
    for (const g of this.death.gibs) g.rest = true;
    p1.anim = saved[0];
    p2.anim = saved[1];
    const last = frames[frames.length - 1];
    p1.cur.set(last.a);
    p2.cur.set(last.b);
    hud.letterbox(false);
    hud.replayTag(false);
  }

  skipReplay() {
    if (this.replaying) this.replaying.t = this.replaying.to;
  }

  updateReplay(rdt) {
    const r = this.replaying;
    // slow build-up, then (almost) real time for the finisher
    const speed = r.t < this.koTime ? 0.45 : 0.85;
    r.t += rdt * speed;
    while (r.i < r.frames.length - 1 && r.frames[r.i + 1].t <= r.t) r.i++;
    const f = r.frames[r.i];
    const { p1, p2 } = this;
    const fighters = [p1, p2];
    if (f.parts) {
      for (const [idx, name, pos, quat] of f.parts) {
        const ft = fighters[idx];
        const obj = ft.detach(name, G.scene);
        obj.position.copy(pos);
        obj.quaternion.copy(quat);
      }
    }
    p1.cur.set(f.a); p1.time = f.ta; p1.flash = f.fa; p1.apply(p1.cur);
    p2.cur.set(f.b); p2.time = f.tb; p2.flash = f.fb; p2.apply(p2.cur);
    while (r.ei < r.events.length && r.events[r.ei].t <= r.t) {
      const e = r.events[r.ei++];
      if (e.type) { this.death.replayEvent(e); continue; }
      G.fx.spark(e.at, e.strength, e.color);
      if (!e.parried) G.fx.blood(e.at, e.dir, e.strength);
      sfx.hit(e.strength);
      G.cam.shake(0.1 * e.strength);
    }
    this.death.update(rdt * speed, false);
    if (r.t >= r.to) r.done();
  }

  // ------------------------------------------------------------ per frame
  update(dt, rdt) {
    this.frame++;
    if (this.replaying) { this.updateReplay(rdt); return; }
    const { p1, p2 } = this;
    p1.update(dt);
    p2.update(dt);
    this.death.update(dt, true);
    const ph = this.phase;

    if (ph === 'fight' || ph === 'ko' || ph === 'rush' || ph === 'cinematic' || ph === 'parry') {
      this.frames.push({ t: T.now, a: p1.cur.slice(), b: p2.cur.slice(), ta: p1.time, tb: p2.time, fa: p1.flash, fb: p2.flash, parts: this.death.snapshot(p1, p2) });
      while (this.frames.length && this.frames[0].t < T.now - 7) this.frames.shift();
    }

    // auras + drips
    for (const [i, f] of [[0, p1], [1, p2]]) {
      if (f.auraLevel < 2) f.setAura(this.meter[i] >= 100 ? 1 : 0);
      if (f.auraLevel > 0 && this.frame % 2 === 0) G.fx.aura(f.chest(), f.def.aura, f.auraLevel);
      if (G.settings.gore === 2 && f.damageLevel >= 2 && dt > 0 && Math.random() < dt * f.damageLevel * 2.5) {
        const h = f.head.getWorldPosition(new THREE.Vector3());
        h.y -= 0.1;
        G.fx.drip(h);
      }
    }
    if (this.acting && this.frame % 3 === 0 && (HEAVY.includes(this.actionMove) || this.actionMove === 'uppercut')) {
      const att = this.queueAttacker;
      if (att) G.fx.ghost(att, att.def.aura);
    }

    hud.setMeters(this.meter[0], this.meter[1]);
    hud.superButton(!this.attract && ph === 'fight' && this.meter[0] >= 100);

    if (ph === 'fight') this.updateFight(dt);
    else if (ph === 'rush') {
      const left = this.rushEnd - T.real;
      hud.rush(true, left / this.rushLen);
      if (this.q) hud.fuse(1 - left / this.rushLen, 0, true);
      if (left <= 0 && !this.acting) {
        this.phase = 'cinematic';
        this.rushDone?.();
      }
    } else if (ph === 'parry' && this.q) {
      const el = T.real - this.q.startReal;
      const u = Math.min(1, el / this.q.cpuTime);
      hud.fuse(u, el);
      if (u >= 1 && !this.q.locked) {
        this.q.locked = true;
        G.run.log.push({ q: this.q.q, kind: 'timeout', time: this.q.cpuTime, given: null, mode: 'parry' });
        G.run.gen.report(this.q.q, false);
        hud.result(this.q.q, '', false);
        this.onParryAnswer(false);
      }
    }

    // danger: heartbeat + faster music + red pulse
    const danger = (ph === 'fight' || ph === 'rush' || ph === 'parry') && !this.attract && (p1.health <= 25 || p2.health <= 25);
    G.post.setDanger(danger && p1.health <= 25 ? 0.8 : 0);
    music.setTempoScale(danger ? 1.12 : 1);
    if (danger && p1.health <= 25 && T.real - this.lastBeat > 0.85) { this.lastBeat = T.real; sfx.heartbeat(); }
  }

  updateFight(dt) {
    const { p1, p2 } = this;
    // round clock
    this.time -= dt;
    hud.setTimer(this.time);
    const secs = Math.ceil(this.time);
    if (!this.attract && secs <= 10 && secs < this.lastTick && secs > 0) { this.lastTick = secs; sfx.tick(); }
    if (this.time <= 0) {
      this.time = 0;
      this.phase = 'timeover';
      this.q = null;
      hud.hideQuestion();
      const d = p1.health - p2.health;
      if (Math.abs(d) < 0.5) this.endRound?.({ timeover: true, draw: true });
      else this.endRound?.({ timeover: true, winner: d > 0 ? p1 : p2, loser: d > 0 ? p2 : p1 });
      return;
    }

    // supers wait for the current attack to finish
    if (!this.acting) {
      if (this.superRequested) { this.playerSuper().catch(swallow); return; }
      if (this.cpuSuperRequested) { this.cpuSuper().catch(swallow); return; }
    }

    // attack queue
    if (!this.acting && this.queue.length) {
      const a = this.queue.shift();
      this.queueAttacker = a.att;
      this.startAction(a);
    }

    if (this.attract) { this.updateDemo(); return; }

    // questions
    if (!this.q && T.now >= this.qAt) this.spawnQuestion('normal');
    const q = this.q;
    if (q && !q.locked) {
      const el = T.now - q.start;
      const u = Math.min(1, el / q.cpuTime);
      hud.fuse(u, el);
      if (u >= 1) {
        q.locked = true;
        this.onWrong(q, true);
      }
    }
  }

  updateDemo() {
    if (this.acting || this.queue.length || T.now < this.demoNext) return;
    const { p1, p2 } = this;
    const aFirst = Math.random() < 0.5;
    const att = aFirst ? p1 : p2;
    const def = aFirst ? p2 : p1;
    const mi = att === p1 ? 0 : 1;
    if (this.meter[mi] >= 100) { this.demoSuper(att, def).catch(swallow); return; }
    const move = Math.random() < 0.15 ? 'uppercut' : pick([...CPU_MOVES, 'jab', 'cross']);
    this.queue.push({ att, def, move, dmg: rand(7, 13), strength: HEAVY.includes(move) ? 1.4 : 1, rate: 1.4 });
    this.demoNext = T.now + rand(0.35, 1.0);
  }
}

function swallow(e) { if (!(e instanceof Abort)) throw e; }

function $tag(text) {
  const el = document.querySelector('#qtag');
  if (el) el.textContent = text;
}

function projectUV(v) {
  const p = v.clone().project(G.camera);
  return new THREE.Vector2((p.x + 1) / 2, (p.y + 1) / 2);
}
