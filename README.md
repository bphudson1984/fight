# MATHS FIST – Times Table Tournament

A 90s-arcade-style 3D fighting game (Tekken 3 look) where every attack is a times-table answer. Built for KS2.

## Run

```bash
npm install
npm run dev      # open the printed URL
npm run build    # static build in dist/
```

Or with Docker (no Node needed): `docker compose up --build`, then open http://localhost:56432/.

## Tests

```bash
npm test         # Playwright smoke tests (builds, then runs under vite preview)
BASE_URL=http://localhost:56432 npm test   # …or against a running container
```

## Deploy

Merging to `main` builds, tests and publishes `ghcr.io/bphudson1984/maths-fist` (`latest` + `sha-<short>`).
The image is public, so no `docker login` is needed.

### Add it to a server's Docker environment

Add this service to the `services:` section of the server's `docker-compose.yml` (or use `deploy/docker-compose.yml`
as-is):

```yaml
  maths-fist:
    image: ghcr.io/bphudson1984/maths-fist:latest
    container_name: maths-fist
    restart: unless-stopped
    ports:
      - "56432:8080"
```

Then start it:

```bash
docker compose pull maths-fist && docker compose up -d maths-fist   # game on http://<host>:56432/
```

To update after a new release, run the same two commands again. To pin a version, swap `latest` for a
`sha-<short>` tag. Change `56432` if that host port is taken; the container always listens on 8080.

The image is static files behind unprivileged nginx (health check at `/healthz`), with fonts bundled so it works
offline. There's no backend and no volume: scores and progress live in each browser's local storage.

## How it plays

- **Insert coin → Press start → Fight settings → Player select → Arcade ladder**: 3 opponents on 3 stages, then the
  boss OMEGA on the OMEGA GRID.
- The next question appears the instant you answer. Answers auto-submit once you've typed enough digits.
- **Correct = you attack.** Faster = heavier moves. Chains build combos (NICE → GREAT → … → MATHS GOD), every 5th hit
  launches the opponent, and hits while they're airborne are juggles.
- **Wrong or too slow** (the enemy's fuse burns out) = the CPU attacks and you see the correct answer.
- **Super meter**: fill it, press SPACE / tap SUPER for a cinematic **Super Rush** (6 seconds of rapid-fire questions,
  each one a hit, then a finisher).
- **CPU super**: builds from your mistakes. When it fires, answer the **PARRY** question in time to block it.
- Round timer, score, bonus tallies, K.O. replay, continue countdown, high-score initials, and a teacher-friendly
  results report (accuracy, speed, per-table scores, "practise these" list).

## K.O. finishers

Every K.O. picks a finisher based on the killing blow (high / body / launcher / super) and the gore setting,
never the same one twice in a row. The replay then shows it again.

| Finisher | Gore | What happens |
|---|---|---|
| HEADLESS! | Extreme | head knocked clean off; camera follows it bouncing while the neck geysers; body kneels and faceplants |
| OBLITERATED! | Extreme | body bursts apart, limbs fly trailing blood and scatter across the floor (favoured by super finishers) |
| DISARMED! | Extreme | arm ripped off, shoulder gushes, victim spins and collapses |
| SPINE BREAKER! | Arcade + | body folds backwards with a cascade of cracks |
| FACEPLANT! | all | dizzy wobble, knees buckle, face-first slam (teeth fly on Extreme) |
| SKY-HIGH SPLAT! | all | launched sky-high with flips, lands with a huge splat |
| HELICOPTER! | all | spins horizontally through the air and crashes down |
| classic | all | the original head-snapped-back K.O. |

Dead bodies twitch afterwards. Code: `src/game/death.js` (choreography, body-part physics, blood emitters, replay data).

## HUMILIATION finishers

Win a fight **2-0** and the final K.O. becomes a HUMILIATION (player only – the CPU never does it to you).
The loser staggers dizzy, a sad trombone plays, the crowd laughs, then one of 10 set-pieces (shuffled so each
comes up once before any repeats), a named banner + announcer call, a HUMILIATION REPLAY and a 100,000 bonus.

| Finisher | What happens (Extreme gore adds the gross version) |
|---|---|
| SQUASHED! | a giant foot stomps down from the sky – pancaked, then peels off and flutters away (Extreme: crater of red) |
| EXTINCT! | a comet streaks in, mushroom cloud – charred and crumbles to ash (Extreme: body parts rain down) |
| DIVIDE BY ZERO! | "÷ 0" appears, the victim glitches out behind a MATH ERROR screen, then spaghettifies into a black hole |
| NUMBER CRUNCHED! | the last question falls from the sky as giant 3D digits, each one squashing them further |
| LINE CLEAR! | Tetris blocks drop to a chiptune and complete a row through them – cleared (Extreme: meat cubes) |
| CHOMPED! | floor turns to water, a fin circles, a shark bursts up and swallows them, then burps |
| ABDUCTED! | UFO tractor beam; they come back with arms and legs swapped (Extreme: just the skeleton) |
| DETENTION! | a giant teacher's ruler whacks them into the floor like a nail, school bell, red "F-" |
| SHARPENED! | fed head-first into a giant pencil sharpener; shavings in their outfit colours (Extreme: + shoes) |
| HUD BONK! | your health bar leaves the HUD and home-runs them out of the stadium |

Code: `src/game/humiliation.js` (set-pieces, props, replay snapshots).

## Unlockable fighters (17 total)

| Fighter | How to unlock |
|---|---|
| KAI, LUNA, BRICK, ZED | Starters (the ×1, ×2, ×5, ×10 tables) |
| EL TRIPLE (luchador) | Master ×3 |
| VOLT (electro punk) | Master ×4 |
| HEX (sorceress) | Master ×6 |
| ACE (boxer) | Master ×7 |
| KRAKEN (pirate) | Master ×8 |
| KITSUNE (fox ninja) | Master ×9 |
| TITAN (gladiator) | Master ×11 and ×12 |
| REX (dino suit) | Clear Arcade on Rookie |
| BLAZE (fire fist) | Clear Arcade on Fighter |
| FROST (ice queen) | Clear Arcade on Champion |
| RONIN (samurai) | Clear Arcade on Legend |
| NYX (midnight emo) | Clear Arcade on Legend with all 12 tables selected |
| OMEGA (boss) | Clear Arcade once |

**Mastering a table** = clear Arcade with that table selected and get at least 80% of its questions right
(at least 5 asked). Mastery is saved, so ×11 and ×12 can be mastered in different runs. Clearing a difficulty also
counts for the easier ones. Progress is stored in the browser; open the game with `?unlockall` to unlock everyone
(handy for teachers / demos).

Settings (saved in the browser): tables 1–12, up to ×10/×12, question types (multiply, missing number, divide),
difficulty (Rookie / Fighter / Champion / Legend – CPU answer speed, damage, round time), rounds per fight, gore
(Off / Arcade / Extreme).

## Graphics modes (Fight Settings → Graphics)

- **HD Glossy** (default): rounded/bevelled high-poly fighters (~6,000 triangles each vs ~300 in Retro), glossy
  clear-coat plastic + polished metal materials, stage-captured environment reflections, a mirror-glossy arena
  floor, real-time shadows, full native resolution with multisample anti-aliasing. If the frame rate drops
  below ~40 fps it automatically lowers resolution, then the mirror floor, then shadows.
- **Retro PS1**: the original low-res, flat-shaded, vertex-wobble look. Fastest – use on older school devices.

Controls: digits, Backspace, Enter, Space (super), Esc (pause), arrow keys on select. Touch keypad on tablets.

## Code map

- `src/main.js` – screens & flow (attract/demo, options, select, VS, ladder, continue, name entry, results), input, loop
- `src/game/death.js` – K.O. finishers (dismemberment, part physics, blood geysers, replay support)
- `src/game/humiliation.js` – the 10 HUMILIATION set-pieces for 2-0 wins
- `src/game/fight.js` – the fight engine (questions, combos, supers, parry, KO, replay, timer, scoring, demo AI)
- `src/game/time.js`, `context.js`, `scores.js` – clock/slow-mo/hit-stop, shared services, high scores
- `src/fighter.js` – low-poly fighters + boss, keyframed moves, leg IK, afterimages, portraits
- `src/stages.js` – four animated stages (Sunset Temple, Neon City, Magma Core, Omega Grid)
- `src/effects.js` – sparks, streaks, shockwaves, explosions, blood, teeth, auras, ghosts
- `src/quality.js`, `src/hdfx.js` – HD vs Retro geometry/material factories; env maps, shadows, mirror floor
- `src/postfx.js` – bloom, chromatic aberration, zoom blur, impact-frame inversion, flashes, danger pulse
- `src/camera.js` – camera director (fight, intro, super, rush, impact, KO, victory, replay)
- `src/ui/hud.js` – HUD, banners, popups, cut-ins, tally
- `src/audio/` – `core.js` (shared bus/compressor/reverb), `sfx.js` (hits, gore, kiai voices, UI, announcer),
  `instruments.js` + `sequencer.js` + `songs.js` + `music.js` (multitrack synth sequencer and all the music)
- `tools/stage-test.html`, `tools/music-test.html` – dev-only test pages
