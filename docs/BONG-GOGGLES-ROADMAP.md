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

- **BG-12.1 through BG-12.7 — COMPLETE**

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

### BG-15.7 — discovery, history, leaderboards and social surfaces — COMPLETE AND QUALIFIED

- canonical finished sessions produce newest-first history and deterministic win/loss/draw statistics;
- profile shelves, leaderboards and friend activity remain rebuildable application projections;
- visibility is applied before social discovery presentation;
- BG-12 remains search/recommendation authority;
- BG-18 hooks contain stat snapshots only and never mint/award in BG-15.

### BG-15.8 — abuse, integrity and recovery hardening — IMPLEMENTED, QUALIFICATION PENDING

- current profile-active, bilateral-block and social-policy state invalidates stale invitation/move/finish actions;
- nonparticipants fail closed even with stale local state;
- pairwise challenge rate limits reduce invitation spam without replacing canonical policy;
- BG-15.3 canonical move sequencing/commitments remain authoritative for stale, duplicate, skipped and replayed move rejection;
- deterministic canonical replay is compared against local state digests and divergence forces rebuild;
- conflicting finishes against canonical terminal winners fail closed;
- abandoned-session classification is advisory only and cannot mutate lifecycle or assign winners;
- hidden/private material is recursively redacted from logs and telemetry;
- explicit zero-wager boundary tests ensure any nonzero wager attempt fails and wagered play remains in 420Bet.

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

**Phase 12 is merged in PR #307. Phase 13 is merged in PR #308. Phase 14 is merged in PR #314. Current work: BG-15.8 abuse, integrity & recovery hardening on PR #321 / `feature/bong-goggles-bg15-social-games`.**

Critical path:

`BG-15.8 integrity/recovery -> BG-15.9 production closeout -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
