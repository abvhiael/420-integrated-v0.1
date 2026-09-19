# BG-19.14 — End-to-end product journeys and integration closeout

## What this increment actually qualifies

`bong-goggles/web/core/journey-gates.js` defines ten explicit product-journey gates. Its test suite exercises missing qualified bindings, network/account downgrade, the distinction between a visible page and a functional journey, canonical refresh, and public-page HTTP visibility requirements. These are **readiness assertions**, not an E2E browser run or a claim that backend integrations exist. No UI-only state is treated as contract, reward, message, or moderation authority.

## Verified code-level gap

At this increment `bong-goggles/web/app.js` creates service clients and calls `renderApplicationShell` **without passing feature projections**. The shell accepts optional `profileProjection`, `relationshipProjection`, `feedProjection`, `storyProjection`, `communityProjection`, `messagingProjection`, `discoveryProjection`, `gamesProjection`, `notificationsProjection`, `rewardsProjection`, and `safetyProjection`, but a feature renderer's ability to accept injected data is not an HTTP transport. The existing typed service clients only expose generic JSON requests; no verified route-specific, authorized, account-bound browser controllers and deployment/ABI action bindings are established by those constructors.

Critical journeys remain blocked until they have an audited transport and tests against running qualified services:

- Wallet/profile/social graph: canonical profile and relationship reads, capability-policy checks, transaction binding, and authoritative post-receipt refresh.
- Publishing/media: cursor-based canonical feed read, qualified upload/registration, contract address and ABI binding, Wallet submission, and canonical refresh.
- Communities and discovery: privacy-aware directory/detail/search reads and actual contract intent submission; withdrawn/blocked records must not leak from old results.
- Messenger: end-to-end encrypted envelope transport, device-key/session-policy enforcement, authorized thread reads, send and reconnect tests; never reuse a generic public JSON endpoint for private plaintext.
- Games: canonical session-list and per-session detail transport, qualified ruleset/turn engine, zero-wager action bindings, and refresh; current `/games?session=...` links are not sufficient for reliable detail recovery because the browser startup does not load a session projection.
- Notifications, rewards and safety: account-scoped lifecycle reads plus separately qualified preference/claim/report/appeal write bindings. Never treat pending or local results as finalized.
- Public pages: server-verified visibility and actual HTTP 404/410 plus per-response SEO headers; client-side `noindex` alone does not close this gate.

## Release acceptance matrix

For each journey: supply a concrete versioned deployment binding with auditable contract/service source, authorization requirements, an actual browser transport path, a deterministic fixture and live staging test, expected invalidation after wallet/account/network/policy changes, a failure/degraded test, and receipt/refresh validation for writes. Only then set `qualified:true, available:true` for the corresponding journey binding. The current production web bundle does **not** provide those validated bindings, so do not set them in a deployment config just to make the gate green.

## BG-19 status

This increment implements an executable, fail-closed journey-readiness model and gap inventory. It does not claim full BG-19.14 end-to-end completion or production readiness. Proceed to BG-19.15 only after the unresolved service/controller/contract integrations, browser E2E journeys and BG-19.11–19.13 security/accessibility/performance release gates are closed and evidenced.
