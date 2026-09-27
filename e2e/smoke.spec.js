import { test, expect, waitForMode } from './fixtures.js';

test('boots to the attract screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/MATHS FIST/);
  await expect(page.locator('#title')).toBeVisible();
  await expect(page.locator('#title-logo .press')).toHaveText('INSERT COIN');
  await waitForMode(page, 'boot');
});

test('fonts are bundled and load from our own origin', async ({ page }) => {
  await page.goto('/');
  for (const f of ['Bangers', 'Press Start 2P', 'Russo One']) {
    const loaded = await page.evaluate((fam) => document.fonts.load(`20px "${fam}"`).then((l) => l.length), f);
    expect(loaded, f).toBeGreaterThan(0);
  }
});

test('coin → start → settings → select → fight, answer a question', async ({ page }) => {
  await page.goto('/');
  await waitForMode(page, 'boot');

  await page.keyboard.press('Enter'); // insert coin
  await waitForMode(page, 'title');
  await page.keyboard.press('Enter'); // press start
  await waitForMode(page, 'options');
  await expect(page.locator('#options')).toBeVisible();

  await page.locator('#options-next').click();
  await waitForMode(page, 'select');
  await expect(page.locator('#select')).toBeVisible();
  await page.keyboard.press('Enter'); // pick the highlighted (starter) fighter

  await waitForMode(page, 'vs');
  await page.keyboard.press('Enter'); // skip the VS screen
  await waitForMode(page, 'fight');
  await expect(page.locator('#hud')).toBeVisible();

  // Wait for a live question, then type its answer.
  await expect.poll(() => page.evaluate(() => {
    const q = window.__game.fight?.q;
    return q && !q.locked && q.mode === 'normal' ? q.q.answer : null;
  }), { timeout: 30_000 }).not.toBeNull();
  const answer = await page.evaluate(() => window.__game.fight.q.q.answer);
  await page.keyboard.type(String(answer)); // auto-submits once enough digits are typed

  await expect.poll(() => page.evaluate(() => window.__game.G.run.log.some((e) => e.kind === 'correct'))).toBe(true);
});
