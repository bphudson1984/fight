import * as THREE from 'three';
// Fonts are bundled (not Google Fonts) so the game works on offline school networks.
import '@fontsource/bangers/400.css';
import '@fontsource/press-start-2p/400.css';
import '@fontsource/russo-one/400.css';
import './style.css';
import { SNAP } from './ps1.js';
import { Q, setQuality } from './quality.js';
import { HDStage } from './hdfx.js';
import { createStage, STAGES, STAGE_ORDER } from './stages.js';
import { Fighter, ROSTER, BOSS, makePortraits } from './fighter.js';
import { Effects } from './effects.js';
import { PostFX } from './postfx.js';
import { CameraDirector } from './camera.js';
import { QuestionGen, DIFFICULTIES, QUESTION_TYPES } from './maths.js';
import { sfx, say, setMuted, isMuted, unlockAudio } from './audio/sfx.js';
import { music } from './audio/music.js';
import { G } from './game/context.js';
import { T, tick, sleep, sleepReal, abortAll, Abort } from './game/time.js';
import { Fight } from './game/fight.js';
import { DEATH_DEBUG } from './game/death.js';
import { HUM_DEBUG } from './game/humiliation.js';
import { hud, $ } from './ui/hud.js';
import { qualifies, addScore, hiScore, renderScores } from './game/scores.js';
import { isUnlocked, unlockedCount, recordClear, unlockAll, tableResults, masteredTables } from './game/progress.js';
import { ALL_FIGHTERS, unlockBadge, unlockText } from './roster.js';

if (new URLSearchParams(location.search).has('unlockall')) unlockAll();

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

// ================================================================ settings

const SETTINGS_KEY = 'mathsfist.settings.v1';
const DEFAULTS = {
  fighter: 'kai', tables: [2, 5, 10], maxFactor: 12, types: ['mul'], difficulty: 'rookie', rounds: 2, gore: 2,
};
const settings = { ...DEFAULTS };
try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* ignore */ }
if ('blood' in settings) { if (settings.blood === false) settings.gore = 0; delete settings.blood; }
if (settings.rounds > 2) settings.rounds = 2;
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } };

// ================================================================ renderer / world

const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
document.body.classList.toggle('retro', !Q.hd);
document.body.classList.toggle('hd', Q.hd);
if (Q.hd) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 300);
const post = new PostFX(renderer, scene, camera, { samples: Q.hd ? 4 : 0 });
const hd = Q.hd ? new HDStage(renderer, scene) : null;
const cam = new CameraDirector(camera);
const fx = new Effects(scene);
fx.onSplat = () => sfx.plip();

// HD performance governor: steps quality down if the frame rate is too low.
const perf = { level: 0, start: 0, frames: 0, grace: 2 };
function governPerf() {
  if (!Q.hd || perf.level >= 3 || T.paused || document.hidden) { perf.start = 0; return; }
  const now = performance.now();
  if (!perf.start) { perf.start = now; perf.frames = 0; return; }
  perf.frames++;
  const secs = (now - perf.start) / 1000;
  if (secs < 2) return;
  const fps = perf.frames / secs;
  perf.start = now;
  perf.frames = 0;
  if (perf.grace > 0) { perf.grace--; return; }
  if (fps >= 40) return;
  perf.level++;
  perf.grace = 1;
  if (perf.level === 2 && hd) { hd.disableFloor = true; hd.disposeFloor(); }
  if (perf.level === 3) { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
  resize();
  console.info(`[perf] ${fps.toFixed(0)} fps – HD quality stepped down to level ${perf.level}`);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  let iw, ih;
  if (Q.hd) {
    // native resolution (capped so 4K screens stay smooth; lowered by the perf governor)
    let pr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * pr * pr > 3.7e6) pr = Math.sqrt(3.7e6 / (w * h));
    if (perf.level >= 1) pr = Math.min(pr, 1);
    if (perf.level >= 3) pr *= 0.7;
    iw = Math.round(w * pr);
    ih = Math.round(h * pr);
  } else {
    const scale = Math.max(1, h / 400);
    iw = Math.round(w / scale);
    ih = Math.round(h / scale);
  }
  renderer.setSize(iw, ih, false);
  post.setSize(iw, ih);
  hd?.setSize(iw, ih);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (Q.hd) SNAP.value.set(1e6, 1e6); // no PS1 vertex wobble in HD
  else SNAP.value.set(iw * 0.35, ih * 0.35);
}
window.addEventListener('resize', resize);
resize();

const portraits = makePortraits(ALL_FIGHTERS);
Object.assign(G, { scene, camera, cam, post, fx, settings, portraits, hd, renderer });

let stage = null;
function setStage(id) {
  if (stage?.id === id) return;
  hd?.disposeFloor();
  stage?.dispose();
  stage = createStage(id, scene);
  G.stage = stage;
  hd?.onStage(stage);
}

let p1 = null;
let p2 = null;
let preview = null;
function clearFighters() {
  for (const f of [p1, p2, preview]) f?.removeFrom(scene);
  p1 = p2 = preview = null;
}
function setFighters(defA, defB) {
  clearFighters();
  p1 = new Fighter(defA, -1);
  p2 = new Fighter(defB, 1, { mirror: true });
  for (const f of [p1, p2]) {
    f.addTo(scene);
    f.onLand = (ff) => {
      fx.dust(ff.root.position);
      fx.shockwave(ff.root.position.x, ff.root.position.z, 0.8, 0xc8a88a);
      cam.shake(0.18);
      sfx.hit(0.5);
    };
  }
  G.p1 = p1;
  G.p2 = p2;
}

let fight = null;
let mode = 'boot';

// ================================================================ screens

const SCREENS = ['title', 'options', 'select', 'vs', 'warning', 'continue', 'gameover', 'ending', 'unlock', 'names', 'results'];
function show(id, hudOn = false) {
  for (const s of SCREENS) $('#' + s).classList.toggle('hidden', s !== id);
  hud.show(hudOn);
}

const svg = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const sq = (x, y) => `<rect x="${x}" y="${y}" width="4" height="4" fill="currentColor" stroke="none"/>`;
const ICONS = {
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>'),
  muted: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3.2"/>'),
  keypad: svg([3, 10, 17].flatMap((y) => [3, 10, 17].map((x) => sq(x, y))).join('')),
};
$('#mute').innerHTML = ICONS.sound;
$('#pause-btn').innerHTML = ICONS.pause;
$('#keypad-toggle').innerHTML = ICONS.keypad;
$('#mute').addEventListener('click', (e) => {
  e.stopPropagation();
  unlockAudio();
  setMuted(!isMuted());
  $('#mute').innerHTML = isMuted() ? ICONS.muted : ICONS.sound;
});

// ================================================================ title / attract

let titlePanelTimer = null;
function cycleTitlePanels() {
  const panels = ['title-logo', 'title-scores', 'title-howto'];
  let i = 0;
  const showPanel = () => {
    panels.forEach((p, j) => $('#' + p).classList.toggle('hidden', j !== i));
    if (panels[i] === 'title-scores') renderScores($('#title-score-list'));
  };
  showPanel();
  clearInterval(titlePanelTimer);
  titlePanelTimer = setInterval(() => { i = (i + 1) % panels.length; showPanel(); }, 6000);
}

async function attract() {
  show('title');
  cycleTitlePanels();
  if (mode !== 'boot') { mode = 'title'; music.play('title'); }
  const pool = ALL_FIGHTERS;
  try {
    for (;;) {
      const [a, b] = shuffle(pool);
      setStage(pick(STAGE_ORDER));
      setFighters(a, b);
      G.run = { score: 0, log: [], maxCombo: 0, gen: new QuestionGen(settings) };
      fight = new Fight({ p1, p2, attract: true });
      G.fight = fight;
      await fight.run();
      await sleep(0.6);
    }
  } catch (e) {
    if (!(e instanceof Abort)) throw e;
  }
}

function insertCoin() {
  unlockAudio();
  sfx.coin();
  mode = 'title';
  $('#credit-count').textContent = 'CREDIT 01';
  document.querySelectorAll('#title .press').forEach((el) => { el.textContent = 'PRESS START'; });
  music.play('title');
}

function pressStart() {
  if (mode === 'boot') { insertCoin(); return; }
  if (mode !== 'title') return;
  sfx.confirm();
  stopEverything();
  clearInterval(titlePanelTimer);
  openOptions();
}

$('#title').addEventListener('click', pressStart);

function stopEverything() {
  abortAll();
  fight?.abort();
  fight = null;
  G.fight = null;
  T.paused = false;
  $('#pause').classList.add('hidden');
  hud.show(false);
}

// ================================================================ options

function openOptions() {
  mode = 'options';
  show('options');
  cam.set('attract');
  buildOptions();
}

function buildOptions() {
  const tables = $('#tables');
  tables.innerHTML = '';
  for (let t = 1; t <= 12; t++) {
    const b = document.createElement('button');
    b.textContent = t;
    b.className = settings.tables.includes(t) ? 'on' : '';
    b.onclick = () => {
      settings.tables = settings.tables.includes(t) ? settings.tables.filter((x) => x !== t) : [...settings.tables, t].sort((a, c) => a - c);
      sfx.cursor(); buildOptions();
    };
    tables.appendChild(b);
  }
  const types = $('#types');
  types.innerHTML = '';
  for (const [id, info] of Object.entries(QUESTION_TYPES)) {
    const b = document.createElement('button');
    b.innerHTML = `${info.name}<small>${info.label}</small>`;
    b.className = settings.types.includes(id) ? 'on' : '';
    b.onclick = () => {
      const on = settings.types.includes(id);
      if (on && settings.types.length === 1) return;
      settings.types = on ? settings.types.filter((x) => x !== id) : [...settings.types, id];
      sfx.cursor(); buildOptions();
    };
    types.appendChild(b);
  }
  const chips = (sel, key) => {
    for (const b of $(sel).children) {
      b.classList.toggle('on', +b.dataset.v === settings[key]);
      b.onclick = () => { settings[key] = +b.dataset.v; sfx.cursor(); buildOptions(); };
    }
  };
  chips('#maxfactor', 'maxFactor');
  chips('#rounds', 'rounds');
  chips('#gore', 'gore');
  for (const b of $('#quality').children) {
    b.classList.toggle('on', (b.dataset.v === 'hd') === Q.hd);
    b.onclick = () => {
      if ((b.dataset.v === 'hd') === Q.hd) return;
      setQuality(b.dataset.v);
      saveSettings();
      location.reload();
    };
  }
  const diffs = $('#difficulty');
  diffs.innerHTML = '';
  Object.entries(DIFFICULTIES).forEach(([id, d], i) => {
    const b = document.createElement('button');
    b.className = 'diff' + (settings.difficulty === id ? ' on' : '');
    b.innerHTML = `<span class="stars">${'★'.repeat(i + 1)}${'☆'.repeat(3 - i)}</span><span class="dname">${d.name}</span><span class="ddesc">${d.desc}</span>`;
    b.onclick = () => { settings.difficulty = id; sfx.cursor(); buildOptions(); };
    diffs.appendChild(b);
  });
  $('#setup-error').textContent = settings.tables.length ? '' : 'Pick at least one times table.';
  saveSettings();
}

document.querySelectorAll('.presets button').forEach((b) => {
  b.addEventListener('click', () => {
    const p = b.dataset.preset;
    settings.tables = p === 'all' ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : p === 'none' ? [] : p.split(',').map(Number);
    sfx.cursor(); buildOptions();
  });
});
$('#options-next').addEventListener('click', () => {
  if (!settings.tables.length) { sfx.wrong(); return; }
  sfx.confirm();
  startArcade().catch(swallow);
});
$('#options-back').addEventListener('click', () => { sfx.cursor(); toTitle(); });

// ================================================================ character select

let selectState = null;

function buildSelectGrid() {
  const grid = $('#select-grid');
  grid.innerHTML = '';
  ALL_FIGHTERS.forEach((def, i) => {
    const locked = !isUnlocked(def);
    const b = document.createElement('button');
    b.className = 'sel-tile' + (i === selectState.i ? ' on' : '') + (locked ? ' locked' : '') + (def.unlock.type === 'top' ? ' secret' : '');
    b.innerHTML = `<img src="${portraits[def.id].body}" alt=""><div class="tbadge">${unlockBadge(def)}</div><div class="tname">${locked ? '???' : def.name}</div>`;
    b.onclick = () => {
      if (selectState.i === i) confirmSelect();
      else { selectState.i = i; onSelectMove(); }
    };
    grid.appendChild(b);
  });
}

function onSelectMove() {
  const def = ALL_FIGHTERS[selectState.i];
  const locked = !isUnlocked(def);
  sfx.cursor();
  buildSelectGrid();
  $('#sel-count').textContent = `${unlockedCount()}/${ALL_FIGHTERS.length} UNLOCKED`;
  $('#sel-lock').classList.toggle('hidden', !locked);
  $('#sel-lock').innerHTML = locked ? `LOCKED<br><span>${unlockText(def)}</span>` : '';
  const name = $('#sel-name');
  name.textContent = def.name;
  name.style.setProperty('--sel-color', def.color);
  name.style.animation = 'none';
  void name.offsetWidth;
  name.style.animation = '';
  $('#sel-style').textContent = def.style.toUpperCase();
  $('#sel-special').textContent = def.special;
  $('#sel-stats').innerHTML = ['POWER', 'SPEED', 'TECH'].map((k, j) =>
    `<span>${k}</span><span class="pips">${[0, 1, 2, 3, 4].map((p) => `<span class="pip${p < def.stats[j] ? ' on' : ''}"></span>`).join('')}</span>`).join('');
  preview?.removeFrom(scene);
  preview = new Fighter(def, -1);
  preview.homeX = 0;
  preview.baseRotY = 0.55;
  if (locked) preview.silhouette();
  preview.addTo(scene);
  preview.play('taunt');
}

function selectFighter() {
  return new Promise((resolve) => {
    mode = 'select';
    show('select');
    clearFighters();
    setStage('cyber');
    music.play('select');
    cam.previewX = 0;
    cam.set('select', { cut: true });
    let i = ALL_FIGHTERS.findIndex((d) => d.id === settings.fighter);
    if (i < 0 || !isUnlocked(ALL_FIGHTERS[i])) i = 0;
    selectState = { i, resolve, time: 20, done: false };
    onSelectMove();
  });
}

function moveSelect(d) {
  const n = ALL_FIGHTERS.length;
  selectState.i = (selectState.i + d + n) % n;
  onSelectMove();
}

async function confirmSelect() {
  if (!selectState || selectState.done) return;
  let def = ALL_FIGHTERS[selectState.i];
  if (!isUnlocked(def)) {
    if (selectState.time > 0) { sfx.wrong(); cam.shake(0.15); return; }
    // timer ran out on a locked fighter: pick the first unlocked one
    selectState.i = ALL_FIGHTERS.findIndex(isUnlocked);
    onSelectMove();
    def = ALL_FIGHTERS[selectState.i];
  }
  selectState.done = true;
  settings.fighter = def.id;
  saveSettings();
  sfx.confirm();
  sfx.slam();
  say(def.name, { rate: 1, pitch: 0.5 });
  post.pulse({ flash: 0.8, flashColor: def.aura, aberr: 0.8, zoom: 0.4 });
  preview.play('victory');
  preview.setAura(1.5);
  for (let k = 0; k < 8; k++) fx.aura(preview.chest(), def.aura, 4);
  await sleepReal(1.0);
  selectState.resolve(def);
}

// ================================================================ VS / warning

let skipper = null;
function skippable(seconds) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; skipper = null; resolve(); } };
    skipper = finish;
    sleepReal(seconds).then(finish, finish);
  });
}

async function vsScreen(a, b, stageId, n, boss) {
  mode = 'vs';
  show('vs');
  $('#vs-p1').src = portraits[a.id].body;
  $('#vs-p2').src = portraits[b.id].body;
  $('#vs-p1-name').textContent = a.name;
  $('#vs-p2-name').textContent = b.name;
  $('#vs-stage').textContent = `STAGE ${n}: ${STAGES[stageId].name}`;
  $('#vs-round').textContent = boss ? 'FINAL BATTLE' : `BATTLE ${n}`;
  sfx.whooshBig();
  setTimeout(() => { sfx.slam(); sfx.impact(0.8); }, 280);
  say(`${a.name}, versus, ${b.name}`, { rate: 1.1 });
  await skippable(2.0);
}

async function warningScreen() {
  mode = 'vs';
  show('warning');
  music.jingle('warning');
  say('Warning! A new challenger approaches!', { rate: 1.05 });
  await skippable(3.2);
}

// ================================================================ arcade ladder

async function startArcade() {
  stopEverything();
  const token = T.token;
  const me = await selectFighter();
  if (token !== T.token) return;
  G.run = { score: 0, log: [], maxCombo: 0, continues: 0, gen: new QuestionGen(settings), stageReached: 1, won: false, fighter: me };
  hud.resetScore(0);
  const opps = shuffle(ROSTER.filter((d) => d.id !== me.id)).slice(0, 3);
  opps.push(BOSS);
  G.run.unlocked = [];
  G.run.newTables = [];
  const speed = [1, 0.92, 0.85, 0.8];
  let won = false;

  for (let i = 0; i < opps.length; i++) {
    const stageId = STAGE_ORDER[i];
    const boss = i === opps.length - 1;
    if (boss) await warningScreen();
    await vsScreen(me, opps[i], stageId, i + 1, boss);
    if (token !== T.token) return;
    setStage(stageId);
    setFighters(me, opps[i]);
    hud.setFighters(me, opps[i], portraits);
    mode = 'fight';
    show(null, true);
    music.play(STAGES[stageId].music);
    fight = new Fight({ p1, p2, cpuScale: speed[i], boss });
    G.fight = fight;
    const w = await fight.run();
    if (token !== T.token) return;
    fight = null;
    G.run.stageReached = i + 1;
    if (w) {
      music.jingle('victory');
      await sleepReal(2.0);
      if (boss) won = true;
    } else {
      music.jingle('lose');
      await sleepReal(2.2);
      const again = await continueScreen(me);
      if (token !== T.token) return;
      if (again) { G.run.continues++; i--; continue; }
      await gameOver();
      break;
    }
  }
  if (token !== T.token) return;
  G.run.won = won;
  if (won) await ending();
  await nameEntry();
  if (token !== T.token) return;
  showResults();
}

async function continueScreen(me) {
  mode = 'continue';
  show('continue');
  music.play('continue');
  $('#cont-face').src = portraits[me.id].face;
  say('Continue?');
  return new Promise((resolve) => {
    let n = 9;
    let done = false;
    const count = $('#cont-count');
    const finish = (v) => {
      if (done) return;
      done = true;
      clearInterval(timer);
      skipper = null;
      if (v) { sfx.confirm(); say('Here we go!'); }
      resolve(v);
    };
    count.textContent = n;
    const timer = setInterval(() => {
      if (T.paused) return;
      n--;
      count.textContent = Math.max(0, n);
      count.classList.remove('tick');
      void count.offsetWidth;
      count.classList.add('tick');
      sfx.bigTick();
      if (n <= 0) finish(false);
    }, 1000);
    skipper = () => finish(true);
    $('#cont-yes').onclick = () => finish(true);
  });
}

async function gameOver() {
  mode = 'vs';
  show('gameover');
  music.jingle('gameover');
  say('Game over');
  await skippable(3.5);
}

async function ending() {
  mode = 'vs';
  show('ending');
  music.play('ending');
  const { unlocked, newTables } = recordClear({ difficulty: settings.difficulty, tables: settings.tables, log: G.run.log });
  G.run.unlocked = unlocked;
  G.run.newTables = newTables;
  $('#ending-unlock').textContent = newTables.length
    ? `TABLES MASTERED: ${newTables.map((t) => '×' + t).join(' ')}`
    : `CONTINUES USED: ${G.run.continues}`;
  say('Congratulations! You are the champion!');
  if (p1) { cam.set('victory', { target: p1, cut: true }); p1.play('victory3'); }
  await skippable(5);
  for (const def of unlocked) await unlockReveal(def);
}

async function unlockReveal(def) {
  mode = 'vs';
  show('unlock');
  $('#unlock-img').src = portraits[def.id].body;
  $('#unlock-name').textContent = def.name;
  $('#unlock-name').style.setProperty('--sel-color', def.color);
  $('#unlock-style').textContent = def.style.toUpperCase();
  $('#unlock-why').textContent = unlockText(def);
  $('#unlock').style.setProperty('--u-color', def.color);
  music.jingle('stageclear');
  sfx.confirm();
  sfx.impact(1);
  post.pulse({ flash: 1, flashColor: def.aura, aberr: 1, zoom: 0.5 });
  say(`New challenger! ${def.name}!`, { rate: 1.05 });
  await skippable(4);
}

// ================================================================ name entry

function nameEntry() {
  const score = G.run.score;
  if (!qualifies(score)) return Promise.resolve();
  mode = 'names';
  show('names');
  music.play('ending');
  $('#names-score').textContent = String(score).padStart(7, '0');
  const letters = ['A', 'A', 'A'];
  let pos = 0;
  return new Promise((resolve) => {
    let time = 20;
    let done = false;
    const render = () => {
      for (let i = 0; i < 3; i++) {
        const el = $('#ns' + i);
        el.textContent = i < pos || i === pos ? letters[i] : '_';
        el.classList.toggle('cur', i === pos);
      }
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      nameHandler = null;
      const entry = { name: letters.join(''), score, stage: G.run.won ? 'ALL' : `ST${G.run.stageReached}` };
      addScore(entry);
      G.run.entry = entry;
      sfx.confirm();
      resolve();
    };
    const type = (ch) => {
      if (ch === '<') { pos = Math.max(0, pos - 1); sfx.cursor(); render(); return; }
      if (ch === 'END') { finish(); return; }
      letters[pos] = ch;
      sfx.cursor();
      if (pos < 2) pos++; else { render(); finish(); return; }
      render();
    };
    const grid = $('#names-grid');
    grid.innerHTML = '';
    for (const ch of [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '.', '<', 'END']) {
      const b = document.createElement('button');
      b.textContent = ch === '<' ? '←' : ch;
      if (ch === 'END') b.className = 'wide';
      b.onclick = () => type(ch);
      grid.appendChild(b);
    }
    nameHandler = (k) => {
      if (/^[a-z]$/i.test(k)) type(k.toUpperCase());
      else if (k === 'Backspace') type('<');
      else if (k === 'Enter') finish();
    };
    const timer = setInterval(() => {
      time--;
      $('#names-timer').textContent = time;
      if (time <= 0) finish();
    }, 1000);
    render();
  });
}
let nameHandler = null;

// ================================================================ results

function showResults() {
  mode = 'results';
  show('results');
  if (!G.run.won) music.play('title');
  cam.set('attract');
  const log = G.run.log;
  const right = log.filter((l) => l.kind === 'correct');
  const acc = log.length ? Math.round((right.length / log.length) * 100) : 0;
  const avg = right.length ? right.reduce((a, l) => a + l.time, 0) / right.length : 0;
  const fastest = right.length ? Math.min(...right.map((l) => l.time)) : 0;
  $('#res-title').textContent = G.run.won ? 'CHAMPION!' : 'RESULTS';
  const stat = (v, k) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`;
  $('#res-stats').innerHTML = [
    stat(G.run.score.toLocaleString(), 'score'),
    stat(`${acc}%`, 'accuracy'),
    stat(`${right.length}/${log.length}`, 'correct'),
    stat(avg ? `${avg.toFixed(1)}s` : '–', 'average time'),
    stat(fastest ? `${fastest.toFixed(1)}s` : '–', 'fastest'),
    stat(G.run.maxCombo, 'best combo'),
  ].join('');
  const tbl = $('#res-tables');
  tbl.innerHTML = '';
  for (const t of settings.tables) {
    const rows = log.filter((l) => l.q.table === t);
    const ok = rows.filter((l) => l.kind === 'correct').length;
    const pct = rows.length ? ok / rows.length : null;
    const cls = pct === null ? '' : pct >= 0.9 ? 'great' : pct >= 0.6 ? 'ok' : 'poor';
    const star = masteredTables().includes(t) ? '<div class="mstar">★ MASTERED</div>' : '';
    tbl.insertAdjacentHTML('beforeend', `<div class="res-table ${cls}"><div class="t">×${t}</div><div class="s">${rows.length ? `${ok}/${rows.length}` : 'not asked'}</div>${star}</div>`);
  }
  const unl = G.run.unlocked || [];
  $('#res-unlocks-h').classList.toggle('hidden', !unl.length);
  $('#res-unlocks').innerHTML = unl.map((d) => `<div class="res-unlock"><img src="${portraits[d.id].head}" alt=""><span>${d.name}</span></div>`).join('');
  const locked = ALL_FIGHTERS.filter((d) => !isUnlocked(d));
  $('#res-next').textContent = locked.length
    ? `NEXT TO UNLOCK: ${locked[0].name} – ${unlockText(locked[0])}`
    : 'EVERY FIGHTER UNLOCKED – YOU ARE A TIMES TABLES LEGEND!';
  const missed = new Map();
  for (const l of log) if (l.kind !== 'correct') missed.set(l.q.full, (missed.get(l.q.full) || 0) + 1);
  $('#res-practise').innerHTML = missed.size
    ? [...missed.keys()].map((f) => `<span>${f}</span>`).join('')
    : '<span class="none">Nothing missed – amazing! Try a harder difficulty next time.</span>';
  renderScores($('#res-scores'), G.run.entry);
}

$('#res-again').addEventListener('click', () => { sfx.confirm(); startArcade().catch(swallow); });
$('#res-title-btn').addEventListener('click', () => { sfx.cursor(); toTitle(); });

function toTitle() {
  stopEverything();
  mode = 'title';
  attract();
}

// ================================================================ pause

function togglePause() {
  if (mode !== 'fight') return;
  T.paused = !T.paused;
  $('#pause').classList.toggle('hidden', !T.paused);
  if (window.speechSynthesis) T.paused ? speechSynthesis.pause() : speechSynthesis.resume();
}
$('#pause-btn').addEventListener('click', togglePause);
$('#resume-btn').addEventListener('click', togglePause);
$('#quit-btn').addEventListener('click', () => { toTitle(); });

// ================================================================ input

const keypad = $('#keypad');
for (const k of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '✓']) {
  const b = document.createElement('button');
  b.textContent = k;
  if (k === '✓') b.className = 'ok';
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!fight || T.paused) return;
    if (k === '⌫') fight.back(); else if (k === '✓') fight.submit(); else fight.digit(k);
  });
  keypad.appendChild(b);
}
if (matchMedia('(pointer: coarse)').matches) keypad.classList.remove('hidden');
$('#keypad-toggle').addEventListener('click', () => keypad.classList.toggle('hidden'));
$('#super-btn').addEventListener('pointerdown', (e) => { e.preventDefault(); fight?.superKey(); });
$('#hud').addEventListener('pointerdown', () => { if (fight?.replaying) fight.skipReplay(); });
document.addEventListener('pointerdown', () => { if (skipper && (mode === 'vs')) skipper(); });

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
  if (mode === 'boot' || mode === 'title') {
    if (k === 'Enter' || k === ' ' || mode === 'boot') pressStart();
    return;
  }
  if (mode === 'fight') {
    if (k === 'Escape' || k === 'p') { togglePause(); return; }
    if (T.paused || !fight) return;
    if (fight.replaying && (k === 'Enter' || k === ' ')) { fight.skipReplay(); return; }
    if (/^[0-9]$/.test(k)) fight.digit(k);
    else if (k === 'Backspace') fight.back();
    else if (k === 'Enter') fight.submit();
    else if (k === ' ') fight.superKey();
    return;
  }
  if (mode === 'select' && selectState && !selectState.done) {
    if (k === 'ArrowLeft' || k === 'ArrowUp') moveSelect(-1);
    else if (k === 'ArrowRight' || k === 'ArrowDown') moveSelect(1);
    else if (k === 'Enter' || k === ' ') confirmSelect();
    return;
  }
  if (mode === 'vs' || mode === 'continue') {
    if ((k === 'Enter' || k === ' ') && skipper) skipper();
    return;
  }
  if (mode === 'names') { nameHandler?.(k); return; }
  if (mode === 'results' && k === 'Enter') { startArcade().catch(swallow); }
});

function swallow(e) { if (!(e instanceof Abort)) throw e; }

// ================================================================ main loop

let last = performance.now();
let selectTick = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = Math.min(0.05, (now - last) / 1000);
  last = now;
  const { dt, rdt } = tick(raw);
  governPerf();

  if (fight) fight.update(dt, rdt);
  else { p1?.update(dt); p2?.update(dt); }
  if (preview) {
    preview.update(dt);
    if (preview.auraLevel > 0 && Math.random() < 0.5) fx.aura(preview.chest(), preview.def.aura, 1);
  }

  if (mode === 'select' && selectState && !selectState.done) {
    selectState.time -= rdt;
    const s = Math.max(0, Math.ceil(selectState.time));
    if (s !== selectTick) { selectTick = s; $('#select-timer').textContent = String(s).padStart(2, '0'); if (s <= 5 && s > 0) sfx.tick(); }
    if (selectState.time <= 0) confirmSelect();
  }

  fx.update(dt);
  stage?.update(dt, T.now);
  if (mode === 'fight' && p1 && p2) hud.update(rdt, p1.health, p2.health, G.run.score, hiScore());
  cam.update(rdt, dt, p1, p2, camera.aspect);
  post.render(rdt, T.real);
}

// ================================================================ boot

mode = 'boot';
document.querySelectorAll('#title .press').forEach((el) => { el.textContent = 'INSERT COIN'; });
$('#credit-count').textContent = 'CREDIT 00';
attract();
requestAnimationFrame(frame);

// Debug hook for automated testing
window.__game = {
  G, T, settings, DEATH_DEBUG, HUM_DEBUG,
  get fight() { return fight; },
  get mode() { return mode; },
  get p1() { return p1; },
  get p2() { return p2; },
  startArcade: () => startArcade().catch(swallow),
  setStage,
  pressStart,
  confirmSelect,
};
