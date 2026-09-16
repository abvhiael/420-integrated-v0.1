# Bong Goggles Roadmap

Bong Goggles is the 420 Integrated social layer: an old-Facebook-style network combining profiles, friends/follows, statuses, photos, stories, pages, groups, events, private messaging, casual games, discovery/reviews, search, recommendations, rewards, safety/moderation and wallet-native identity/session access.

Production web target: `https://bonggoggles.420integrated.org`.

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

## Phase 12 — production application/indexer backend — COMPLETE, merged PR #307

- **BG-12.1 — deterministic projector/reorg foundation — COMPLETE, merged PR #140**
  Deterministic event identity/order, exact replay idempotency, reorg detection, rollback/replay, provenance-carrying projections, deterministic state roots and schema/snapshot-bound cursors.
- **BG-12.2 — domain materialized views — COMPLETE, merged PR #146**
  Profiles, social objects, relationship edges and feed-entry projections; stale-edge/feed deletion; inactive/deleted filtering; deterministic ordering and view digests.
- **BG-12.3 — canonical contract-event adapters + durable checkpoint recovery — COMPLETE**
- **BG-12.4 — pages/groups/events + discovery/review reducers — COMPLETE**
- **BG-12.5 — search + recommendation query service — COMPLETE**
- **BG-12.6 — notification/event pipeline — COMPLETE**
- **BG-12.7 — production ingestion/operations closeout — COMPLETE**

Phase 12 was implemented monolithically from BG-12.3 through BG-12.7, exact-head qualified against Bong Goggles Indexer Verification, 420Docs Qualification and 420 Integrated Qualification, reconciled with `main` with zero base drift, and merged once as PR #307.

## Phase 13 — media/storage delivery — IN PROGRESS

BG-13 integrates Bong Goggles with the already-built media/storage infrastructure instead of creating a second protocol. `BongGogglesMediaRegistry420` remains the canonical Bong Goggles manifest registry; 420Store owns canonical storage agreements/commitments/manifests/placements/proofs; 420Storage is the frozen v1 developer adapter; 420Gateway/420Cache/420Repair provide operational delivery; and 420Media provides bounded derivative-processing jobs.

- **BG-13.1 — media descriptor + canonical resolver — IN PROGRESS**
  Versioned deterministic Bong Goggles media descriptor, explicit 420Storage object identity, canonical owner/type/item-count/digest verification, derivative linkage, tamper detection, and fail-closed resolution of the off-chain descriptor referenced by `BongGogglesMediaRegistry420.manifestHash`.
- **BG-13.2 — upload preparation + ingest bridge — NEXT**
  420Storage v1 prepare/ingest coordination, local size/root verification, canonical storage preconditions, idempotency, bounded staging, transport receipt verification, and manifest-registration transaction preparation.
- **BG-13.3 — canonical placement/seal orchestration — REMAINS**
  Read canonical agreement/commitment/object-manifest state, expose user-authorized placement/seal transaction intents, verify retrievability threshold and preserve provider/node provenance.
- **BG-13.4 — verified retrieval + Gateway delivery — REMAINS**
  GET/HEAD/range retrieval, exact size + shard-root verification, public/private access, Gateway/Cache routing and stable client-safe delivery envelopes.
- **BG-13.5 — thumbnails/posters/transcodes — REMAINS**
  Bounded 420Media derivative jobs, image thumbnails, video posters/previews/transcodes, derivative storage and original/derivative provenance.
- **BG-13.6 — lifecycle/edit/delete/privacy semantics — REMAINS**
  Social-object version/media-root changes, presentation eligibility, retention/tombstone behavior, private authorization revalidation and safe derivative retirement.
- **BG-13.7 — production delivery closeout — REMAINS**
  CDN/cache policy, responsive asset selection, observability, integrity/route alerts, provider-loss/retrieval-failure drills, load qualification and operator runbooks.

Detailed BG-13 invariants and phase requirements are in `docs/BONG-GOGGLES-BG-13.md`.

## Remaining product phases after BG-13

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

**Phase 12 is merged to `main` in PR #307. Current work: BG-13.1 on `feature/bong-goggles-bg13-media-storage`.**

Critical path:

`BG-13 media/storage -> BG-14 messaging -> BG-15 games -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI at bonggoggles.420integrated.org -> BG-20 launch hardening -> READY`
