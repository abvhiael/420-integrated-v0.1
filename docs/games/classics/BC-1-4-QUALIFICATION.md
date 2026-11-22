# BC-1.4 — Cribbage player-facing frontend qualification

**Milestone:** BC-1.4 source/backend/frontend qualification, **not public Play release**.
**Qualified implementation source:** `40d04ed1ac6c802ae7f69fce29a3a2f7d67bf75f` (approved leaf artwork, frontend, backend announcement metadata and corrected shared account/route contracts).
**Pinned account-game rules:** `bc-cribbage-standard-121@1.0.0` (internal BC-0.7 version `v1.0`, SHA-256 rule identity `6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24`), not BG-15 wallet/on-chain Cribbage.

**[Final source BC-1.4 workflow #45065961060](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961060) — SUCCESS**. All three targeted jobs completed successfully: Node frontend tests + real asset/web build, Go BC-1.2/BC-1.4 `-race`, and headless Chromium desktop/tablet/mobile with actual card interaction, 420ID-only private-view fixture and axe-core WCAG checks. This qualification reflects the source at `40d04ed1...` and the original BC-1.4 changes; this document and the roadmap are audit-only.

## Implemented application artifacts

| Repository path | Actual delivery |
| --- | --- |
| `bong-goggles/web/assets/games/cribbage/leaf-board.svg` | Creator's approved latest hole-free cannabis-leaf board, retained as a self-contained 1448×1086 SVG embedding an optimized WebP; no external image source |
| `bong-goggles/web/core/cribbage-board.js` | Surveyed centerline/normal lanes; exactly 120 ordered holes per track (each 12×10), separate parked pegs, one shared hole 121, correctly partnered 4-seat tracks and third-player amber virtual track; deterministic physical back-peg leapfrog |
| `bong-goggles/web/core/cribbage-session.js` | Validated same-origin authenticated 420ID per-seat snapshot; strict unknown-key rejection; human legal-actions projection matching the server's discard/cut/pegging/Go rules; server-only score authority; exact serialized action, expected sequence and generated request ID; safe resync |
| `bong-goggles/web/core/cribbage-ui.js` | Intro, Rules, Play, Opponents, Game table, Results, History, Rematch routes. Left-side player hand and cut/crib/pegging/exposed cards, right-side leaf board, scores, turn indicators, legal buttons, show breakdown, 1.5-second count/score announcement and peg jumps, settings/help |
| `bong-goggles/web/cribbage.css` | Isolated dark-themed, keyboard-focus-visible, responsive desktop split-screen and tablet/mobile stack, reduced-motion setting, WCAG contrast for embedded 420ID account panel |
| `bong-goggles/web/core/games-ui.js`, `core/app-shell.js`, `app.js` | Integrated authenticated Cribbage screen routing and polling while retaining the eight shared game screens, existing 420ID account panel, Classics catalogue, CCC startup and no-release contracts |
| `bong-goggles/web/core/classic-rooms.js` | Safe 420ID Cribbage room-to-session link only when a canonical matching room/session exists |
| `bong-goggles/web/scripts/build.mjs` and `index.html` | Strict approved artwork validation, packaging, scoped stylesheet inclusion |
| `services/bong-goggles-account-social/classic_cribbage.go` | Backwards-compatible public `count` for each recorded peg award, necessary for accurate announcements after server count reset; no new private state or altered scoring arithmetic |
| `services/bong-goggles-account-social/classic_cribbage_frontend_test.go` | Engine award-count retention regression |
| `bong-goggles/web/test/cribbage-frontend.test.js` | Exact 120-hole map, leapfrog ordering, 2/3/4-seat legal moves and private-data rejection, scoring narration sequence, route rendering, authenticated action/1500ms timing |
| `bong-goggles/web/test/cribbage-browser-qualification.mjs` | Real Chromium desktop/tablet/mobile, display dimensions/asset provenance, accessible controls, keyboard/axe verification, 2p/3p/4p exact card clicks and 120 highlight option |
| `bong-goggles/web/test/classics-menu.test.js` | Updated formerly true but obsolete "no Cribbage board exists" assertion; still requires no public Play flag or unauthorized Start game |
| `.github/workflows/bc-1-4-cribbage-frontend.yml` | Exact-commit targeted build/unit/Go race/Chromium qualification |

## Gameplay and scoring display

The frontend renders only the actor's server-authorized private hand and public elements (starter, played cards, peg count, opponent **card counts**, revealed last-show hands). Unknown opponent hands and unrevealed crib contents are never sent to or reconstructed by the UI. Browser controls use only canonical legal server actions, and the Go engine remains the only authority for score/winner/hand/crib/turn.

An announcement is held for `1500 ms` before the next. The now-public `count` recorded at each award supports exact callouts such as **“15 for 2”** and **“18 for 6, three of a kind”**, including an award immediately followed by a 31/Go reset. Each `LastShow` hand/crib announcement follows the order established by BC-1.2: clockwise left of dealer, dealer's hand last, dealer's crib after it. Zero-point hands are still announced without moving pegs. Last-crib and heels handling are unchanged on-chain and in the existing rules. The back peg advances ahead of the front peg when a server award is confirmed. Score is always taken from server snapshots; a disconnected/resynchronized client never fabricates missed awards.

**Stinkhole 120:** highlighting is an optional **visual-only** setting. No one automatically wins, loses, skips, receives a special penalty or changes the frozen rules for landing on 120.

## Actual exact-source qualification

- [Full two-configuration Bong Goggles web verification #45065961010](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961010): **SUCCESS** — both disabled and account-social-enabled web builds, existing BC-0.2–BC-0.5 per-file budgets unchanged; BC-1.4 six-file pinned allowance 95,904 / 98,304 bytes; approved board Git blob SHA `02b7f8f7b86af3b6fa4bd0833a6785449145a366`; general asset allowlist and release gates passed.


- [BC-1.4 targeted three-job workflow #45065961060](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961060): **SUCCESS** — 7/7 Node tests, Node build and vetted SVG/stylesheet package, Go BC12/14 race, Chromium 1600×1000 2p / 1180×900 4p / 390×844 3p, no serious/critical WCAG A/AA violations, actual click-enabled legal crib discards and visual-only stinkhole overlay.
- [BC-0.12 shared Classics release qualification #45065961176](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961176): **SUCCESS** — shared rules/bot/room test gates, Chromium multi-account and release-fail-closed guard. All 25 titles remain locked.
- [BC-1.2 deterministic engine regression #45065961145](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961145): **SUCCESS** at the amended award-projection source.
- [CCC multiplayer #45065961126](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961126): **SUCCESS** at the shared app-shell/frontend changes.
- Also at exact source: [BC-0.5–0.10 Account Rooms #45065961108](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961108), [AUTH account social #45065961026](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961026), [BC-1.3 bot AI #45065961118](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961118), [BC-1.1 rules #45065961025](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961025), and [420Docs #45065961054](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45065961054) — **SUCCESS**. Existing automated repository workflow triggers are outside BC-1.4's focused test commands.

## Security / release boundary and next gate

BC-1.4 is a **real wired frontend** for any *already-authorized active Cribbage account session*. There is **no new authorized production Cribbage room registration/launch**, user-facing live multiplayer start/resume/rematch evidence, release manifest or public Play flag in this milestone. It would be misleading to call the site publicly playable now; frontend source tests and simulated account fixtures are not a real production two-account acceptance. There is no 420Bet wagering, $420 transfer or reward claim.

**BC-1 remains IN PROGRESS (zero released Classics). BC-1.5 human multiplayer, mixed human/bot live room activation and reconnect/resume are the next canonical step.** This milestone does not implement BC-1.5 through BC-1.8 or merge itself.
