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

## Phase 13 — media/storage delivery — COMPLETE, merged PR #308

BG-13 integrates Bong Goggles with the already-built media/storage infrastructure instead of creating a second protocol. `BongGogglesMediaRegistry420` remains the canonical Bong Goggles manifest registry; 420Store owns canonical storage agreements/commitments/manifests/placements/proofs; 420Storage is the frozen v1 developer adapter; 420Gateway/420Cache/420Repair provide operational delivery; and 420Media provides bounded derivative-processing jobs.

- **BG-13.1 — media descriptor + canonical resolver — COMPLETE AND QUALIFIED**
- **BG-13.2 — upload preparation + ingest bridge — COMPLETE AND QUALIFIED**
- **BG-13.3 — canonical placement/seal orchestration — COMPLETE AND QUALIFIED**
- **BG-13.4 — verified retrieval + Gateway delivery — COMPLETE AND QUALIFIED**
- **BG-13.5 — thumbnails/posters/transcodes — COMPLETE AND QUALIFIED**
- **BG-13.6 — lifecycle/edit/delete/privacy semantics — COMPLETE AND QUALIFIED**
- **BG-13.7 — production delivery closeout — COMPLETE AND QUALIFIED**

BG-13 was reconciled with `main`, exact-head qualified against Bong Goggles Media Verification, 420Docs Qualification and 420 Integrated Qualification, then merged as PR #308. Detailed requirements and operational procedures remain in `docs/BONG-GOGGLES-BG-13.md` and `docs/BONG-GOGGLES-BG-13-7-RUNBOOK.md`.

## Phase 14 — full private messaging — IN PROGRESS

BG-14 builds the Bong Goggles application messaging layer over 420Messenger and `BongGogglesPrivateMessaging420`; plaintext/ciphertext and key material remain off-chain and no parallel messaging authority is introduced.

- **BG-14.1 — conversation/request projection + canonical context resolver — IN PROGRESS**
  Canonical request/active/closed conversation projection, incoming/outgoing request state, current block/social-policy revalidation, exact Bong Goggles private-context binding checks, and wallet-authorized request/accept/close/bind intents.
- **BG-14.2 — encrypted send/receive bridge — NEXT**
  Envelope/sequence/epoch coordination over 420Messenger without exposing plaintext or duplicating canonical envelope authority.
- **BG-14.3 — inbox, unread/read and request state**
  Canonical conversation/envelope/receipt-derived inbox views, unread counters, pagination and reorg-safe refresh.
- **BG-14.4 — permitted group threads**
  Group-thread application contexts with current membership/epoch enforcement while keeping 420Commons authoritative for public/community channels.
- **BG-14.5 — private attachments**
  Reuse BG-13/420Storage object identity and verified delivery with conversation-level authorization.
- **BG-14.6 — safety, devices, epoch rotation and recovery**
  Blocks, spam/request controls, device-key lifecycle, stale-device handling, epoch rotation and recovery.
- **BG-14.7 — production messaging closeout**
  Secret-redacted observability, failure/replay/device/attachment drills, load qualification, runbook, reconciliation and exact-head closeout.

Detailed BG-14 invariants and requirements are in `docs/BONG-GOGGLES-BG-14.md`.

## Remaining product phases after BG-14

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

**Phase 12 is merged in PR #307. Phase 13 is merged in PR #308. Current work: BG-14.1 on `feature/bong-goggles-bg14-private-messaging`.**

Critical path:

`BG-14.1 conversation/request projection -> BG-14.2 encrypted send/receive -> BG-14.3 inbox/read state -> BG-14.4 group threads -> BG-14.5 attachments -> BG-14.6 safety/device/epoch recovery -> BG-14.7 production closeout -> BG-15 games -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
