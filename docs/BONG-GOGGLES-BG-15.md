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

Status: IN PROGRESS

Requirements:

- Normalize only canonical sessions where `exists == true`.
- Preserve exact `sessionId`, players, game type, `rulesetHash`, `randomnessRef`, canonical timestamps, next move number, state and winner.
- Reject malformed canonical state, impossible winners, missing terminal timestamps and nonparticipant viewers.
- Project incoming invites, outgoing invites, active games and recent terminal games deterministically.
- Re-read current profile activity, bilateral block state and `canInviteToGame` policy whenever resolving a session for protected presentation/action eligibility.
- An invite that became blocked, policy-denied or profile-inactive after creation must not remain acceptable through cached application state.
- Active-game move/finish eligibility must fail closed when either profile is inactive or the pair is currently blocked.
- Build wallet/session-authorized transaction intents for `invite`, `accept`, `decline`, `cancel` and `finish`; the backend must never sign or execute these actions on behalf of a player.
- Reject all nonzero wager amounts before constructing an invite intent.
- Preserve the canonical contract as the only source of session lifecycle truth.

### BG-15.1 invariants

1. Application projections are non-authoritative and must be rebuildable from canonical state.
2. Only `playerA` or `playerB` can receive a session projection.
3. `rulesetHash` is immutable canonical identity and may never be substituted by an application rule label.
4. Acceptance eligibility always uses current profile/block/invite policy, never invite-time cached policy.
5. Move/finish presentation eligibility always uses current profile/block state.
6. Zero-wager is an application and contract boundary; a nonzero wager is rejected and routed conceptually to 420Bet instead.
7. Invite/accept/decline/cancel/finish intents require user wallet/session authorization; backend signing is forbidden.
8. Terminal session ordering is derived from canonical timestamps and may be rebuilt after reorgs without preserving stale local order.

## Remaining BG-15 phases

- **BG-15.2 — versioned ruleset registry + client game engines**
- **BG-15.3 — move engine + canonical commitment bridge**
- **BG-15.4 — turn UX, clocks, rematches & challenges**
- **BG-15.5 — spectator, presence & BG-14 messaging integration**
- **BG-15.6 — 420Randomness + hidden-state games**
- **BG-15.7 — history, statistics, leaderboards & social discovery**
- **BG-15.8 — abuse, integrity, replay & recovery hardening**
- **BG-15.9 — production load qualification, runbook, reconciliation & phase closeout**
