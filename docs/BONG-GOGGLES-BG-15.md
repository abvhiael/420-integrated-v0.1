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

Status: IMPLEMENTED — EXACT-HEAD QUALIFICATION PENDING

Requirements:

- Treat the canonical session `randomnessRef` as the only randomness-request anchor for a game session.
- Resolve randomness through the generalized provider-neutral `RandomnessRouter420` / 420Randomness path rather than introducing a Bong Goggles randomness provider.
- Require exact `randomnessRef == requestId` agreement before randomness-dependent rulesets may consume a result.
- Accept randomness only when the referenced request is `FULFILLED` and exposes both the derived randomness value and proof hash; requested, fallback-active, voided or malformed results fail closed.
- Rulesets marked `randomnessRequired=false` must not be forced through a randomness resolver.
- Derive deterministic hidden-state seeds by binding canonical `sessionId`, immutable `rulesetHash`, exact `randomnessRef` and fulfilled randomness together.
- Keep hidden hands, tiles, decks, draws and salts off-chain or commitment-protected; on-chain/session state never stores plaintext private material.
- Verify each hidden-state reveal against its deterministic commitment before the reveal can be accepted by application logic.
- Reject duplicate reveal IDs, stale randomness references, premature reveals and commitment mismatches.
- Keep hidden-state reveal verification non-authoritative: canonical move/lifecycle/outcome state remains in `BongGogglesGameSessionRegistry420` and deterministic client engines.

### BG-15.6 invariants

41. A randomness-dependent game binds to exactly one canonical `randomnessRef`; applications may not silently substitute another request.
42. 420Randomness remains provider-neutral authority for request routing, fallback and verified resolution; BG-15 does not create a game-specific entropy protocol.
43. Unfulfilled or voided randomness can never advance a randomness-dependent game.
44. Hidden-state seeds bind session, immutable ruleset, canonical randomness reference and fulfilled randomness together.
45. Reveal material remains off-chain until disclosed; commitments, not plaintext secrets, are the integrity boundary.
46. A reveal must hash back to its exact commitment before application state can use it.
47. Duplicate, stale, premature and mismatched reveals fail closed.
48. BG-15.6 does not change canonical session lifecycle, move sequencing, winner authority or the zero-wager boundary.

## Remaining BG-15 phases

- **BG-15.7 — history, statistics, leaderboards & social discovery**
- **BG-15.8 — abuse, integrity, replay & recovery hardening**
- **BG-15.9 — production load qualification, runbook, reconciliation & phase closeout**
