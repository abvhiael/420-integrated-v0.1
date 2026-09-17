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

Status: IMPLEMENTED — EXACT-HEAD QUALIFICATION PENDING

Requirements:

- Derive player history only from canonical `FINISHED` sessions in `BongGogglesGameSessionRegistry420`.
- Preserve exact session ID, game type, immutable ruleset hash, players, winner and canonical timestamps in every history row.
- Derive win/loss/draw outcomes from the canonical winner, including zero-address draws.
- Produce deterministic overall and per-game summaries containing games, wins, losses, draws, current streak and best win streak.
- Build profile game shelves as bounded newest-first projections over canonical finished sessions.
- Build deterministic per-game leaderboards as application projections only; ranking never becomes canonical game or reward authority.
- Apply current visibility policy before friend activity or discoverable game activity is emitted.
- Shape player/game discovery candidates for consumption by the existing BG-12 search/recommendation service rather than creating a second search authority.
- Keep all discovery/search scores as hints only; canonical eligibility and BG-12 filtering remain authoritative for presentation.
- Expose BG-18 rewards hooks containing derived stat snapshots only. BG-15 never awards, mints or settles rewards.
- Keep every history/stat/leaderboard surface rebuildable from canonical finished sessions after reorg/replay.

### BG-15.7 invariants

49. Only canonical `FINISHED` sessions contribute to historical outcomes and competitive statistics.
50. Win/loss/draw derivation uses the canonical winner field; application rankings cannot rewrite outcomes.
51. History rows and statistics are derived and rebuildable, never canonical authority.
52. Leaderboard ordering is deterministic for the same canonical session set and player set.
53. Leaderboards never authorize gameplay, settlement, rewards, moderation or identity decisions.
54. Friend/discovery activity must pass current visibility policy before presentation.
55. BG-12 remains the search/recommendation query authority; BG-15 only emits compatible game/player candidates.
56. BG-18 reward integration is hook-only in BG-15; `awardRequested` and `mintRequested` remain false.

## Remaining BG-15 phases

- **BG-15.8 — abuse, integrity, replay & recovery hardening**
- **BG-15.9 — production load qualification, runbook, reconciliation & phase closeout**
