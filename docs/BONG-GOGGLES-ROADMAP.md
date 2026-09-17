# Bong Goggles Roadmap

Bong Goggles is the 420 Integrated social layer: an old-Facebook-style network combining profiles, friends/follows, statuses, photos, stories, pages, groups, events, private messaging, casual games, discovery/reviews, search, recommendations, rewards, safety/moderation and wallet-native identity/session access.

Production web target: `https://bonggoggles.420integrated.org`.

## Completed foundation

- **Phase A / PR #55 — social foundation — COMPLETE**
- **Publishing/media/interactions / PR #57 — COMPLETE**
- **Publishing-policy hardening / PR #62 — COMPLETE**
- **Relationship hardening / PR #67 — COMPLETE**
- **Repost/quote/share provenance / PR #69 — COMPLETE**
- **Tags/mentions/approval / PR #70 — COMPLETE**
- **Reaction audience eligibility / PR #75 — COMPLETE**
- **Feed index policy surface / PR #76 — COMPLETE**
- **Pages/groups/events / PR #78 — COMPLETE**
- **Private messaging foundation / PR #80 — COMPLETE**
- **Casual games foundation / PR #82 — COMPLETE**
- **Discovery/reviews / PR #83 — COMPLETE**
- **Trust & safety / PR #89 — COMPLETE**
- **Rewards / PR #91 — COMPLETE**
- **Search/index policy surface / PR #93 — COMPLETE**
- **Phase 11 wallet session policy / PR #96 — COMPLETE**
- **Phase 11C passkey/session access bridge / PR #136 — COMPLETE**

## Phase 12 — production application/indexer backend — COMPLETE, merged PR #307

- **BG-12.1 — deterministic projector/reorg foundation — COMPLETE**
- **BG-12.2 — domain materialized views — COMPLETE**
- **BG-12.3 — canonical contract-event adapters + durable checkpoint recovery — COMPLETE**
- **BG-12.4 — pages/groups/events + discovery/review reducers — COMPLETE**
- **BG-12.5 — search + recommendation query service — COMPLETE**
- **BG-12.6 — notification/event pipeline — COMPLETE**
- **BG-12.7 — production ingestion/operations closeout — COMPLETE**

## Phase 13 — media/storage delivery — COMPLETE, merged PR #308

- **BG-13.1 through BG-13.7 — COMPLETE AND QUALIFIED**

## Phase 14 — full private messaging — COMPLETE, merged PR #314

- **BG-14.1 through BG-14.7 — COMPLETE AND QUALIFIED**

## Phase 15 — social games application — IN PROGRESS, PR #321

Branch: `feature/bong-goggles-bg15-social-games`

BG-15 turns the canonical `BongGogglesGameSessionRegistry420` foundation from PR #82 into a production Bong Goggles games experience. The registry remains authoritative for session identity/lifecycle, immutable `rulesetHash`, move sequencing/commitments, winner state and player authorization. Game-specific rendering, rule execution, timers, notation, local UX state, spectator presentation, discovery and rankings remain application-layer concerns.

Hard boundary: Bong Goggles social games remain **zero-wager**. Any wagered mode belongs in 420Bet.

### BG-15.1 — canonical game-session projector + resolver — COMPLETE AND QUALIFIED

### BG-15.2 — versioned ruleset registry + client game engines — COMPLETE AND QUALIFIED

### BG-15.3 — move engine + canonical commitment bridge — COMPLETE AND QUALIFIED

### BG-15.4 — turn UX, clocks, rematches & challenges — COMPLETE AND QUALIFIED

### BG-15.5 — spectator, presence & BG-14 messaging integration — COMPLETE AND QUALIFIED

### BG-15.6 — randomness + hidden-state games — COMPLETE AND QUALIFIED

- canonical `randomnessRef` is the sole randomness anchor where required;
- provider-neutral 420Randomness resolves entropy;
- hidden state remains off-chain/commitment-protected;
- stale, duplicate, premature and mismatched reveals fail closed.

### BG-15.7 — discovery, history, leaderboards and social surfaces — IMPLEMENTED, QUALIFICATION PENDING

- canonical finished sessions produce newest-first game history;
- win/loss/draw summaries and streaks are deterministic rebuildable projections;
- overall and per-game player statistics derive only from canonical finished outcomes;
- bounded recent-game shelves support profile surfaces;
- deterministic per-game leaderboards remain application projections with no canonical authority;
- friend activity is filtered by current visibility policy before presentation;
- game/player discovery candidates are shaped for the existing BG-12 search/recommendation service;
- BG-18 receives stat-snapshot hooks only; BG-15 never awards or mints rewards.

### BG-15.8 — abuse, integrity and recovery hardening

- block/profile-disable/policy-change invalidation during invitations and active sessions;
- stale-client, duplicate-move, replay, abandoned-session and conflicting-finish drills;
- rate limits and spam controls for game invitations/challenges;
- detect local-state/canonical-state divergence and force deterministic rebuild;
- secret/private-state redaction in logs and telemetry;
- explicit 420Bet boundary tests proving wagered sessions fail closed.

### BG-15.9 — production games closeout

- bounded lobby/session/move/history/leaderboard load qualification;
- latency and failure telemetry for projection, intent construction and move reconciliation;
- operator runbook for stuck projections, replay rebuilds, ruleset rollback/disable, randomness failures and game-engine regressions;
- exact-head game verification plus normal Docs/Integrated qualification;
- reconcile with current `main`, re-run exact-head qualification, then merge BG-15 only after the reconciled head is green.

## Remaining product phases after BG-15

- **BG-16 — notifications**
- **BG-17 — moderation operations**
- **BG-18 — rewards production configuration**
- **BG-19 — full web application + public-facing UI**
- **BG-20 — launch hardening**

## Current position

**Phase 12 is merged in PR #307. Phase 13 is merged in PR #308. Phase 14 is merged in PR #314. Current work: BG-15.7 history, statistics, leaderboards & social discovery on PR #321 / `feature/bong-goggles-bg15-social-games`.**

Critical path:

`BG-15.7 history/leaderboards/social discovery -> BG-15.8 integrity/recovery -> BG-15.9 production closeout -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
