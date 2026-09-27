# MATHS FIST — Claude project notes

90s-arcade 3D fighting game where every attack is a times-table answer (KS2). See `README.md` for gameplay and the
code map; this file covers build, test and deploy.

## Architecture (one paragraph)

Pure client-side: three.js + vanilla ES modules, bundled by Vite into static files. **No backend, no database** —
settings, high scores, unlocks and mastery are in the browser's `localStorage`. Fonts are bundled via `@fontsource/*`
(imported at the top of `src/main.js`), not Google Fonts: the game must work on offline school networks, and the
tests fail on any request that leaves the page's origin.

## Build / infra files

| Path | Role |
|------|------|
| `docker/Dockerfile` | App image: `node:22-alpine` builds `dist/`, `nginxinc/nginx-unprivileged:stable-alpine` serves it on 8080 (non-root). `HEALTHCHECK` hits `/healthz`. |
| `docker/nginx.conf` | Static serving: `/assets/*` immutable cache (Vite hashes filenames), `index.html` no-cache, gzip, `/healthz`. |
| `.dockerignore` | Allow-list: only `package*.json`, `index.html`, `src/`, `docker/nginx.conf` enter the app build context. |
| `docker-compose.yml` | Local: build from source, `http://localhost:56432/`. |
| `deploy/docker-compose.yml` | Server: pulls `ghcr.io/bphudson1984/maths-fist:${MATHS_FIST_TAG:-latest}` on port 56432. |
| `Dockerfile.agent` | Claude Code agent container: extends `ghcr.io/bphudson1984/claude-code`, adds Playwright Chromium + system deps at `/ms-playwright`, version pinned by `package-lock.json`. Own `Dockerfile.agent.dockerignore`. |
| `.github/workflows/docker-publish-app.yml` | Build app image → curl smoke test (every asset + fonts) → Playwright against the container → push `maths-fist` to GHCR on `main`. |
| `.github/workflows/docker-publish.yml` | Build & push agent image `ghcr.io/bphudson1984/fight-dev` when `Dockerfile.agent` or `package*.json` changes. |
| `playwright.config.js`, `e2e/` | Smoke tests. Without `BASE_URL` they build and run `vite preview`; with it they test that URL. |

Only `index.html` is built — `tools/*.html` are dev-only pages for `npm run dev` and are not shipped.

## Deploy

Merge to `main` → CI publishes `ghcr.io/bphudson1984/maths-fist:latest` and `:sha-<short>`. The user pulls on the
server manually (`docker compose pull && docker compose up -d` with `deploy/docker-compose.yml`). Pin a version with
`MATHS_FIST_TAG=sha-abc1234`. Nothing to back up: there's no server-side state.

## Conventions

- Branch model: short-lived feature branch → PR → merge to `main`. Don't push to `main` directly.
- **Testing**: `npm ci` then `npm test` before pushing. In the agent container Chromium is baked in at
  `/ms-playwright`; don't run `npx playwright install`. Specs import `test`/`expect` from `./fixtures.js`, which fails
  a test on page errors, `console.error`, or external requests.
- Tests drive the game through the `window.__game` debug hook at the bottom of `src/main.js` (`mode`, `fight`, `G`,
  `startArcade`, …). Keep it working when refactoring.
- New static files the game fetches at runtime must be imported via Vite (so they get hashed into `/assets`) or put
  in a `public/` dir — and the Dockerfile's `COPY` lines / `.dockerignore` allow-list updated to match.
- Headless CI renders WebGL with SwiftShader, so it's slow; timeouts in `playwright.config.js` are generous on purpose.
