import { defineConfig } from '@playwright/test';

// By default the suite builds the game and runs it under `vite preview`.
// Set BASE_URL to test something already running instead, e.g. the app
// container in CI: BASE_URL=http://localhost:56432 npx playwright test
const external = process.env.BASE_URL;
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // The game renders WebGL in software (SwiftShader) on headless CI, so it's slow.
  // Tests also force Retro graphics and a small viewport (see e2e/fixtures.js).
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 1 : '50%',
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : [['list']],
  use: {
    baseURL: external || `http://localhost:${PORT}`,
    actionTimeout: 10_000,
    locale: 'en-GB',
    viewport: { width: 800, height: 450 },
    // Let the game's Web Audio start without a real user gesture.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] },
  },
  webServer: external ? undefined : {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
