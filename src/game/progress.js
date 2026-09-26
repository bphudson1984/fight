// Unlock progress: mastered tables, cleared difficulties, the ultimate clear.
import { ALL_FIGHTERS } from '../roster.js';

const KEY = 'mathsfist.progress.v1';
const DIFF_ORDER = ['rookie', 'fighter', 'champion', 'legend'];

// Mastering a table: clear Arcade with it selected, with at least this many
// of its questions asked and this accuracy.
export const MASTERY_MIN_QUESTIONS = 5;
export const MASTERY_ACCURACY = 0.8;

function load() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* ignore */ }
  p.mastered ??= [];
  p.cleared ??= [];
  p.top ??= false;
  p.all ??= false;
  // older builds stored the OMEGA unlock separately
  try {
    if (JSON.parse(localStorage.getItem('mathsfist.unlocks.v1') || '[]').includes('omega') && !p.cleared.length) p.cleared.push('rookie');
  } catch { /* ignore */ }
  return p;
}

function save(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

let P = load();

export function isUnlocked(def) {
  if (P.all) return true;
  const u = def.unlock;
  switch (u.type) {
    case 'free': return true;
    case 'table': return u.tables.every((t) => P.mastered.includes(t));
    case 'diff': return P.cleared.includes(u.diff);
    case 'top': return P.top;
    case 'clear': return P.cleared.length > 0;
    default: return false;
  }
}

export function unlockedCount() {
  return ALL_FIGHTERS.filter(isUnlocked).length;
}

export function masteredTables() { return P.mastered.slice(); }

/** Per-table results for this run: { table: { asked, right, pct, mastered } } */
export function tableResults(log, tables) {
  const out = {};
  for (const t of tables) {
    const rows = log.filter((l) => l.q.table === t);
    const right = rows.filter((l) => l.kind === 'correct').length;
    const pct = rows.length ? right / rows.length : 0;
    out[t] = { asked: rows.length, right, pct, mastered: rows.length >= MASTERY_MIN_QUESTIONS && pct >= MASTERY_ACCURACY };
  }
  return out;
}

/**
 * Record a cleared Arcade run. Returns the fighters newly unlocked by it
 * and the tables newly mastered.
 */
export function recordClear({ difficulty, tables, log }) {
  const before = new Set(ALL_FIGHTERS.filter(isUnlocked).map((d) => d.id));
  const res = tableResults(log, tables);
  const newTables = [];
  for (const t of tables) {
    if (res[t].mastered && !P.mastered.includes(t)) { P.mastered.push(t); newTables.push(t); }
  }
  // clearing a difficulty also counts as clearing every easier one
  const di = DIFF_ORDER.indexOf(difficulty);
  for (let i = 0; i <= di; i++) if (!P.cleared.includes(DIFF_ORDER[i])) P.cleared.push(DIFF_ORDER[i]);
  if (difficulty === 'legend' && tables.length >= 12) P.top = true;
  save(P);
  const unlocked = ALL_FIGHTERS.filter((d) => isUnlocked(d) && !before.has(d.id));
  return { unlocked, newTables, results: res };
}

/** Teacher / testing helper: ?unlockall in the URL. */
export function unlockAll() {
  P.all = true;
  save(P);
}

export function resetProgress() {
  P = { mastered: [], cleared: [], top: false, all: false };
  save(P);
}
