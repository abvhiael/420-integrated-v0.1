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

Status: IMPLEMENTED — EXACT-HEAD QUALIFICATION PENDING

Requirements:

- Re-read current player profile activity, bilateral block state and social-game policy before sensitive invitation, move or finish actions; stale previously-authorized clients fail closed when policy changes.
- Reject nonparticipant actions even when the caller possesses stale local session state.
- Bound repeated challenge/invitation attempts with deterministic application-layer pairwise rate limiting; rate limits never replace canonical social policy.
- Preserve BG-15.3 canonical move sequencing and replay protection as the source of truth for stale, duplicate, skipped and replayed move rejection.
- Rebuild local game state from canonical move commitments/payload verification and compare the resulting state digest against the local digest.
- Force canonical rebuild whenever local and canonical replay digests diverge; local cached state never overrides a verified canonical replay.
- Detect conflicting finish attempts against an already-canonical winner and fail closed; identical already-finished outcomes may be represented idempotently without rewriting chain state.
- Classify abandoned sessions as application metadata only; timeout classification must never mutate canonical lifecycle or fabricate a winner.
- Recursively redact hidden/private game material from logs and telemetry, including hands, decks, tiles, seeds, salts, plaintext/ciphertext, key material and other hidden-state fields.
- Prove the Bong Goggles zero-wager boundary explicitly: nonzero wager attempts must continue to fail through the canonical invite builder and wagered play remains routed to 420Bet.

### BG-15.8 invariants

57. Current profile/block/policy state overrides stale client authorization for every protected game action.
58. Nonparticipants cannot use BG-15 application helpers to prepare protected canonical game actions.
59. Challenge spam controls are bounded application safeguards and never become canonical relationship or invitation authority.
60. Canonical move sequence/commitment history remains authoritative for stale-client, duplicate, skipped and replay detection.
61. Local/canonical state-digest divergence always resolves toward deterministic canonical replay, never toward cached local state.
62. A conflicting finish can never overwrite the canonical terminal winner.
63. Abandonment detection is advisory metadata only and cannot terminate a canonical session or assign a winner.
64. Private/hidden game material is redacted before telemetry leaves the game service boundary.
65. Bong Goggles remains strictly zero-wager; nonzero wager attempts fail closed and wagered play belongs in 420Bet.
66. BG-15.8 adds no second lifecycle, policy, settlement, moderation or replay authority.

## Remaining BG-15 phases

- **BG-15.9 — production load qualification, runbook, reconciliation & phase closeout**
