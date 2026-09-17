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

Requirements:

- Project application game cards for invited, active and terminal sessions without creating new canonical game authority.
- Keep canonical session lifecycle, players, ruleset identity, winner and next move sequence sourced from `BongGogglesGameSessionRegistry420`.
- Derive current turn ownership from the deterministic client engine, but validate the returned turn owner is one of the two canonical session players.
- Preserve canonical `nextMoveNumber` as the sequence source while exposing application move-history/notation presentation separately.
- Support profile, friend, group and lobby challenge entry points only by constructing the existing canonical `invite` intent through the BG-15.1 zero-wager path.
- Rematches must create a fresh canonical `invite`; the previous `sessionId` may be retained only as non-authoritative presentation provenance.
- Reject rematch attempts from non-terminal sessions or nonparticipants.
- Model time controls as application metadata only. Clocks are advisory, non-canonical and have no settlement authority.
- Expose accept/decline/cancel/finish/rematch presentation actions according to canonical lifecycle while wallet/session authorization remains required for actual state-changing intents.
- Preserve draw presentation using the canonical zero-address winner convention.

### BG-15.4 invariants

25. Turn ownership is engine-derived application state; BG-15 must never invent turn order from move-number parity.
26. Canonical `nextMoveNumber` remains authoritative even when application turn/history presentation is stale.
27. Every profile/friend/group/lobby challenge resolves to the canonical zero-wager `invite` path.
28. A rematch never reuses or mutates the prior canonical session; it requests creation of a fresh session with the selected immutable ruleset binding.
29. Application clocks are advisory only and cannot determine canonical winners, forfeits, settlement or rewards.
30. Presentation actions do not authorize themselves; contract wallet/session authorization and current policy checks remain authoritative.
31. The zero-address winner remains the canonical draw representation.
32. BG-15.4 adds no second invitation, timing, turn or outcome authority.

## BG-15.5 — spectator, presence & BG-14 messaging integration

Status: IMPLEMENTED — EXACT-HEAD QUALIFICATION PENDING

Requirements:

- Build read-only spectator projections only for canonical `ACTIVE` or `FINISHED` sessions.
- Re-read current player profile activity, viewer-to-player block state and spectator visibility policy every time a protected spectator view is resolved.
- Resolve the exact BG-15.2 ruleset descriptor and require exact `(rulesetHash, gameType)` agreement with the canonical session.
- Accept only explicitly prepared `publicState` for spectator presentation. Full/private state objects are forbidden at the game-spectator boundary.
- For hidden-state rulesets, reject spectator payloads containing common private-material fields such as hands, decks, private state, secrets or hidden state.
- Keep presence/online indicators ephemeral application metadata. Presence expires to `OFFLINE`, is never canonical and has no effect on game lifecycle, turn, outcome or settlement.
- De-duplicate presence by account using the newest observation and expose freshness/expiry metadata explicitly.
- Reuse BG-14/420Messenger for all player/spectator chat. Game code consumes only a currently authorized Messenger route/context supplied by the BG-14 messaging layer.
- Reject any chat route whose transport is not exactly `420MESSENGER`, whose actor/session binding mismatches, or whose current authorization is false.
- Never embed game chat state or message payloads in `BongGogglesGameSessionRegistry420` or any BG-15 game contract path.

### BG-15.5 invariants

33. Spectator projections are derived, read-only and non-authoritative; canonical game state remains owned by `BongGogglesGameSessionRegistry420`.
34. Current privacy/block/profile policy is re-evaluated at spectator-read time; cached permission never overrides a new denial.
35. Spectator presentation receives explicit public state only; full/private game state is rejected at the boundary.
36. Hidden-state rulesets must not expose hands, decks, unrevealed tiles/draw material, secrets or private state through spectator feeds.
37. Presence is advisory application metadata and cannot affect canonical move, lifecycle, winner, settlement or rewards.
38. Expired presence resolves to `OFFLINE`; stale presence cannot remain authoritative through cache.
39. Game chat uses BG-14/420Messenger exclusively; BG-15 never creates a second conversation, encryption or message authority.
40. A game chat route must be currently authorized and bound to the requested actor/session before presentation.

## Remaining BG-15 phases

- **BG-15.6 — 420Randomness + hidden-state games**
- **BG-15.7 — history, statistics, leaderboards & social discovery**
- **BG-15.8 — abuse, integrity, replay & recovery hardening**
- **BG-15.9 — production load qualification, runbook, reconciliation & phase closeout**
