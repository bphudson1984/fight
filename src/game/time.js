// Game clock: pause, slow-motion, hit-stop and abortable sleeps.

export class Abort extends Error {}

export const T = {
  now: 0,          // game time (scaled)
  real: 0,         // real time in seconds (unaffected by slow-mo / pause)
  scale: 1,
  paused: false,
  token: 0,
  _slowUntil: 0,
  _slowScale: 1,
  _stopUntil: 0,
};

const timers = [];

/** Sleep in game time. Rejects with Abort if abortAll() is called meanwhile. */
export function sleep(s) {
  const token = T.token;
  return new Promise((resolve, reject) => timers.push({ at: T.now + s, resolve, reject, token }));
}

/** Sleep in real time (ignores slow-mo, respects pause via frame loop). */
export function sleepReal(s) {
  const token = T.token;
  return new Promise((resolve, reject) => timers.push({ real: T.real + s, resolve, reject, token }));
}

export function abortAll() {
  T.token++;
}

export function checkAbort(token) {
  if (token !== T.token) throw new Abort();
}

/** Slow motion for `realSeconds`. */
export function slowmo(scale, realSeconds) {
  T._slowScale = scale;
  T._slowUntil = T.real + realSeconds;
}

/** Freeze frames on impact. */
export function hitstop(realSeconds) {
  T._stopUntil = Math.max(T._stopUntil, T.real + realSeconds);
}

/** Advance clocks; returns scaled dt. */
export function tick(rawDt) {
  const rdt = T.paused ? 0 : rawDt;
  T.real += rdt;
  let scale = 1;
  if (T.real < T._slowUntil) scale = T._slowScale;
  if (T.real < T._stopUntil) scale = Math.min(scale, 0.03);
  T.scale = scale;
  const dt = rdt * scale;
  T.now += dt;
  for (let i = timers.length - 1; i >= 0; i--) {
    const t = timers[i];
    if (t.token !== T.token) {
      timers.splice(i, 1);
      t.reject(new Abort());
    } else if ((t.real !== undefined && T.real >= t.real) || (t.at !== undefined && T.now >= t.at)) {
      timers.splice(i, 1);
      t.resolve();
    }
  }
  return { dt, rdt };
}
