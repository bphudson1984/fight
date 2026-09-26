// Question generation + difficulty settings.

export const DIFFICULTIES = {
  rookie: {
    name: 'Rookie', cpu: [8, 11], cpuDmg: 10,
    desc: 'CPU answers in about 8–11 seconds. Plenty of thinking time.',
  },
  fighter: {
    name: 'Fighter', cpu: [5.5, 7], cpuDmg: 13,
    desc: 'CPU answers in about 6 seconds – the same pace as the Year 4 multiplication check.',
  },
  champion: {
    name: 'Champion', cpu: [3.8, 4.8], cpuDmg: 16,
    desc: 'CPU answers in about 4 seconds. You need to know them well!',
  },
  legend: {
    name: 'Legend', cpu: [2.3, 3], cpuDmg: 20,
    desc: 'CPU answers in under 3 seconds. Instant recall only!',
  },
};

export const QUESTION_TYPES = {
  mul: { label: '7 × 8 = ?', name: 'Multiply' },
  missing: { label: '7 × ? = 56', name: 'Missing number' },
  div: { label: '56 ÷ 7 = ?', name: 'Divide' },
};

export const SLOT = '__slot__';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class QuestionGen {
  constructor({ tables, maxFactor, types }) {
    this.types = types.length ? types : ['mul'];
    this.facts = [];
    for (const t of tables) {
      for (let m = 1; m <= maxFactor; m++) this.facts.push({ t, m });
    }
    this.recent = [];
    this.review = [];
    this.missCount = new Map();
    this.count = 0;
  }

  next() {
    this.count++;
    let fact;
    const due = this.review.findIndex((r) => r.due <= this.count);
    if (due >= 0) {
      fact = this.review.splice(due, 1)[0].fact;
    } else {
      const avoid = Math.min(4, this.facts.length - 1);
      const recent = new Set(this.recent.slice(-avoid));
      const weighted = this.facts.map((f) => {
        const k = key(f);
        if (recent.has(k)) return 0;
        let w = f.m === 1 ? 0.3 : 1; // ×1 is too easy to see often
        w += (this.missCount.get(k) || 0) * 2;
        return w;
      });
      const total = weighted.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      fact = this.facts[this.facts.length - 1];
      for (let i = 0; i < this.facts.length; i++) {
        r -= weighted[i];
        if (r <= 0) { fact = this.facts[i]; break; }
      }
    }
    this.recent.push(key(fact));
    return build(fact, pick(this.types));
  }

  report(q, correct) {
    if (correct) return;
    const k = key(q.fact);
    this.missCount.set(k, (this.missCount.get(k) || 0) + 1);
    // Bring a missed fact back a few questions later.
    this.review.push({ fact: q.fact, due: this.count + 3 + Math.floor(Math.random() * 2) });
  }
}

function key(f) { return `${f.t}x${f.m}`; }

function build(fact, type) {
  const { t, m } = fact;
  const p = t * m;
  let parts, answer;
  if (type === 'div') {
    parts = [p, '÷', t, '=', SLOT];
    answer = m;
  } else if (type === 'missing') {
    parts = Math.random() < 0.5 ? [t, '×', SLOT, '=', p] : [SLOT, '×', t, '=', p];
    answer = m;
  } else {
    parts = Math.random() < 0.5 ? [t, '×', m, '=', SLOT] : [m, '×', t, '=', SLOT];
    answer = p;
  }
  const full = parts.map((x) => (x === SLOT ? answer : x)).join(' ');
  return { parts, answer, fact, table: t, type, full };
}
