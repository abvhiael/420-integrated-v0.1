# Bong Goggles Roadmap

Bong Goggles is the 420 Integrated social layer: an old-Facebook-style network combining profiles, friends/follows, statuses, photos, stories, pages, groups, events, private messaging, casual games, discovery/reviews, search, recommendations, rewards, safety/moderation and wallet-native identity/session access.

Production web target: `https://bonggoggles.420integrated.org`.

## Delivery rule from BG-12.3 onward

Phase 12 is monolithic. BG-12.3 through BG-12.7 are developed on `feature/bong-goggles-phase12-monolithic`, qualified together, reconciled with `main`, and merged only once the complete Phase 12 production backend/indexer is finished.

## Completed foundation

- **Phase A / PR #55 — social foundation — COMPLETE**
  Canonical IDs/capabilities, one-profile-per-account, relationship graph, block/mute, social objects, comments and audience foundations.
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
  Zero-value session execution, canonical Capability Registry scope checks, auth-epoch invalidation and owner/passkey escalation for sensitive actions.

## Phase 12 — production application/indexer backend

- **BG-12.1 — deterministic projector/reorg foundation — COMPLETE, merged PR #140**
  Deterministic event identity/order, exact replay idempotency, reorg detection, rollback/replay, provenance-carrying projections, deterministic state roots and schema/snapshot-bound cursors.
- **BG-12.2 — domain materialized views — COMPLETE, merged PR #146**
  Profiles, social objects, relationship edges and feed-entry projections; stale-edge/feed deletion; inactive/deleted filtering; deterministic ordering and view digests.
- **BG-12.3 — canonical contract-event adapters + durable checkpoint recovery — COMPLETE ON PHASE-12 BRANCH**
  Real Bong Goggles contract-event adapters, canonical state hydration for incomplete event payloads, deterministic mutation reduction, persistent event-stream/checkpoint storage, state-root verification, corruption detection and canonical reorg rollback recovery. Qualified on the monolithic branch before BG-12.4 began.
- **BG-12.4 — pages/groups/events + discovery/review reducers — COMPLETE ON PHASE-12 BRANCH**
  Canonical reducers for pages, groups, membership/roles, events/RSVPs, discovery subjects, reviews, corrections and verification attestations. Review replacement/withdrawal state is preserved and stale removed membership is deleted. Qualified on the monolithic branch before BG-12.5 began.
- **BG-12.5 — search + recommendation query service — COMPLETE ON PHASE-12 BRANCH**
  Deterministic search-class candidate retrieval/ranking, snapshot-bound pagination, canonical cursor binding, query-time canonical eligibility revalidation, recommendation candidate generation/model binding and freshness envelopes. The backend fails closed without a canonical eligibility provider and never treats materialized active/privacy state as authority. Qualified on the monolithic branch before BG-12.6 began.
- **BG-12.6 — notification/event pipeline — COMPLETE ON PHASE-12 BRANCH**
  Deterministic non-authoritative notification candidates for relationship, safety, group, event and discovery activity; canonical state hydration where recipient context is omitted; provenance preservation; self-notification suppression; replay deduplication; restart-safe presentation checkpointing; and append-only finalized/retracted/superseded canonicality updates compatible with 420Notifications. Qualified on the monolithic branch before BG-12.7 began.
- **BG-12.7 — production ingestion/operations closeout — IMPLEMENTED, FINAL PHASE-12 QUALIFICATION PENDING**
  Provider-neutral RPC/log ingestion, deployment-address validation/configuration, confirmation-safe block processing, bounded reorg recovery, restart/replay behavior, pluggable durable-store boundary, deterministic full-rebuild verification, health/lag metrics, structured logs, alert guidance and production operator runbook.

**Phase-12 merge gate:** BG-12.3 through BG-12.7 complete, all indexer tests green, 420 Integrated qualification green, deterministic rebuild verified, current `main` reconciled, then one Phase-12 merge.

## Remaining product phases after Phase 12

- **BG-13 — media/storage delivery**
  Production media upload flow, 420 Storage integration, manifest resolution, thumbnails/transcodes, image/video delivery, CDN/cache strategy, lifecycle/deletion semantics and client-safe media URLs.
- **BG-14 — full private messaging**
  Build application messaging UX over 420Messenger/Bong Goggles private contexts: conversations, requests, group threads where permitted, unread/read state, attachments, safety controls, epoch rotation and recovery behavior.
- **BG-15 — social games application**
  User-facing challenge/invite/session flows, casual game surfaces, results/history and rewards integration while keeping game settlement/authority canonical.
- **BG-16 — notifications**
  User notification inbox, push/browser notification delivery, preferences, read state, batching/digest behavior and deep links.
- **BG-17 — moderation operations**
  Moderator/admin console, report queues, evidence views, appeals, restrictions/removals, audit history and emergency tooling around the existing safety contracts.
- **BG-18 — rewards production configuration**
  Final reward policies, rate limits, abuse controls, eligibility, treasury/funding configuration, accounting views and launch qualification.
- **BG-19 — full web application + public-facing UI**
  Build and deploy the complete Bong Goggles web product at **`bonggoggles.420integrated.org`**.

  Required web surfaces include:
  - landing/sign-in/wallet-connect/passkey onboarding
  - account/profile creation and edit pages
  - home/feed and following feed
  - composer for status/photo/media posts
  - object/post detail and comment threads
  - profile timelines, friends/followers/following
  - friend/follow requests
  - search results and discovery/recommendation pages
  - pages and groups: directory, detail, membership, admin/role surfaces
  - events: directory, event detail, RSVP and attendee views
  - discovery/reviews/place/product/brand/resource pages
  - media viewer/gallery/story-style surfaces where supported
  - private messages/inbox/conversation views
  - game invites/sessions/history
  - notifications center
  - account/privacy/session/security settings
  - block/mute/report controls
  - moderation/appeals flows for affected users
  - rewards/activity views
  - responsive mobile/tablet/desktop layouts
  - accessible navigation, keyboard/focus behavior and WCAG-oriented semantics
  - SEO/OpenGraph/public-profile metadata where privacy policy permits
  - error/offline/loading/retry states

  Hosting/deployment work includes DNS/TLS for `bonggoggles.420integrated.org`, environment separation, API/indexer endpoints, CSP/security headers, analytics/observability, cache/CDN policy and production deployment automation.
- **BG-20 — launch hardening**
  End-to-end testnet/production-like qualification, threat-model verification, permission/session abuse tests, privacy/audience leakage tests, rate/DoS limits, performance/load testing, disaster recovery, accessibility review, browser/device matrix, deployment manifests and launch runbooks.

## Current position

**BG-12.3 through BG-12.7 are implemented on the monolithic Phase-12 branch. Current work: final Phase-12 qualification, reconciliation with current `main`, requalification of the reconciled head, then the single PR #307 merge.**

Critical path:

`Phase-12 final qualification/reconciliation/merge -> BG-13 media/storage -> BG-14 messaging -> BG-15 games -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI at bonggoggles.420integrated.org -> BG-20 launch hardening -> READY`
