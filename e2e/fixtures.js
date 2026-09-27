import { test as base, expect } from '@playwright/test';

// Every test fails on uncaught page errors, console errors, or any request
// that leaves the origin (the game must work on offline school networks).
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    // Retro PS1 graphics: headless CI renders WebGL in software, and HD mode is
    // too heavy for it (the game clock crawls and input stalls).
    await page.addInitScript(() => { try { localStorage.setItem('mathsfist.quality', 'retro'); } catch { /* ignore */ } });
    const problems = [];
    const origin = new URL(baseURL).origin;
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console.error: ${m.text()}`); });
    page.on('request', (r) => {
      const u = r.url();
      if (/^https?:/.test(u) && !u.startsWith(origin)) problems.push(`external request: ${u}`);
    });
    await use(page);
    expect(problems, problems.join('\n')).toEqual([]);
  },
});

export { expect };

/** Wait until the game's debug hook reports `mode`. */
export async function waitForMode(page, mode) {
  await expect.poll(() => page.evaluate(() => window.__game?.mode), { message: `mode → ${mode}` }).toBe(mode);
}
