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

## Phase 16 — notifications — ACTIVE

Branch: `feature/bong-goggles-bg16-notifications`

BG-16 integrates the production Bong Goggles application with the existing 420Notifications service. Notifications remain presentation-only, opt-in through 420Notifications, non-authoritative and unable to sign transactions or mutate canonical state. Private Messenger payloads, encrypted content, private Identity fields and raw Attention telemetry remain excluded.

### BG-16.1 — notification taxonomy + 420Notifications boundary — IMPLEMENTED, QUALIFICATION PENDING

- freeze the application notification kind/topic catalog;
- validate Bong Goggles candidates before handoff to `420/service/notifications/v1`;
- preserve the BG-12.6 deterministic/provenance/non-authority guarantees;
- reserve production classes for relationships, interactions, groups, events, games, messages, moderation/appeals, rewards, discovery and safety;
- Messenger notifications are metadata-only and explicitly forbid private/encrypted payload carriage;
- subscription state, channels, rate limits, provider retry state and promotional consent remain owned by 420Notifications.

### BG-16.2 — relationships + interaction emitters — NEXT

- incoming friend requests and accepted requests;
- follows;
- comments/replies;
- mentions and tags;
- policy/block revalidation before emission;
- self-notification suppression and deterministic replay deduplication.

### BG-16.3 — groups + events emitters

- group join requests, approvals/removals and material group activity;
- event invitations, RSVP/material event changes;
- canonical ownership/membership hydration where recipient context is not carried by the source event.

### BG-16.4 — games + messaging emitters

- game invites, invite acceptance, turn-ready and game-finished notices;
- strict zero-wager boundary preservation;
- Messenger notification metadata only, never plaintext/ciphertext/private payload indexing;
- reuse BG-14 conversation/session authorization rather than creating notification authority.

### BG-16.5 — moderation, appeals + rewards emitters

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

**Phase 15 is merged in PR #321. Current work: BG-16.1 notification taxonomy + 420Notifications boundary on `feature/bong-goggles-bg16-notifications`.**

Critical path:

`BG-16.1 notification boundary -> BG-16.2 relationships/interactions -> BG-16.3 groups/events -> BG-16.4 games/messages -> BG-16.5 moderation/rewards -> BG-16.6 preferences/delivery -> BG-16.7 notification centre -> BG-16.8 hardening -> BG-16.9 closeout -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
