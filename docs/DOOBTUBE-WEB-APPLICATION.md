# DoobTube — user-facing web application

Roadmap step: **DOOBTUBE-7 — User-facing web application**
Status: **ADOPTED / IMPLEMENTED**
Date: 2026-10-06

## 1. Purpose

DOOBTUBE-7 implements the production-intended static browser application for the canonical DoobTube V1 workflows.

The client remains replaceable presentation. It does not become Wallet, Identity, Media, Rights, Storage, Search, Notifications, Pay, Compute, moderation or protocol authority.

Application root:

`doobtube/web`

## 2. Canonical user surfaces

Hash routes provide static-host-safe equivalents for all required V1 surfaces:

- `#/home` — public discovery;
- `#/search` — public Search;
- `#/watch/:mediaId` — media detail/playback;
- `#/creator/:creatorRef` — creator/channel presentation;
- `#/library` — creator library;
- `#/upload` — upload/publish;
- `#/live` — livestream create/control;
- public live playback is represented through qualified media detail/playback when the Media service supplies it;
- `#/subscriptions` — creator-update preferences/subscription state;
- `#/moderation` — report/appeal;
- `#/data` — export/delete capability status;
- `#/status` — Wallet/network/runtime/session status.

Unknown routes fail safely to home.

## 3. Public anonymous mode

### DT-WEB-001 — No forced Wallet

Public home, Search, eligible playback and creator presentation can load without a Wallet.

Wallet connection is requested only for authority-bearing creator/controller/subscription/moderation/preference actions.

### DT-WEB-002 — Public feed

DoobTube consumes the DOOBTUBE-5 public feed and renders it as non-authoritative presentation.

Loading, empty, error and pagination states are explicit.

### DT-WEB-003 — Search

Search uses the qualified Media public `GET /v1/search` boundary.

No-results and service failure are different states.

Search rank is never rendered as canonical status.

## 4. Wallet / network

### DT-WEB-WALLET-001 — Injected Wallet only

The browser uses `eth_requestAccounts` and `eth_chainId` from an injected provider.

### DT-WEB-WALLET-002 — Network validation

Authority-bearing actions require the configured canonical chain ID.

Wrong-network connection fails closed while anonymous public browsing remains usable.

### DT-WEB-WALLET-003 — Authority invalidation

`accountsChanged`, disconnect and `chainChanged` invalidate:

- connected Wallet context;
- selected livestream authority state;
- in-memory retry/idempotency context.

### DT-WEB-WALLET-004 — No private-key custody

No private key, seed phrase or mnemonic is accepted or stored.

No localStorage/sessionStorage/IndexedDB authority cache is used.

## 5. Media detail / safe rendering

### DT-WEB-PLAY-001 — Service-supplied locator

The browser never derives playback URLs from Storage IDs.

### DT-WEB-PLAY-002 — Safe URL policy

Playback accepts only:

- HTTPS;
- browser `blob:`;
- loopback HTTP for repository/development preview.

Embedded URL credentials and unsafe schemes are rejected.

### DT-WEB-PLAY-003 — Native controls

The video element uses:

- native controls;
- `playsinline`;
- `preload=metadata`;
- no forced autoplay.

Playback failure changes only presentation state.

### DT-WEB-PLAY-004 — Safe remote text

Service-provided titles, creator refs, states and provenance are inserted using `textContent`/created text nodes, never dynamic `innerHTML`.

## 6. Creator/channel

Creator presentation is keyed by the service-provided creator/controller reference.

A creator page can display public feed items and offer creator-update subscription.

This remains presentation grouping, not a new channel authority.

Identity remains optional.

## 7. Creator library

Connected creators can load the Media asset library with explicit:

- loading;
- empty;
- populated;
- load-more;
- error;
- reconnect/revalidation-required states.

A disconnected Wallet does not cause public browsing to fail.

## 8. Upload / publication

The browser upload flow:

1. requires valid Wallet/network;
2. accepts `video/*`;
3. selects PRIVATE/UNLISTED/PUBLIC;
4. requires Storage agreement/capacity references;
5. computes SHA-256 in browser;
6. creates deterministic request-side object/provenance inputs;
7. issues idempotent Media prepare;
8. retains exact retry key/payload/file **in memory only**;
9. uploads bytes only to qualified HTTPS transport;
10. polls canonical Media state;
11. reports success only after `READY`.

Transport acceptance is shown as pending, never READY.

Retry reuses the exact prepared request/idempotency identity.

Page reload intentionally loses in-memory file/retry authority.

## 9. Livestream

The browser implements:

- create;
- canonical status refresh;
- start;
- stop.

Inputs include:

- session ID;
- stream reference;
- protocol;
- direction;
- endpoint;
- opaque credential reference;
- bounded duration.

Every action requires Wallet/network validity.

Start/stop failure explicitly tells the user to refresh canonical status before retrying; local state never assumes remote success.

## 10. Subscriptions / preferences

Creator-update subscription uses the existing Media notification-subscription route.

Payload explicitly sets:

`promotional_opt_in: false`

The UI states that subscriptions are:

- opt-in;
- reversible at the owning service boundary;
- not paid entitlement;
- not required for public playback.

DoobTube preferences use the DOOBTUBE-5 control-plane route and an idempotency key.

## 11. Reporting / appeals

Report uses:

`POST /v1/moderation/reports`

with Wallet-bound reporter, MediaAsset target, reason and optional opaque evidence reference.

Appeal uses:

`POST /v1/moderation/decisions/:id/appeals`

with Wallet-bound appellant and reason.

The UI explicitly states:

- report submission does not itself hide/delete/transfer media;
- appeal submission does not rewrite prior decision history.

## 12. Delete / export honesty

Current repository Media API does **not** expose a qualified delete or export endpoint.

Therefore the V1 web surface:

- includes the required Data surface;
- renders delete/export controls disabled;
- explains why they are unavailable;
- does not invent Storage access;
- does not claim immutable history erasure;
- does not fabricate an export result.

This preserves DOOBTUBE-1's "when supported / once runtime implements it" condition.

## 13. Fail-closed runtime configuration

Canonical runtime schema:

`doobtube-web-runtime-v1`

Repository defaults leave unresolved:

- production origin;
- chain ID;
- network;
- DoobTube API base URL;
- Media API base URL;
- Search API base URL;
- Notifications API base URL.

Exact service identities remain pinned:

- `420/service/media/v1`;
- `420/service/search/v1`;
- `420/service/notifications/v1`.

Repository preview therefore cannot imply a deployment.

Runtime config rejects:

- non-null production origin before deployment;
- invalid chain/network;
- insecure non-loopback HTTP;
- URL credentials/fragments;
- wrong service IDs;
- secret-like configuration fields.

## 14. Accessibility

Repository qualification enforces:

- semantic header/nav/main/section/footer structure;
- skip-to-content;
- headings and labels;
- keyboard-native controls;
- visible `:focus-visible`;
- `aria-live` status output;
- alert/status roles;
- native media controls;
- no color-only error/success dependency;
- reduced-motion CSS;
- safe text rendering.

## 15. Responsive behavior

The web application uses:

- fluid width shell;
- responsive auto-fit card grids;
- wrapping action rows;
- two-column detail/form layouts;
- mobile single-column fallback under 760 px;
- full-width video surface on narrow screens.

Core workflows do not depend on desktop-only layout.

## 16. Branding / assets

DoobTube branding is included through:

- title/name lockup;
- `brand.svg`;
- favicon use;
- dedicated dark video-oriented application styling.

The asset contains no external dependency and is included in the deterministic build.

## 17. Static build

`npm run build` creates `dist/` containing:

- index/404 fallback;
- application JS;
- core modules;
- CSS;
- fail-closed runtime config;
- DoobTube brand asset;
- generated security headers;
- build metadata.

Build metadata records:

- source SHA;
- null production origin;
- fail-closed execution state.

Security headers include:

- nosniff;
- no-referrer;
- DENY framing;
- restrictive Permissions Policy;
- CSP with no object/embed authority and no arbitrary script origin.

## 18. Frontend/browser fixture qualification

`npm run qualify` performs:

1. structural/security checks;
2. Node browser-facing unit/fixture tests;
3. deterministic static build.

Fixture coverage exercises:

- fail-closed runtime;
- exact service IDs;
- Wallet/wrong-network behavior;
- all canonical route names;
- safe playback URL validation;
- DoobTube public feed;
- Media asset detail;
- Search;
- creator-update subscription;
- moderation report;
- appeal;
- upload transport safety;
- in-memory retry invalidation.

The fixtures use the exact repository-qualified API paths rather than invented routes.

## 19. Security invariants

- **DT-WEB-INV-001:** public viewing does not require Wallet.
- **DT-WEB-INV-002:** Wallet mutations require configured expected chain.
- **DT-WEB-INV-003:** account/network change invalidates authority-sensitive client state.
- **DT-WEB-INV-004:** no private key/seed/mnemonic is accepted or persisted.
- **DT-WEB-INV-005:** retry/idempotency state is memory-only.
- **DT-WEB-INV-006:** upload transport success is not canonical READY.
- **DT-WEB-INV-007:** unsafe playback/upload URLs fail closed.
- **DT-WEB-INV-008:** remote text is never rendered through dynamic innerHTML.
- **DT-WEB-INV-009:** report/appeal UI cannot become canonical moderation finality.
- **DT-WEB-INV-010:** creator subscription is not a paid entitlement or marketing consent.
- **DT-WEB-INV-011:** unavailable delete/export cannot be fabricated client-side.
- **DT-WEB-INV-012:** unresolved runtime cannot become executable by assumption.
- **DT-WEB-INV-013:** route guards/buttons are presentation only, never protected-resource authority.
- **DT-WEB-INV-014:** static build claims no production/testnet deployment.

## 20. Exit decision

DOOBTUBE-7 is satisfied when:

1. every canonical V1 surface is represented;
2. Wallet and network validation are fail-closed;
3. loading/empty/error/pending/success states are explicit;
4. upload/live retries preserve canonical revalidation semantics;
5. media rendering is safe;
6. accessibility/responsive baseline is present;
7. DoobTube branding/assets are included;
8. runtime config is fail-closed and secret-free;
9. no private-key custody exists;
10. unsupported delete/export controls are honest and disabled;
11. static structural/security checks pass;
12. frontend/browser fixture tests pass;
13. static build passes;
14. retained DoobTube regressions and cumulative verifier pass on the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-8 — Ecosystem integration milestone.**
