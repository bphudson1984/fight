// DOM HUD: health bars, timer, score, combo counter, question panel, meters,
// banners, popups, super cut-ins, letterbox, tally.
import { SLOT } from '../maths.js';

export const $ = (s) => document.querySelector(s);

const COMBO_NAMES = [
  [30, 'MATHS GOD!!!!'], [25, 'UNSTOPPABLE!!!'], [20, 'INSANE!!'], [16, 'ULTRA!'],
  [13, 'MEGA!'], [10, 'HYPER!'], [7, 'SUPER!'], [5, 'GREAT!'], [3, 'NICE!'],
];
export function comboName(n) {
  for (const [k, name] of COMBO_NAMES) if (n >= k) return name;
  return '';
}

export const hud = {
  shown: [100, 100],
  trail: [100, 100],
  scoreShown: 0,

  show(on) { $('#hud').classList.toggle('hidden', !on); },

  setFighters(d1, d2, portraits) {
    $('#hud-p1-face').src = portraits[d1.id].head;
    $('#hud-p2-face').src = portraits[d2.id].head;
    $('#fuse-face').src = portraits[d2.id].head;
    $('#p1-name').textContent = d1.name;
    $('#p2-name').textContent = d2.name;
    this.shown = [100, 100];
    this.trail = [100, 100];
  },

  setWins(w1, w2, need) {
    const dots = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, need - n));
    $('#p1-wins').textContent = dots(w1);
    $('#p2-wins').textContent = dots(w2);
  },

  update(rdt, h1, h2, score, hi) {
    const hp = [h1, h2];
    for (let i = 0; i < 2; i++) {
      this.shown[i] += (hp[i] - this.shown[i]) * Math.min(1, rdt * 18);
      if (this.trail[i] > hp[i]) this.trail[i] = Math.max(hp[i], this.trail[i] - rdt * 40);
      else this.trail[i] = hp[i];
      const n = i === 0 ? 'p1' : 'p2';
      const fill = $(`#${n}-fill`);
      fill.style.transform = `scaleX(${Math.max(0, this.shown[i]) / 100})`;
      fill.classList.toggle('low', hp[i] <= 25);
      $(`#${n}-trail`).style.transform = `scaleX(${Math.max(0, this.trail[i]) / 100})`;
    }
    if (this.scoreShown !== score) {
      const d = score - this.scoreShown;
      this.scoreShown += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, rdt * 10)));
      if (Math.abs(score - this.scoreShown) < 2) this.scoreShown = score;
      $('#score').textContent = String(Math.round(this.scoreShown)).padStart(7, '0');
    }
    $('#hiscore').textContent = String(Math.max(hi, Math.round(this.scoreShown))).padStart(7, '0');
  },

  resetScore(v = 0) {
    this.scoreShown = v;
    $('#score').textContent = String(v).padStart(7, '0');
  },

  setTimer(t) {
    const el = $('#timer');
    const v = t === Infinity ? '∞' : String(Math.max(0, Math.ceil(t))).padStart(2, '0');
    if (el.textContent !== v) el.textContent = v;
    el.classList.toggle('low', t <= 10);
  },

  setMeters(m1, m2) {
    const a = $('#m1-fill');
    const b = $('#m2-fill');
    a.style.width = `${m1}%`;
    b.style.width = `${m2}%`;
    a.classList.toggle('full', m1 >= 100);
    b.classList.toggle('full', m2 >= 100);
  },

  superButton(on) { $('#super-btn').classList.toggle('hidden', !on); },

  combo(n) {
    const el = $('#combo');
    clearTimeout(this._comboT);
    if (n < 2) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    this._comboT = setTimeout(() => el.classList.add('hidden'), 2200);
    const num = $('#combo-n');
    num.textContent = n;
    num.classList.remove('bump');
    void num.offsetWidth;
    num.classList.add('bump');
    $('#combo-label').textContent = comboName(n);
  },

  // ------------------------------------------------------------ questions
  question(q, { mode = 'normal', tag = '' } = {}) {
    const p = $('#qpanel');
    p.classList.remove('hidden', 'good', 'bad', 'pop', 'rush', 'parry');
    void p.offsetWidth;
    p.classList.add('pop');
    if (mode !== 'normal') p.classList.add(mode);
    $('#qtag').textContent = tag;
    this.renderQ(q, '');
    this.fuse(0, 0);
  },

  renderQ(q, typed, state = '') {
    const html = q.parts.map((x) => {
      if (x === SLOT) {
        if (state === 'bad') {
          const wrong = typed ? `<span class="wrong">${typed}</span>` : '';
          return `${wrong}<span class="slot good">${q.answer}</span>`;
        }
        const cls = ['slot', typed ? '' : 'empty', state].join(' ');
        return `<span class="${cls}">${typed || '&nbsp;'}</span>`;
      }
      if (x === '×' || x === '÷' || x === '=') return `<span class="op">${x}</span>`;
      return `<span>${x}</span>`;
    }).join('');
    $('#qtext').innerHTML = html;
  },

  result(q, typed, good) {
    const p = $('#qpanel');
    p.classList.remove('pop');
    p.classList.add(good ? 'good' : 'bad');
    this.renderQ(q, typed, good ? 'good' : 'bad');
  },

  hideQuestion() { $('#qpanel').classList.add('hidden'); },

  fuse(u, elapsed, hideTime = false) {
    $('#fuse-fill').style.width = `${(u * 100).toFixed(1)}%`;
    $('#fuse-spark').style.left = `${(u * 100).toFixed(1)}%`;
    $('.fuse').classList.toggle('danger', u > 0.75);
    $('#qtime').textContent = hideTime ? '' : elapsed.toFixed(1);
  },

  // ------------------------------------------------------------ text
  banner(text, cls = '', ms = 1000) {
    const b = $('#banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.innerHTML = text;
    b.className = `banner show ${cls}`;
    clearTimeout(this._bt);
    if (ms) this._bt = setTimeout(() => { b.className = `banner out ${cls}`; }, ms);
  },
  clearBanner() { $('#banner').className = 'banner'; },

  sub(text, cls = '') {
    const b = $('#subbanner');
    b.className = 'subbanner';
    void b.offsetWidth;
    b.textContent = text;
    b.className = `subbanner show ${cls}`;
  },

  popup(text, x, y, cls = '') {
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    $('#popups').appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  },

  cutIn(def, face, right = false) {
    const c = $('#cutin');
    c.classList.add('hidden');
    void c.offsetWidth;
    c.classList.toggle('right', right);
    $('#cutin-img').src = face;
    $('#cutin-name').textContent = def.name;
    $('#cutin-move').textContent = def.special;
    c.style.setProperty('--cut-a', def.color || '#ff4a1a');
    c.classList.remove('hidden');
    clearTimeout(this._ct);
    this._ct = setTimeout(() => c.classList.add('hidden'), 1000);
  },

  letterbox(on) { $('#letterbox').classList.toggle('on', on); },
  replayTag(on) { $('#replay-tag').classList.toggle('hidden', !on); },

  rush(on, u = 1) {
    $('#rushbar').classList.toggle('hidden', !on);
    if (on) $('#rush-fill').style.width = `${Math.max(0, u) * 100}%`;
  },

  hurt(strength) {
    const el = $('#hurt');
    el.classList.remove('on');
    void el.offsetWidth;
    el.style.setProperty('--hurt', Math.min(1, 0.45 + 0.3 * strength));
    el.classList.add('on');
  },

  /** Animated score tally. rows: [{label, value}] – resolves when done. */
  async tally(rows, onTick) {
    const el = $('#tally');
    el.innerHTML = '';
    el.classList.remove('hidden');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let total = 0;
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${r.label}</span><b>0</b>`;
      el.appendChild(row);
      const b = row.querySelector('b');
      const steps = 14;
      for (let i = 1; i <= steps; i++) {
        b.textContent = Math.round((r.value * i) / steps).toLocaleString();
        onTick?.();
        await wait(15);
      }
      total += r.value;
      await wait(90);
    }
    const row = document.createElement('div');
    row.className = 'row total';
    row.innerHTML = `<span>TOTAL</span><b>${total.toLocaleString()}</b>`;
    el.appendChild(row);
    await wait(650);
    el.classList.add('hidden');
    return total;
  },

  splatterClear() { $('#splatter').innerHTML = ''; },
};

// Blood splattered on the "camera lens".
const splatterImgs = [0, 1, 2, 3].map(() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(140, 0, 8, 0.92)';
  const blob = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  blob(64, 64, 18 + Math.random() * 12);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 20 + Math.random() * 40;
    blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1 + Math.random() * 6);
  }
  for (let i = 0; i < 4; i++) {
    const x = 50 + Math.random() * 28;
    g.fillRect(x, 64, 3 + Math.random() * 3, 20 + Math.random() * 40);
    blob(x + 2.5, 64 + 30 + Math.random() * 30, 4);
  }
  return c.toDataURL();
});

export function screenSplatter(n) {
  const layer = $('#splatter');
  for (let i = 0; i < n; i++) {
    const img = document.createElement('img');
    img.src = splatterImgs[Math.floor(Math.random() * splatterImgs.length)];
    const size = 90 + Math.random() * 220;
    img.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 90}%;width:${size}px;height:${size}px;` +
      `transform:translate(-50%,-50%) rotate(${Math.random() * 360}deg);animation-duration:${2.5 + Math.random() * 2}s`;
    layer.appendChild(img);
    img.addEventListener('animationend', () => img.remove());
  }
}
