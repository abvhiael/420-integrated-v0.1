# BC-1.3 — Cribbage computer-opponent qualification

**Status: QUALIFIED as the repository AI/engine milestone**, with **no production registration, public Play activation, deployment or real-account browser match claimed**.

**Qualified implementation source:** `8f4c87ff69c0c9856765984d249555c506f85f86` (two Cribbage AI source/test files and focused workflow already committed).
**Pinned rules:** `bc-cribbage-standard-121@1.0.0`, BC-1.1 manifest SHA-256 `a2b6e4695d27555546fc1b8d43e54e33c2dfba3aa50c6103393db32575d86cec`, internal BC-0.7 adapter version `v1.0`.
**Primary exact-source qualification:** [BC-1.3 Go-race + vet #44993822536](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44993822536) **SUCCESS**; all five focused Go BC-1.3 test groups passed, zero failures; full source-SHA checkout confirmed. [Prior initial-policy acceptance #44993699633](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44993699633) also **SUCCESS** (before the subsequent full human-vs-bot acceptance test).

## Actual implementation

- `services/bong-goggles-account-social/classic_cribbage_bots.go`: `NewCribbageBotPolicies()` supplies **three separate immutable policies** implementing the existing BC-0.8 `RuleDecisionPolicy`. Strategies do not change the canonical BC-1.2 rules adapter or legal move generation.
- **Easy:** deterministic weak varied choice from the already-legal action list, using a hash of seat-visible JSON; never random time/hidden deck state.
- **Medium:** bounded evaluation of seven candidate public/unseen cut cards to approximate held-hand scoring plus own/other-side crib features; greedily values known pegging points with modest 5/10 exposure and hand retention heuristics.
- **Hard:** evaluates all unseen possible starters for the retained hand, scores fixed-size deterministic *hypothetical* crib completions from the unknown-card pool, accounts for dealer/partner crib ownership and estimates one-ply pegging scoring exposure from publicly unknown possibilities. It never samples the actual hidden opponent cards or uses the server shuffle seed.
- All policies take only an independently verified seat `View` and the shared human `LegalActions`; the shared `ChooseMoveBounded` checks chosen actions against the permitted list, runs each decision twice for deterministic equality, and enforces the immutable Easy/Medium/Hard cost/time budgets (1,000/10,000/100,000 units and 50/125/300 ms). Duplicate/unknown view properties, opponent/deck/crib/seed injection, wrong difficulty, unmetered and illegal moves are denied. Policies do not mutate their inputs or share secret state.
- `services/bong-goggles-account-social/classic_cribbage_bots_test.go` is the scoped adversarial, behavior, complete-game and replay suite.
- `.github/workflows/bc-1-3-cribbage-bots.yml` verifies the exact PR SHA and runs focused Go `-race` tests plus `go vet`.

## Verified acceptance from [workflow #44993822536](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44993822536)

| BC-1.3 test | Result |
| --- | --- |
| `TestBC13AllThreeStrategiesChooseOnlyHumanLegalMoves` | PASS — 120 seeded seat/variant deals: Easy vs Medium diverged **109**, Medium vs Hard **49**, Easy vs Hard **108** times; every action on the canonical human legal list, decisions repeatable |
| `TestBC13PrivateViewOnlyAndHostileInputRejection` | PASS — 2/3/4-player seat projections contain no secret seed, deck, crib, all-hands or opponent-hand field; forged secret fields, malformed legal discards, wrong difficulty and budget bypass denied |
| `TestBC13MediumPrefersKnownPeggingPoints` | PASS — Medium chooses the guaranteed +2 pegging fifteen over non-scoring alternatives |
| `TestBC13MixedSeatSetupsAndFullBotMatches` | PASS — all levels can share one game, and all 2/3/4-seat bot-only matches finish and replay exactly |
| `TestBC13HumanSeatVersusComputerOpponentsToVictory` | PASS — a genuine human-controlled rules seat coexists with bot-controlled seats for complete 2/3/4-player simulated matches; all computer moves pass the same legal validator and the immutable trace reproduces terminal victory |

Completed bot-vs-bot configurations: **2p** 138 actions, winner seat 1, scores `[76,122]`; **3p** 174 actions, winner 1, scores `[67,122,110]`; **4p** 166 actions, winner 0, scores `[123,107,123,107]` (two partnered tracks per team).

Completed one-human-versus-computer simulations: **2p** 155 accepted actions (winner 1); **3p** 168 (winner 2); **4p** 151 (winner 0). All outcomes crossed 121 and passed exact private-journal replay.

## Security and release scope

The authoritative authenticated room/session service, BC-0.7 rule engine, 2/3/4-player team structure, private-move journal and server-state checksum remain unchanged. No direct `RuleFrame` or other-seat cards are provided to a strategy. Only **exposed, legitimately public** peg plays and previous revealed show components may be read. Unseen-card sampling is *hypothetical* and is seeded solely from the seat-visible projection; the bot cannot recover a live shuffled deck. User-supplied AI modules and unmetered/untrusted action sources remain unsupported.

The bot factory is qualified for subsequent operator-only registration via `ClassicSessions.EnableBots`, but is intentionally not installed in production yet because the dedicated Cribbage UI, two-account online sessions and release acceptance remain gated. No claim of production 420ID matches, browser accessibility, frontend play, betting/rewards or BG-15 wallet changes is made.

**Canonical next step:** **BC-1.4 — Cribbage frontend**, including accessible landing/help/play screens, complete pegging-board layout, hidden hand, public exposures and human action controls. This step has not been started. BC-1 remains IN PROGRESS and BC-2 remains blocked.
