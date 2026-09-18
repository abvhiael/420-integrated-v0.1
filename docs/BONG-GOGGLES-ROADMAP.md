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

## Phase 15 — social games application — COMPLETE, merged PR #321

- **BG-15.1 through BG-15.9 — COMPLETE AND QUALIFIED**
- merge commit: `95ab47efaccb1a50084c33c5b7c8d4faf44ab529`
- production social games remain strictly zero-wager; wagered play belongs in 420Bet.

## Phase 16 — notifications — ACTIVE, PR #330

Branch: `feature/bong-goggles-bg16-notifications`

BG-16 integrates the production Bong Goggles application with the existing 420Notifications service. Notifications remain presentation-only, opt-in through 420Notifications, non-authoritative and unable to sign transactions or mutate canonical state. Private Messenger payloads, encrypted content, private Identity fields and raw Attention telemetry remain excluded.

### BG-16.1 — notification taxonomy + 420Notifications boundary — COMPLETE AND QUALIFIED

- application notification kind/topic catalog frozen;
- Bong Goggles candidates validated before handoff to `420/service/notifications/v1`;
- BG-12.6 deterministic/provenance/non-authority guarantees preserved;
- production classes reserved for relationships, interactions, groups, events, games, messages, moderation/appeals, rewards, discovery and safety;
- Messenger notifications are metadata-only and explicitly forbid private/encrypted payload carriage;
- subscription state, channels, rate limits, provider retry state and promotional consent remain owned by 420Notifications.

### BG-16.2 — relationships + interaction emitters — COMPLETE AND QUALIFIED

- incoming friend requests and accepted requests;
- approval-required follow requests and completed follows;
- comments/replies from canonical `SocialObjectPublished` COMMENT projections;
- mentions and tags from canonical `TagCreated` events;
- current profile/policy/block/mute revalidation before request/comment/tag emission;
- self-notification suppression through the common candidate builder;
- deterministic replay deduplication retained from the BG-12.6 pipeline.

### BG-16.3 — groups + events emitters — COMPLETE AND QUALIFIED

- canonical `GroupJoinRequested`, `GroupMemberActivated`, `GroupMemberRemoved` and `GroupUpdated` emitters;
- canonical `EventRSVP` and `EventUpdated` emitters;
- current group/event state hydration before recipient selection;
- current group membership hydration before activation/removal notices;
- material group/event updates fan out only to hydrated eligible recipients;
- muted, inactive and currently blocked recipients are suppressed during fan-out;
- group-removal notices do not invent a logical actor when the canonical event exposes only the transaction operator;
- no synthetic event-invitation primitive is introduced because the current canonical registry does not emit one;
- deterministic replay deduplication remains unchanged.

### BG-16.4 — games + messaging emitters — COMPLETE AND QUALIFIED

- canonical `GameInvited`, `GameAccepted`, `GameMoveCommitted` and `GameFinished` emitters;
- game recipients derived from canonical session players, including turn-ready notices to the opposing player;
- current profile/block/mute/game-policy revalidation before game notification emission;
- explicit zero-wager notification gate preserves the BG-15 boundary and creates no wager/escrow/settlement authority;
- canonical 420Messenger `EnvelopeCommitted` events produce Bong Goggles `MESSAGE_RECEIVED` presentation only when bound to a current open BG-14 direct context;
- message recipient is derived from the canonical direct-context participant pair;
- current conversation/send authorization is revalidated before message notification emission;
- message notification metadata is limited to opaque IDs and sequence numbers;
- plaintext, ciphertext, payload/body/content, envelope/storage commitments, device-key commitments and epoch commitments are forbidden from message notification metadata;
- deterministic replay deduplication and non-authoritative provenance remain unchanged.

### BG-16.5 — moderation, appeals + rewards emitters — COMPLETE AND QUALIFIED

- canonical `SafetyActionApplied`, `SafetyActionRevoked` and `CaseClosed` events notify the canonical safety subject;
- canonical `AppealResolved` events notify the canonical appellant;
- case/action/appeal IDs are hydrated and revalidated before notification creation;
- notifications cannot mutate or redefine moderation/appeal state;
- canonical `RewardContributionSubmitted` events notify the verified contribution beneficiary;
- contribution submission is explicitly presented as `REWARD_CONTRIBUTION_SUBMITTED`, never as reward earned or paid;
- `REWARD_EARNED` and `REWARD_PAYOUT_UPDATED` remain reserved catalog kinds only until canonical reward lifecycle events exist;
- synthetic `RewardEarned` / `RewardPayoutUpdated` source events intentionally emit nothing;
- deterministic replay deduplication and non-authoritative provenance remain unchanged.

### BG-16.6 — preference + delivery integration — COMPLETE AND QUALIFIED

- Bong Goggles topic/kind vocabulary maps to the existing 420Notifications source/topic/event filters;
- activation and operational consent must be explicit before a Bong Goggles subscription preference is produced;
- unknown topics, kinds and channels fail closed;
- granular topic/kind and minimum-severity filters are applied before delivery handoff;
- supported Genesis delivery channels remain `in_app`, `web` and `push`;
- channel handoff targets the qualified `genesis-in-app`, `genesis-web` and `genesis-push` providers;
- mute and operational-consent withdrawal suppress presentation only and never alter canonical source state;
- retry counters, backoff, rate limiting, provider health and queue state remain owned entirely by 420Notifications;
- promotional consent remains separate, independent and off unless explicitly enabled;
- operational Bong Goggles events remain operational even when promotional consent is separately enabled;
- Messenger private-payload validation runs before delivery handoff.

### BG-16.7 — notification centre application surfaces — COMPLETE AND QUALIFIED

- deterministic unread counts across the current notification-centre history;
- reverse-chronological paged history with stable timestamp + notification-ID cursors;
- bounded page size and fail-closed invalid cursors;
- HTTPS deep links back to the canonical Bong Goggles resolver carrying only notification kind, notification ID and opaque subject ID;
- explicit `pending`, `finalized`, `retracted` and `superseded` presentation states;
- source provenance preserved on every centre item;
- degraded-notification UX links users directly to canonical Bong Goggles, 420Wallet and 420Explorer state;
- notification-centre surfaces remain non-authoritative and carry no signing, spending, transaction-approval or capability-grant authority.

### BG-16.8 — abuse, privacy + recovery hardening — COMPLETE AND QUALIFIED

- bounded recipients-per-event fan-out and per-recipient notification-rate guards fail closed on abuse;
- over-limit batch admission is atomic so partial quota consumption cannot create replay drift;
- guard policy/counters are deterministic, snapshot-restorable and policy-bound;
- structured operational telemetry recursively redacts private Messenger content/commitments, secrets, tokens, authorization data, cookies and raw Attention telemetry;
- restart recovery restores both pipeline replay/deduplication state and fan-out guard state;
- provider delivery is isolated per channel so one provider failure cannot suppress otherwise qualified channels;
- provider retry, queue and rate state remain 420Notifications-owned;
- canonical/local checkpoint mismatch explicitly degrades notification presentation and forces stale local visibility off until replay converges;
- notification hardening remains non-authoritative and cannot mutate canonical application or chain state.

### BG-16.9 — production notification closeout — IMPLEMENTED, RECONCILIATION/QUALIFICATION PENDING

- bounded load qualification records failures and p95 latency under explicit iteration/concurrency budgets;
- deterministic replay drill requires restored delivered IDs and checkpoint to converge exactly;
- canonicality drill requires local height/hash to match canonical state before merge readiness;
- provider-degradation drill proves one failing provider does not suppress unaffected delivery channels;
- closeout decision fails closed unless load, replay, canonicality and provider-isolation gates all pass;
- operator runbook: `docs/BONG-GOGGLES-BG-16-9-RUNBOOK.md`;
- phase branch must be reconciled with current `main` before final qualification;
- reconciled exact head must pass Bong Goggles Indexer, Games, Media, 420Docs and 420 Integrated workflows;
- PR #330 remains unmerged until exact-head qualification is green and merge is explicitly performed.

## Remaining product phases after BG-16

- **BG-17 — moderation operations**
- **BG-18 — rewards production configuration**
- **BG-19 — full web application + public-facing UI**
- **BG-20 — launch hardening**

## Current position

**Phase 15 is merged in PR #321. BG-16.1 through BG-16.8 are qualified. Current work: BG-16.9 production notification closeout on PR #330 / `feature/bong-goggles-bg16-notifications`.**

Critical path:

`BG-16.9 production closeout -> merge Phase 16 -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
