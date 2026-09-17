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

### BG-16.4 — games + messaging emitters — IMPLEMENTED, QUALIFICATION PENDING

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

### BG-16.5 — moderation, appeals + rewards emitters — NEXT

- moderation action/status notifications;
- appeal lifecycle updates;
- reward-earned/payout-status presentation sourced from qualified reward state;
- no notification can redefine moderation/reward canonical truth.

### BG-16.6 — preference + delivery integration

- connect Bong Goggles topic/kind vocabulary to 420Notifications subscriptions;
- granular per-topic/per-class controls;
- in-app/web/push delivery handoff;
- mute/unmute/unsubscribe behavior remains 420Notifications-owned;
- promotional consent remains separate and opt-in.

### BG-16.7 — notification centre application surfaces

- unread counts and paged history;
- deep links back to the canonical Bong Goggles subject;
- finalized/retracted/superseded presentation states;
- degraded-notification UX points users back to canonical app/Wallet/Explorer state.

### BG-16.8 — abuse, privacy + recovery hardening

- rate/fan-out abuse controls;
- redacted structured telemetry;
- replay/restart recovery;
- provider failure isolation;
- private-source exclusion regression tests;
- canonical/local divergence cannot be hidden by notification state.

### BG-16.9 — production notification closeout

- bounded load/latency qualification;
- deterministic replay and canonicality drills;
- provider-degradation exercises;
- operator runbook;
- reconcile the phase branch with current `main`;
- exact-head qualification before merge.

## Remaining product phases after BG-16

- **BG-17 — moderation operations**
- **BG-18 — rewards production configuration**
- **BG-19 — full web application + public-facing UI**
- **BG-20 — launch hardening**

## Current position

**Phase 15 is merged in PR #321. BG-16.1 through BG-16.3 are qualified. Current work: BG-16.4 games + messaging emitters on PR #330 / `feature/bong-goggles-bg16-notifications`.**

Critical path:

`BG-16.4 games/messages -> BG-16.5 moderation/rewards -> BG-16.6 preferences/delivery -> BG-16.7 notification centre -> BG-16.8 hardening -> BG-16.9 closeout -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
