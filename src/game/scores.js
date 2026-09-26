// Local high-score table + unlocks.
const KEY = 'mathsfist.scores.v1';
const UNLOCK = 'mathsfist.unlocks.v1';

const DEFAULT = [
  ['KAI', 150000], ['LUN', 120000], ['BRK', 100000], ['ZED', 80000], ['AAA', 60000],
  ['MTH', 50000], ['SUM', 40000], ['ADD', 30000], ['TEN', 20000], ['ONE', 10000],
].map(([name, score]) => ({ name, score, stage: '-' }));

export function loadScores() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (Array.isArray(s) && s.length) return s;
  } catch { /* ignore */ }
  return DEFAULT.slice();
}

export function qualifies(score) {
  const s = loadScores();
  return score > 0 && (s.length < 10 || score > s[s.length - 1].score);
}

export function addScore(entry) {
  const s = loadScores();
  s.push(entry);
  s.sort((a, b) => b.score - a.score);
  const top = s.slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch { /* ignore */ }
  return top;
}

export function hiScore() { return loadScores()[0]?.score ?? 0; }

export function renderScores(ol, highlight = null) {
  ol.innerHTML = loadScores().map((e) =>
    `<li${highlight && e.name === highlight.name && e.score === highlight.score ? ' style="color:#2ef2ff"' : ''}><span>${e.name}</span><span>${e.stage}</span><span class="sc">${String(e.score).padStart(7, '0')}</span></li>`,
  ).join('');
}

export function isUnlocked(id) {
  try { return (JSON.parse(localStorage.getItem(UNLOCK) || '[]')).includes(id); } catch { return false; }
}
export function unlock(id) {
  try {
    const u = JSON.parse(localStorage.getItem(UNLOCK) || '[]');
    if (!u.includes(id)) u.push(id);
    localStorage.setItem(UNLOCK, JSON.stringify(u));
  } catch { /* ignore */ }
}
