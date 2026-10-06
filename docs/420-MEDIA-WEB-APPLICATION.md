# 420Media — User-facing application

Roadmap step: **MEDIA-AUDIT-10 — User-facing 420Media application**

## Purpose

MEDIA-AUDIT-10 delivers the first repository-qualified end-user 420Media application.

The application composes previously-qualified Media service boundaries without becoming protocol authority:

- 420Storage remains authoritative for canonical media availability;
- 420Identity/Wallet remain authoritative for user/controller context;
- 420Rights remains authoritative for rights-bearing publication/reuse;
- Media API/SDK remain the service boundary;
- Search/Notifications remain derived/non-canonical;
- livestream controller authority remains canonical Media stream state.

The web app never receives or stores wallet private keys.

## Application location

`media/web`

The application is a static browser application using the same repository pattern as other 420Integrated web surfaces:

- no framework dependency;
- Node structural/unit qualification;
- deterministic static build artifact;
- fail-closed runtime configuration;
- deployment-independent repository preview.

No production domain is claimed by this step.

## Runtime configuration

Canonical runtime schema:

`420-media-web-runtime-v1`

Repository defaults deliberately leave unresolved:

- production origin;
- Media API base URL;
- chain ID;
- network identifier.

The app therefore boots in repository-preview/fail-closed mode until deployment materializes canonical runtime values.

The configured Media service ID must be exactly:

`420/service/media/v1`

Runtime config rejects:

- a non-null production origin before deployment;
- invalid/nonpositive chain IDs;
- malformed network identifiers;
- insecure remote API/explorer URLs;
- embedded URL credentials;
- wrong Media service ID.

No API key, private key, seed phrase, mnemonic, authorization token or other secret is stored in runtime config.

## Wallet and network validation

Authority-bearing workflows require an injected wallet.

The application:

1. requests accounts through `eth_requestAccounts`;
2. reads `eth_chainId`;
3. validates the account shape;
4. requires the wallet chain to match the Media compatibility/runtime chain;
5. fails closed on mismatch;
6. invalidates local wallet/session/retry state when accounts or chain change.

The browser app does not store wallet authority in localStorage, sessionStorage or IndexedDB.

## Feature availability

Feature availability combines:

- repository/runtime feature configuration;
- Media `/v1/capabilities` discovery.

The application exposes explicit available/unavailable states.

Livestreaming honors canonical `media.livestreaming` capability state.

Unavailable features disable their authority-bearing controls rather than attempting speculative execution.

## Media library workflow

The library uses the stable Media API cursor contract.

UI states include:

- loading;
- populated;
- empty;
- error;
- pagination/load-more.

Asset cards show only service-provided presentation/state metadata.

Selecting an asset drives the playback surface.

Library/API failure never mutates canonical Media state.

## Playback workflow

MEDIA-AUDIT-10 extends the Media API presentation model with optional:

`playback_url`

This field is explicitly non-authoritative presentation/transport metadata.

Playback occurs only when:

- playback is feature-enabled;
- the service supplied a playback URL;
- the browser safety validator accepts the URL.

Accepted schemes:

- HTTPS;
- loopback HTTP for local development;
- browser `blob:` URLs.

Unsafe schemes such as `javascript:` are rejected.

The video element:

- uses native controls;
- does not autoplay;
- uses `preload=metadata`;
- supports inline playback;
- exposes failure state without changing asset authority.

A missing playback URL is shown honestly as unavailable rather than fabricated from an object ID.

## Upload workflow

The browser upload path is:

1. user selects a `video/*` file;
2. wallet/network must be valid;
3. user selects visibility;
4. required Storage agreement and capacity-reservation references are supplied;
5. browser computes SHA-256 of the selected file;
6. deterministic request-side object/provenance references are formed from that digest;
7. an idempotent `POST /v1/uploads/prepare` request is submitted;
8. the Media service returns a canonical prepared upload plan;
9. if a safe upload transport endpoint is materialized, bytes are uploaded directly to that off-chain transport;
10. the app polls Media asset state for canonical `READY`;
11. the library refreshes only after canonical readiness is observed.

The browser never claims that transport acceptance equals canonical readiness.

### Upload transport endpoint

MEDIA-AUDIT-10 extends `UploadPlan` with optional:

`endpoint`

The endpoint is an off-chain transport locator only.

It is accepted only when:

- HTTPS; or
- loopback HTTP for local development;
- no embedded URL credentials.

Raw media bytes are sent to that prepared transport, not embedded into a chain transaction and not posted into canonical contract state.

If no endpoint is materialized, the UI remains in PREPARED state and tells the user to retry after the service publishes one.

## Upload recovery

Upload preparation uses the stable API idempotency contract.

The browser retains retry data **in memory only** for the current page session:

- exact idempotency key;
- exact prepared payload;
- selected file;
- returned upload plan when available.

Failure semantics:

- prepare failure preserves retryability;
- transport failure does not claim upload completion;
- canonical-ready polling failure does not claim readiness;
- retry reuses the same prepared/idempotent request where appropriate;
- page reload intentionally clears the in-memory retry record rather than persisting authority-sensitive state.

## Livestream workflow

The app provides:

- create;
- status refresh;
- start;
- stop.

Create fields include:

- session ID;
- protocol;
- direction;
- endpoint;
- opaque credential reference;
- stream reference;
- bounded maximum duration.

The current wallet address is used as the controller request context.

Every authority-bearing livestream action requires:

- connected wallet;
- expected chain;
- livestream feature enabled.

Start/stop requests use independent idempotency keys.

If an action fails, the UI tells the user to refresh canonical status before retrying instead of assuming success/failure state locally.

Wallet account/network invalidation clears local livestream state.

## User-visible state model

The UI explicitly represents:

- runtime loading/ready/locked;
- wallet disconnected/connected/wrong-network;
- feature checking/available/unavailable;
- library loading/empty/error/populated;
- playback unavailable/ready/error;
- upload idle/preparing/uploading/waiting-ready/success/error;
- livestream idle/created/active/closed/error;
- transaction/action pending/success/error.

No skipped or failed operation is silently rendered as success.

## Accessibility basics

Repository qualification checks require:

- semantic `main`, sections, headings and forms;
- skip-to-content link;
- explicit labels for form controls;
- native buttons/selects/inputs/video controls;
- `aria-live` status regions;
- `role=status` / `role=alert` where appropriate;
- visible `:focus-visible` treatment;
- responsive single-column behavior on narrow displays;
- `prefers-reduced-motion` handling;
- no dynamic `innerHTML` assignment for remote/service content.

## Responsive behavior

The CSS uses:

- responsive grid layouts;
- fluid heading sizing;
- single-column mobile fallbacks;
- wrapping action rows;
- full-width media/video surfaces;
- responsive state cards.

No fixed desktop-only layout is required for core workflows.

## Build and security headers

`npm run build` creates a static `dist/` artifact containing:

- index;
- application JS;
- CSS;
- runtime config;
- core modules;
- 404 fallback;
- generated security headers;
- build metadata.

Security headers include:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: no-referrer`;
- `X-Frame-Options: DENY`;
- restrictive Permissions Policy;
- CSP limiting script/style/media/connect/image/frame sources.

Build metadata explicitly records:

- source SHA;
- no production origin claim;
- fail-closed runtime execution state.

## Security invariants

- **MEDIA-WEB-INV-001:** unresolved runtime never becomes executable by assumption.
- **MEDIA-WEB-INV-002:** no production Media domain is claimed without deployment evidence.
- **MEDIA-WEB-INV-003:** wallet/account changes invalidate local authority context.
- **MEDIA-WEB-INV-004:** wrong-network wallet state blocks authority-bearing actions.
- **MEDIA-WEB-INV-005:** no private key/seed/mnemonic is accepted or persisted.
- **MEDIA-WEB-INV-006:** retry/idempotency state is memory-only.
- **MEDIA-WEB-INV-007:** upload transport acceptance is not canonical READY state.
- **MEDIA-WEB-INV-008:** unsafe upload/playback URLs fail closed.
- **MEDIA-WEB-INV-009:** feature-disabled actions remain disabled.
- **MEDIA-WEB-INV-010:** service/API failures do not mutate canonical state.
- **MEDIA-WEB-INV-011:** livestream action failure requires status revalidation before user retry.
- **MEDIA-WEB-INV-012:** service-provided text is rendered with textContent, not dynamic innerHTML.
- **MEDIA-WEB-INV-013:** playback URLs are presentation metadata and never become canonical authority.
- **MEDIA-WEB-INV-014:** browser raw media remains off-chain.

## Milestone qualification

MEDIA-AUDIT-10 is treated as a **Level 2 app-integration milestone**.

Reason:

- upload/storage work from MEDIA-AUDIT-4;
- livestreaming from MEDIA-AUDIT-5;
- Identity/Wallet and Rights from MEDIA-AUDIT-6;
- Search/Notifications from MEDIA-AUDIT-8;
- API/SDK from MEDIA-AUDIT-9

all converge in the first user-facing application.

Level 2 remains Media-focused and does not trigger repository-wide Level 3 inventories.

## Level 2 qualification scope

The retained Media integration gate must include:

- exact implementation SHA assertion;
- canonical Media verifier;
- GEN-SVC validator;
- Media Go package tests;
- typed Media SDK tests;
- Search architecture/result dependency tests;
- Media Go vet;
- Media web structural checks;
- Media web unit tests;
- Media web static build;
- Media Solidity build;
- retained Media Phase-1 Foundry suite;
- Media Anvil integration.

## Deferred work

MEDIA-AUDIT-10 does **not** claim:

- a production Media domain;
- live deployed API origin;
- live Storage upload endpoint;
- live RPC/network configuration;
- production TLS/origin evidence;
- production Wallet signing journey;
- production moderation/abuse controls;
- public-testnet end-to-end evidence.

Those remain MEDIA-AUDIT-11 through MEDIA-AUDIT-13 as canonically defined.
