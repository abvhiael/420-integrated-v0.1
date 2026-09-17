# Bong Goggles BG-15 — Social Games Application

BG-15 builds the production Bong Goggles social-games application over the canonical `BongGogglesGameSessionRegistry420` foundation introduced in PR #82.

## Canonical ownership

- `BongGogglesGameSessionRegistry420` owns canonical session identity, players, game type, immutable `rulesetHash`, randomness reference, lifecycle state, next move number, move commitments, winner and terminal timestamps.
- `BongGogglesProfileRegistry420`, `BongGogglesRelationshipGraph420` and `BongGogglesSocialPolicy420` remain canonical policy dependencies for active profiles, blocks and game-invite eligibility.
- BG-15 application services project and validate canonical state; they do not create a competing session authority.
- Game-specific engines, rendering, timers, notation, matchmaking, spectator UX and local presentation state remain application-layer concerns.
- Social games are strictly zero-wager. Any wagered game flow belongs in 420Bet.
- Hidden-state material remains off-chain and commitment-protected.
- Game chat reuses BG-14 / 420Messenger rather than introducing a game-specific messaging authority.

## Supported V1 games

1. Cribbage
2. Russian Cribbage
3. Chess
4. Word Game
5. Checkers
6. Backgammon
7. Dominoes

## BG-15.1 — canonical game-session projector + resolver

Status: COMPLETE AND QUALIFIED

## BG-15.2 — versioned ruleset registry + client game engines

Status: COMPLETE AND QUALIFIED

## BG-15.3 — move engine + canonical commitment bridge

Status: COMPLETE AND QUALIFIED

## BG-15.4 — turn UX, clocks, rematches & challenges

Status: COMPLETE AND QUALIFIED

## BG-15.5 — spectator, presence & BG-14 messaging integration

Status: COMPLETE AND QUALIFIED

## BG-15.6 — 420Randomness + hidden-state games

Status: COMPLETE AND QUALIFIED

## BG-15.7 — history, statistics, leaderboards & social discovery

Status: COMPLETE AND QUALIFIED

## BG-15.8 — abuse, integrity, replay & recovery hardening

Status: COMPLETE AND QUALIFIED

## BG-15.9 — production load qualification, runbook, reconciliation & phase closeout

Status: IMPLEMENTED — RECONCILIATION AND EXACT-HEAD QUALIFICATION PENDING

Requirements:

- Provide a bounded production qualification profile covering lobby/session projection, active sessions, canonical move verification, history projection, leaderboard projection and concurrent resolver activity.
- Reject runaway qualification inputs above explicit hard caps; BG-15.9 is a bounded release qualification, not an unbounded stress test.
- Record P95 latency evidence for projection, intent construction, canonical replay/rebuild, history projection and leaderboard projection.
- Fail load qualification on any budget overrun, observed error or unresolved canonical/local divergence.
- Emit structured games telemetry with operation, outcome, latency, retries, bounded reason and safe labels only after BG-15.8 recursive private/hidden-state redaction.
- Qualify the required production failure drills: projection stall, canonical replay divergence, ruleset disable/rollback, randomness unavailable, hidden-state reveal failure, policy invalidation, challenge spam and wager boundary.
- Use `docs/BONG-GOGGLES-BG-15-9-RUNBOOK.md` for stuck projection, replay divergence, ruleset rollback, randomness, hidden-state and abuse-response procedures.
- Reconcile `feature/bong-goggles-bg15-social-games` with current `main` before phase closeout.
- Require the reconciled exact head to pass Bong Goggles Games Verification, Bong Goggles Media Verification, 420Docs Qualification and 420 Integrated Qualification.
- Keep PR #321 open and unmerged until an explicit merge instruction is given.

### BG-15.9 bounded load baseline

- 500 lobby sessions;
- 250 active sessions;
- 5,000 canonical move commitments/payload verifications;
- 10,000 history rows;
- 1,000 leaderboard players;
- 25 concurrent resolvers.

P95 release budgets:

- projection <= 500 ms;
- intent construction <= 250 ms;
- canonical replay/rebuild <= 1,500 ms;
- history projection <= 750 ms;
- leaderboard projection <= 1,000 ms;
- qualification errors = 0;
- unresolved divergence after rebuild = 0.

### BG-15.9 invariants

67. Production qualification is bounded and cannot silently expand into uncontrolled stress/load generation.
68. Any latency-budget breach, qualification error or unresolved canonical/local divergence blocks closeout.
69. Operational metrics never carry hidden/private game material beyond the service boundary.
70. Failure drills prove containment and recovery without inventing a second canonical authority.
71. Existing canonical session, move, winner, policy and randomness authorities remain unchanged by closeout instrumentation.
72. Ruleset rollback disables application execution without mutating immutable canonical `rulesetHash` bindings.
73. Production recovery always rebuilds toward verified canonical state rather than promoting stale local cache.
74. The zero-wager boundary remains release-blocking: wagered play belongs in 420Bet.
75. The phase branch must be reconciled with current `main` before final qualification.
76. BG-15 cannot be considered phase-closed until all four required exact-head workflow families are green on the reconciled head.
77. PR #321 must not be merged without explicit user instruction.
