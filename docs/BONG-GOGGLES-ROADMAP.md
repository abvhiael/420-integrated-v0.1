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
- **BG-12.2 — domain materialized views — COMPLETE, merged PR #146**
- **BG-12.3 — canonical contract-event adapters + durable checkpoint recovery — COMPLETE**
- **BG-12.4 — pages/groups/events + discovery/review reducers — COMPLETE**
- **BG-12.5 — search + recommendation query service — COMPLETE**
- **BG-12.6 — notification/event pipeline — COMPLETE**
- **BG-12.7 — production ingestion/operations closeout — COMPLETE**

Phase 12 was implemented monolithically from BG-12.3 through BG-12.7, exact-head qualified against Bong Goggles Indexer Verification, 420Docs Qualification and 420 Integrated Qualification, reconciled with `main` with zero base drift, and merged once as PR #307.

## Phase 13 — media/storage delivery — IN PROGRESS, PR #308

BG-13 integrates Bong Goggles with the already-built media/storage infrastructure instead of creating a second protocol. `BongGogglesMediaRegistry420` remains the canonical Bong Goggles manifest registry; 420Store owns canonical storage agreements/commitments/manifests/placements/proofs; 420Storage is the frozen v1 developer adapter; 420Gateway/420Cache/420Repair provide operational delivery; and 420Media provides bounded derivative-processing jobs.

- **BG-13.1 — media descriptor + canonical resolver — COMPLETE AND QUALIFIED**
  Versioned deterministic Bong Goggles media descriptor, explicit 420Storage object identity, canonical owner/type/item-count/digest verification, derivative linkage, tamper detection, and fail-closed resolution of the off-chain descriptor referenced by `BongGogglesMediaRegistry420.manifestHash`.
- **BG-13.2 — upload preparation + ingest bridge — COMPLETE AND QUALIFIED**
  Exact 420Storage v1 prepare DTO translation, agreement/reservation/commitment preconditions, descriptor-bound deterministic idempotency, prepare-plan validation, ingest receipt identity/root/size verification and explicitly non-authoritative upload evidence. Existing 420Storage remains responsible for bounded staging, byte hashing, provider discovery and sink delivery.
- **BG-13.3 — canonical placement/seal orchestration — COMPLETE AND QUALIFIED**
  Canonical manifest/agreement/commitment/placement reads; fail-closed owner/object/erasure/root/size/commitment/node provenance validation; exact `registerPlacement` and `sealManifest` transaction intents requiring user/wallet authorization; canonical agreement/liveness evidence; and delivery readiness gated on `isRetrievable` rather than merely `isSealed`.
- **BG-13.4 — verified retrieval + Gateway delivery — COMPLETE AND QUALIFIED**
  Exact 420Storage v1 retrieval DTOs, full-object identity/size/SHA-256 verification before delivery, GET/HEAD semantics, single byte-range responses, default-deny private access with trusted reauthorization, canonical delivery-readiness gating, and non-authoritative Gateway/Cache route metadata.
- **BG-13.5 — thumbnails/posters/transcodes — COMPLETE AND QUALIFIED**
  Launch-safe derivative roles, operator-controlled 420Media capability/profile mappings, deterministic opaque source references, media-job creation/result binding, fail-closed terminal-state validation, returned 420Storage identity checks, optional canonical storage verification, explicit original→derivative provenance, and secret-free job/operator/result/SLA provenance.
- **BG-13.6 — lifecycle/edit/delete/privacy semantics — COMPLETE AND QUALIFIED**
  Canonical social-object/version media-root binding, current-versus-historical presentation state, hidden/deleted/removed fail-closed delivery, immutable storage-history preservation, delivery-time audience reauthorization through canonical social policy, retention/tombstone semantics, and derivative retirement without rewriting provenance.
- **BG-13.7 — production delivery closeout — IN PROGRESS**
  Immutable verified-object cache identity, public/private cache-control policy, responsive image/video source selection, latency/integrity/route telemetry, secret-redacted structured logs, provider/cache/retrieval failure drills, bounded load qualification, launch-readiness evaluation and operator runbook.

Detailed BG-13 invariants and phase requirements are in `docs/BONG-GOGGLES-BG-13.md`. BG-13.7 operational procedures are in `docs/BONG-GOGGLES-BG-13-7-RUNBOOK.md`.

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
  Build and deploy the complete Bong Goggles web product at **`bonggoggles.420integrated.org`**, including onboarding, profiles, feeds, composer, media, pages/groups/events, discovery, messaging, games, notifications, settings, safety/moderation, rewards, responsive/accessibility work and production hosting.
- **BG-20 — launch hardening**
  End-to-end testnet/production-like qualification, threat-model verification, permission/session abuse tests, privacy/audience leakage tests, rate/DoS limits, performance/load testing, disaster recovery, accessibility review, browser/device matrix, deployment manifests and launch runbooks.

## Current position

**Phase 12 is merged to `main` in PR #307. BG-13.1 through BG-13.6 are complete and qualified. Current work: BG-13.7 production delivery closeout on PR #308 / `feature/bong-goggles-bg13-media-storage`.**

Critical path:

`BG-13.7 production closeout -> BG-14 messaging -> BG-15 games -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
