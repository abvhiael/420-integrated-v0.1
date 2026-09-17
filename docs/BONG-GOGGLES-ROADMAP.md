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

## Phase 14 — full private messaging — IN PROGRESS, PR #314

BG-14 builds the Bong Goggles application messaging layer over 420Messenger and `BongGogglesPrivateMessaging420`; plaintext/ciphertext and key material remain off-chain and no parallel messaging authority is introduced.

- **BG-14.1 — conversation/request projection + canonical context resolver — COMPLETE AND QUALIFIED**
- **BG-14.2 — encrypted send/receive bridge — COMPLETE AND QUALIFIED**
- **BG-14.3 — inbox, unread/read and request state — COMPLETE AND QUALIFIED**
- **BG-14.4 — permitted group threads — COMPLETE AND QUALIFIED**
  Application-level private group-thread descriptors derive eligibility from canonical `BongGogglesCommunityRegistry420` membership. Group delivery fans out over canonical direct Messenger/private contexts, with deterministic membership digests, group-epoch invalidation on membership/role change, current membership revalidation and fail-closed recipient routing. Public/Commons channels remain separate authority.
- **BG-14.5 — private attachments — IN PROGRESS**
  Reuses BG-13 canonical mediaRoot/manifest/item/420Storage object identity and verified upload/retrieval machinery. Messaging adds exact active conversation/private-context/current-epoch binding, current block/message-policy checks, owner-only upload association, participant-only read authorization, secret/private-route exclusion and lifecycle-driven presentation revocation without rewriting immutable storage provenance.
- **BG-14.6 — safety, devices, epoch rotation and recovery**
  Blocks, spam/request controls, device-key lifecycle, stale-device handling, epoch rotation and recovery.
- **BG-14.7 — production messaging closeout**
  Secret-redacted observability, failure/replay/device/attachment drills, load qualification, runbook, reconciliation and exact-head closeout.

Detailed BG-14 invariants and requirements are in `docs/BONG-GOGGLES-BG-14.md`.

## Remaining product phases after BG-14

- **BG-15 — social games application**
- **BG-16 — notifications**
- **BG-17 — moderation operations**
- **BG-18 — rewards production configuration**
- **BG-19 — full web application + public-facing UI**
- **BG-20 — launch hardening**

## Current position

**Phase 12 is merged in PR #307. Phase 13 is merged in PR #308. Current work: BG-14.5 private attachments on PR #314 / `feature/bong-goggles-bg14-private-messaging`.**

Critical path:

`BG-14.5 attachments -> BG-14.6 safety/device/epoch recovery -> BG-14.7 production closeout -> BG-15 games -> BG-16 notifications -> BG-17 moderation ops -> BG-18 rewards config -> BG-19 web UI -> BG-20 launch hardening -> READY`
