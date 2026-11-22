# BC-0.8 — Private-view computer opponent infrastructure

**Status:** **QUALIFIED (shared framework repository only)**. BC-0.8 source at commit `92b4223ae21efe68e37d280b7834695941a2bf59`, qualified on 2026-11-22 UTC. This is a reusable Easy/Medium/Hard AI **contract, isolation, scheduling and qualification harness**, **not** delivery of 25 game-specific AI strategies, playable games or a production deployment. BC-0 overall remains IN PROGRESS.

## Exact-source qualification

- [BC-0.5–0.8 Account Rooms, Sessions, Rules and Bot Qualification — run #44975420173](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44975420173): **SUCCESS**, exact checkout and SHA verified as `92b4223ae21efe68e37d280b7834695941a2bf59`. PostgreSQL 16 tagged Go integration **with race detector**, Go vet, social-service build and **51/51 scoped Node web/account/games tests passed** (zero failures).
- [AUTH-8/9/10/11 Wallet-Independent BongGoggles Social — run #44975420166](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44975420166): **SUCCESS**, same exact source SHA. Account Social Go PostgreSQL/race, static analysis, binary build, no implicit production enablement and **22/22 scoped Node browser tests passed** (zero failures).
- Both jobs include the new `TestBC08*` tests. Logs verify `TestBC08MixedBotSessionSerializesReplaysAndKeepsSecrets`, `TestBC08RejectMissingPolicyAndExpiredBotTurn`, `TestBC08DeterministicBotVersusBotSimulation`, `TestBC08RejectIllegalUnmeteredNondeterministicAndUnboundedBots` and `TestBC08BotSeatsMustUseValidControlAndDifficulty` passed. Existing BC-0.5/0.6/0.7 tests remain successful. No unrelated whole-web visual suites were rerun.

## Implemented and verified

| Boundary | Repository files | Behaviour |
|---|---|---|
| Operator-only per-game policies | `classic_bots.go`, `classic_sessions.go` | RulesAdapter-backed games must install game-specific Easy, Medium and Hard policies together. Unknown levels, absent policies and unqualified/non-versioned adapters fail closed. Existing production resolver is nil, with no installed policies or named game. |
| Private observations and legal-only AI | `classic_rules_framework.go` | Policy receives only its active seat's JSON View and independent copies of canonical legal options, not the RuleFrame, game seed, other hands or opponent view. Two identical metered decisions are required. Out-of-set, malformed, unmetered, nondeterministic, over-budget or deadline-expired policy results are rejected. |
| Resource limits | `classic_rules_framework.go`, `classic_bots.go` | Cooperative units by difficulty: Easy 1,000; Medium 10,000; Hard 100,000; corresponding deadlines 50/125/300 ms. The scheduler uses a single in-process mutex, at most eight due turns per tick and a 5-second outer context. Go cannot hard-preempt arbitrary untrusted policy code; only compiled, reviewed modules may register. |
| Durable authoritative bot action | `classic_bots.go`, `classic_sessions_actions.go`, `cmd/bong-goggles-social/main.go` | Server, never browser, selects bot seat/difficulty from DB; holds room then session locks, verifies immutable rule identity and complete genesis replay, checks deadline, applies legal move, and atomically appends private action/hash and public-only status. Concurrent workers/restarts do not double-submit. Human actions may pass turn to a qualified bot. |
| Deterministic simulation | `classic_bots.go`, `classic_bots_test.go` | Offline `QualifyBotMatch` runs all-bot games on fixed seeds and declared difficulty combinations; records legal move traces, final scores/winner and replay digest with 512-move cap. Different test-fixture difficulties produce reproducible scoring differences without rigged match results. |
| Adversarial PostgreSQL acceptance | `classic_bots_integration_test.go` | Mixed bot/human room, real 420ID session boundary, unauthorized bot-seat impersonation denied, concurrent bot action exactly once, hidden private state absent from public SSE/events, timeout without bot move, accurate terminal result, and restart replay reconciliation. |
| CI and docs | `.github/workflows/bc-0-5-classic-rooms.yml`, `README.md` | Existing exact-SHA scoped qualification, PostgreSQL 16/race, vet/build, and the two relevant web/account regression sets preserved and extended for BC-0.8. |

## Trust boundaries and release limits

The policy interface is game-independent; search depth, probability models, partnership planning and actual competitive playing strength must be implemented and qualified against each individual game's **real** rules and seat views under the respective BC-1 through BC-25 release gates. The deterministic counting-round fixture registered by tests under the `chess` ID is **test-only**, not Chess. Its seeded skill differentiation demonstrates wiring and repeatability, **not** real card/chess expertise or guaranteed stronger-level win rates. No production game rules, bots or release flags were enabled; no migration or privileged production service changes occurred. Actual multi-account live play and production availability remain unverified.

The BC-0.7 live acceptance blockers persist as last reported: Account Social ingress HTTP 502 and unrelated changed CCC WebP atlas artifacts invalidating frozen whole-web artwork hashes; this milestone does not claim to have retested or repaired them. The last verified deployed health is not sufficient to classify any Classics game as released.

**Next canonical milestone: BC-0.9 — Shared components** (not started by this work).
