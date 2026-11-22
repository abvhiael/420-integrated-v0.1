# Cross-Country Chaos — production multiplayer qualification ledger

Date: 2026-11-21 (Saskatchewan); GitHub/Render timestamps are UTC on 2026-11-22.
Scope: separate 420ID accounts, server-owned zero-wager CCC rooms, approved atlas/cards, room-only chat.

## Code and automated qualifications

- PR [#1314](https://github.com/abvhiael/420-integrated-v0.1/pull/1314) merged the authenticated CCC account multiplayer delivery.
- PR [#1322](https://github.com/abvhiael/420-integrated-v0.1/pull/1322) merged the frozen-budget qualification correction and secure game deployment harness at merge commit `221db3af7bd1521387843a5d10703c474f3681bb`.
- Bong Goggles Web Verification: **success**, both final-head runs on `4f7275d0cc5dad5ae57cbd2c5dfc2cd31b29bfb6`.
- CCC authoritative rooms, secrets/privacy, real PostgreSQL concurrency: **success**, final-head run `44979804265`.
- Classic Rooms/Sessions/Rules/Bots BC-0.5–0.8: **success**, run `44979804206`.
- BC-0.9 shared tabletop components: **success**, run `44979804211`.
- 420ID Account Social AUTH-8/9/10/11: **success**, run `44979804208`.
- `app.js` and `styles.css` remain within BC-0.5 per-file ceilings. BC-0.9 stylesheet `game-kit.css` and `core/tabletop-components.js` are independently bounded; original budgets were not expanded.
- Render and Node reproducibility: `services/bong-goggles-chaos/package-lock.json`, independent `deployments/bong-goggles-chaos/render.yaml`, and `services/bong-goggles-chaos/scripts/live-probe.mjs` are checked in.

## Production service and database evidence

- Render workspace: existing user-confirmed **reefer review** workspace; no unrelated service modified.
- Dedicated `bonggoggles-chaos` Node 22 service: Render `srv-dc15uchksfps73fuod0g`, deployment `dep-dc15ucpksfps73fuoe3g`, commit `221db3af7bd1521387843a5d10703c474f3681bb`, **live**. Health endpoint: `https://bonggoggles-chaos.onrender.com/healthz`.
- Existing `bonggoggles-social` Go service: Render `srv-dc0iijm1egvs7382fkag`, activation deployment `dep-dc15vg6tlv9c73b5rh30`, same commit, **live**. Restricted `SOCIAL420_CHAOS_MODE` and exact game origin were supplied through Render environment variables; Go startup succeeded. No application key or connection string is checked into Git.
- Neon project `patient-night-81272367`, database `bonggoggles_social`: migrations `004_classic_rooms.sql`, `005_classic_sessions.sql`, `006_classic_rules_replay.sql`, and `007_chaos_multiplayer.sql` applied. Game tables, membership, and schema confirmed.
- `bonggoggles_chaos_runtime`: NOLOGIN group role with bounded game-table grants. Separate Neon-managed `bonggoggles_chaos_login` login inherits only the bounded game privileges plus read access to an otherwise empty isolated schema. Tests with this login succeeded reading `chaos_rooms` and were **denied** reading `bg_account_social.sessions` (SQLSTATE 42501). Room DELETE, SSO login-flow reads, and elevation are denied. Runtime role can use the game tables but cannot access the social session store.

## Post-activation public HTTP smoke

GitHub Actions [BongGoggles CCC live readiness](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44980324760) **succeeded on attempt 2, after both production services deployed**. The workflow uses only uncredentialed GET requests and verifies:
- 420ID health HTTP 200
- BongGoggles Social public health HTTP 200
- dedicated Chaos game health HTTP 200
- direct unsigned game API HTTP 401
- unauthenticated same-origin game route HTTP 401
- canonical SSO start HTTP 303 with a secure flow cookie.

There were no production sample credentials, test wagers or writes to game-room state; postdeployment database inspection counted **0 rooms and 0 memberships**.

## Remaining release acceptance (not represented as complete)

- Two distinct **real** 420ID accounts in separate browsers must create and join a private room, each see only its own hand and legal moves, and complete the three-stage championship with chat/report/mute and reconnection tests.
- Independently confirm that the public Cloudflare Pages frontend has published the merged `main` client and approved assets; GitHub and Render deployment do not establish the Pages build status by themselves.
- Render Free services may sleep when idle. A passing bounded health probe proves accessibility for that run, not uninterrupted availability or an always-on SLA. Do not upgrade hosting without approval.

Verdict: **code qualification, production Node/Go service startup, least-privilege Neon authority, and public unauthenticated transport gates passed. Human two-account acceptance and frontend release confirmation remain open.**
