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

- **BG-13.1 — media descriptor + canonical resolver — COMPLETE AND QUALIFIED**
- **BG-13.2 — upload preparation + ingest bridge — COMPLETE AND QUALIFIED**
- **BG-13.3 — canonical placement/seal orchestration — COMPLETE AND QUALIFIED**
- **BG-13.4 — verified retrieval + Gateway delivery — COMPLETE AND QUALIFIED**
- **BG-13.5 — thumbnails/posters/transcodes — COMPLETE AND QUALIFIED**
- **BG-13.6 — lifecycle/edit/delete/privacy semantics — COMPLETE AND QUALIFIED**
- **BG-13.7 — production delivery closeout — COMPLETE AND QUALIFIED**

## Phase 14 — full private messaging — COMPLETE, merged PR #314

BG-14 builds the Bong Goggles application messaging layer over 420Messenger and `BongGogglesPrivateMessaging420`; plaintext/ciphertext and key material remain off-chain and no parallel messaging authority is introduced.

- **BG-14.1 — conversation/request projection + canonical context resolver — COMPLETE AND QUALIFIED**
- **BG-14.2 — encrypted send/receive bridge — COMPLETE AND QUALIFIED**
- **BG-14.3 — inbox, unread/read and request state — COMPLETE AND QUALIFIED**
- **BG-14.4 — permitted group threads — COMPLETE AND QUALIFIED**
- **BG-14.5 — private attachments — COMPLETE AND QUALIFIED**
- **BG-14.6 — safety, devices, epoch rotation and recovery — COMPLETE AND QUALIFIED**
- **BG-14.7 — production messaging closeout — COMPLETE AND QUALIFIED**

BG-14 closed with secret-redacted telemetry, deterministic transport-loss/duplicate-replay/stale-epoch/device-loss/blocked-peer/attachment-failure drills, bounded load qualification, operator/recovery runbooks, reconciliation with current `main`, and exact-head qualification before merge.

Detailed BG-14 invariants and requirements are in `docs/BONG-GOGGLES-BG-14.md`; production operations are in `docs/BONG-GOGGLES-BG-14-7-RUNBOOK.md`.

## Phase 15 — social games application — IN PROGRESS

Branch: `feature/bong-goggles-bg15-social-games`

BG-15 turns the existing canonical `BongGogglesGameSessionRegistry420` foundation from PR #82 into a production Bong Goggles games experience. The registry remains authoritative for session identity/lifecycle, immutable `rulesetHash`, move sequencing/commitments, winner state and player authorization. Game-specific rendering, rule execution, timers, notation, local UX state, spectator presentation and matchmaking remain application-layer concerns unless a later protocol requirement explicitly promotes them on-chain.

Hard boundary: Bong Goggles social games remain **zero-wager**. Any wagered game mode belongs in 420Bet and must not be smuggled into the Bong Goggles game-session path.

### BG-15.1 — canonical game-session projector + resolver — CURRENT

- project `INVITED`, `ACTIVE`, `FINISHED`, `DECLINED` and `CANCELLED` sessions from canonical registry state/events;
- normalize player identities, game type, immutable ruleset hash, randomness reference, timestamps, next move number, winner and lifecycle state;
- expose incoming/outgoing game invitations and active/recent games per profile;
- revalidate current profile activity, bilateral block state and social game-invite policy before presenting actionable intents;
- construct wallet-authorized invite/accept/decline/cancel/finish transaction intents without backend signing;
- preserve the zero-wager invariant in every application path;
- add dedicated Bong Goggles Games Verification CI and deterministic unit coverage.

### BG-15.2 — game ruleset registry + client engines

- define versioned application ruleset descriptors keyed by canonical `rulesetHash`;
- support the V1 vocabulary already committed on-chain: Cribbage, Russian Cribbage, Chess, Word Game, Checkers, Backgammon and Dominoes;
- map each ruleset hash to deterministic client-engine/version metadata;
- reject unknown or mismatched rulesets rather than guessing behavior;
- keep game rules out of `BongGogglesGameSessionRegistry420` so historical sessions remain reproducible against immutable ruleset versions;
- add serialization fixtures and cross-client deterministic replay vectors.

### BG-15.3 — move engine + canonical commitment bridge

- maintain local game state from the selected ruleset engine while treating canonical move number/commitment state as authoritative sequencing;
- build `commitMove` intents using the exact next canonical move number;
- hash deterministic move payloads into canonical commitments;
- reject duplicate, skipped, stale or replayed move numbers;
- rebuild local state from canonical move history plus allowed off-chain move payload storage when required;
- fail closed when canonical commitments and local replay diverge;
- support reconnect/reload/reorg-safe reconstruction.

### BG-15.4 — turn UX, clocks, rematch and challenge flow

- game lobby, invitation cards, accept/decline/cancel UX and active-game routing;
- turn indicators, move history, resignation/draw/finish presentation and rematch flow;
- application clocks/time controls where supported by a ruleset, explicitly non-canonical unless later promoted;
- friend/profile/group challenge entry points that still resolve through canonical social policy;
- no silent session cloning: rematches create new canonical session IDs and immutable ruleset bindings.

### BG-15.5 — spectator/presence/chat integration

- read-only spectator presentation for sessions whose visibility policy allows it;
- online/presence indicators remain application metadata, never canonical game authority;
- reuse BG-14/420Messenger for player or spectator chat rather than embedding chat in game contracts;
- apply current block/privacy policy before spectator or chat presentation;
- never expose hidden-state game material through spectator feeds.

### BG-15.6 — randomness + hidden-state games

- use canonical `randomnessRef` only for rulesets that genuinely require auditable randomness;
- integrate 420Randomness through a provider-neutral resolver rather than inventing game-specific randomness authority;
- keep hidden hands/tiles/draw state off-chain or commitment-protected as required by the ruleset;
- verify reveal/commit consistency before advancing hidden-state games;
- add adversarial tests for stale randomness, duplicate reveals, premature reveal attempts and mismatched commitments.

### BG-15.7 — discovery, history, leaderboards and social surfaces

- active/recent game shelves on profiles;
- friend activity and discoverable public games where privacy permits;
- per-game history, win/loss/draw summaries and streak/stat projections derived from canonical finished sessions;
- leaderboards are application projections, not a replacement for canonical session outcomes;
- search/recommendation integration for players and game types using existing BG-12 query infrastructure;
- hooks for BG-18 rewards configuration without minting or awarding rewards directly in BG-15.

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

**Phase 12 is merged in PR #307. Phase 13 is merged in PR #308. Phase 14 is merged in PR #314. Current work: BG-15.1 canonical game-session projector + resolver on `feature/bong-goggles-bg15-social-games`.**

Critical path:

`BG-15.1 session projector -> BG-15.2 rulesets -> BG-15.3 move bridge -> BG-15.4 turn UX -> BG-15.5 spectator/presence/chat -> BG-15.6 randomness/hidden state -> BG-15.7 history/leaderboards/social surfaces -> BG-15.8 integrity/recovery -> BG-15.9 production closeout -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
