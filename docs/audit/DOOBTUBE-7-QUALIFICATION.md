# DoobTube — DOOBTUBE-7 qualification evidence

Roadmap step: **DOOBTUBE-7 — User-facing web application**
Qualification level: **Level 1 — app-scoped frontend/web qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-7 implements the production-intended dependency-free static DoobTube V1 web application over the already-qualified DoobTube backend and canonical 420Media boundaries.

Implemented:

- all canonical V1 user surfaces;
- anonymous public discovery/search/playback;
- Wallet connection and expected-network validation;
- authority invalidation on account/network changes;
- explicit loading/empty/error/pending/success states;
- creator/channel presentation without new authority;
- creator library;
- video upload with in-memory exact retry/idempotency state;
- canonical READY polling after transport;
- safe Media-supplied playback;
- livestream create/refresh/start/stop with canonical revalidation;
- creator-update subscription with promotional consent disabled;
- DoobTube preferences;
- moderation report/appeal;
- honest disabled delete/export controls where no qualified API exists;
- responsive/accessibility baseline;
- DoobTube branding asset;
- fail-closed secret-free runtime configuration;
- deterministic static build and security headers.

## Repository reconciliation

At the start of DOOBTUBE-7, current main was:

`ea979e30e3c3b977c8b23aeaf346f53ae23ee23a`

During implementation, main advanced to:

`f674fbed767efc126da253c66800e38d030dc1dd`

The new mainline commit affected only:

`puffbuddies/web/index.html`

The DoobTube audit branch was reconciled before authoritative qualification using merge commit:

`29b327d1a342c3144ef9cbdd148663009bc18a3c`

The final qualification branch was 0 commits behind current main.

## Files changed

- `doobtube/web/package.json`
- `doobtube/web/runtime-config.json`
- `doobtube/web/runtime-config.example.json`
- `doobtube/web/security-headers.json`
- `doobtube/web/brand.svg`
- `doobtube/web/styles.css`
- `doobtube/web/index.html`
- `doobtube/web/app.js`
- `doobtube/web/core/config.js`
- `doobtube/web/core/wallet.js`
- `doobtube/web/core/routes.js`
- `doobtube/web/core/state.js`
- `doobtube/web/core/service.js`
- `doobtube/web/scripts/build.mjs`
- `doobtube/web/scripts/check.mjs`
- `doobtube/web/test/web.test.js`
- `docs/DOOBTUBE-WEB-APPLICATION.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `scripts/verify-doobtube-baseline.py`
- `.github/workflows/doobtube-baseline.yml`

## Canonical V1 surfaces

The static application provides:

- `#/home` — public discovery;
- `#/search` — public Search;
- `#/watch/:mediaId` — media detail/playback;
- `#/creator/:creatorRef` — creator/channel presentation;
- `#/library` — creator library;
- `#/upload` — upload/publish;
- `#/live` — livestream create/control;
- public live playback through qualified media detail/playback when supplied;
- `#/subscriptions` — creator updates/preferences;
- `#/moderation` — report/appeal;
- `#/data` — export/delete capability status;
- `#/status` — Wallet/network/service status.

Unknown routes fall back safely to home.

## Anonymous public mode

Public browsing/search/playback does not require Wallet connection.

Wallet is required only for authority-bearing mutation workflows.

Wrong-network state blocks mutation while leaving public-safe presentation available.

## Wallet / authority behavior

The client uses injected Wallet calls:

- `eth_requestAccounts`;
- `eth_chainId`.

It validates account shape and configured chain.

The following invalidate authority-sensitive local state:

- account change;
- account disconnect;
- chain change.

Client retry/authority state is memory-only.

Forbidden browser authority persistence:

- localStorage;
- sessionStorage;
- IndexedDB.

No private key, seed phrase or mnemonic is accepted.

## Public discovery / Search

Home consumes the DOOBTUBE-5 public feed.

Explicit UI states:

- loading;
- empty;
- populated;
- error;
- load-more.

Search consumes the repository-qualified Media:

`GET /v1/search`

No-result state is distinct from service failure.

Ranking is not represented as canonical authority.

## Media detail / playback

Playback uses only a service-supplied locator.

Safe client rendering accepts:

- HTTPS;
- browser blob URLs;
- loopback HTTP for repository/development preview.

Rejected:

- script/data-style unsafe schemes;
- embedded URL credentials.

The browser:

- uses native video controls;
- does not force autoplay;
- uses metadata preload;
- surfaces playback failure without changing Media state.

Remote/service text uses text nodes / `textContent`; dynamic `innerHTML` is structurally forbidden.

## Creator presentation

Creator/channel view is keyed to service-supplied creator/controller reference.

It may display public items already present in DoobTube feed state.

It does not create:

- channel ownership;
- Identity authority;
- Registry authority;
- token ownership.

Identity remains optional.

## Creator library

Library requires connected Wallet context and supports:

- loading;
- empty;
- populated;
- error;
- pagination/load-more.

Disconnected state is explicit rather than silently querying private/creator state.

## Upload workflow

Upload requires:

- valid Wallet/network;
- `video/*` file;
- PRIVATE/UNLISTED/PUBLIC choice;
- Storage agreement ID;
- capacity reservation ID.

The browser computes SHA-256 and constructs deterministic request-side integrity/precondition inputs.

Prepare request is idempotent.

Exact retry state retained in memory:

- key;
- payload;
- selected file;
- prepared plan when available.

Raw bytes are sent only to qualified HTTPS transport.

Transport completion is displayed as pending.

Success is displayed only after canonical Media state reaches `READY`.

Page reload intentionally discards authority-sensitive selected-file/retry state.

## Livestream workflow

Implemented:

- create;
- canonical refresh;
- start;
- stop.

Wallet/network validation is mandatory.

The UI never treats ambiguous start/stop failure as remote success.

On failure it directs canonical status refresh before retry.

Credential input is an opaque reference; raw private keys are never requested.

## Creator-update subscriptions / preferences

Subscription uses the qualified Media route:

`POST /v1/notifications/subscriptions`

Payload fixes:

`promotional_opt_in: false`

The UI explicitly states creator updates are not paid entitlement or marketing consent.

DoobTube preferences use the DOOBTUBE-5 idempotent preferences boundary.

## Moderation

Reports use:

`POST /v1/moderation/reports`

with:

- Wallet-bound reporter;
- MediaAsset target;
- reason;
- optional opaque evidence reference.

Appeals use:

`POST /v1/moderation/decisions/:id/appeals`

with Wallet-bound appellant and reason.

The UI states:

- report submission does not itself hide/delete/transfer media;
- appeal does not rewrite prior decision history.

## Delete / export boundary

Repository inspection confirmed no qualified Media delete/export route exists.

Therefore DoobTube includes the required Data surface but:

- delete is disabled;
- export is disabled;
- unavailability is explicit;
- no Storage access is fabricated;
- no immutable-history erasure is promised.

This preserves DOOBTUBE-1's conditional "when supported / once runtime implements it" semantics.

## Fail-closed runtime configuration

Runtime schema:

`doobtube-web-runtime-v1`

Repository defaults leave unresolved:

- production origin;
- chain ID;
- network;
- DoobTube API URL;
- Media API URL;
- Search API URL;
- Notifications API URL.

Pinned canonical service IDs:

- `420/service/media/v1`;
- `420/service/search/v1`;
- `420/service/notifications/v1`.

No repository-preview production deployment is claimed.

Secret-like runtime fields are rejected.

## Accessibility / responsive qualification

Structural checks require:

- viewport;
- semantic navigation/main/sections;
- skip link;
- form labels;
- native controls;
- aria-live status;
- visible focus-visible styling;
- reduced-motion CSS;
- responsive media query;
- mobile single-column fallbacks;
- native video controls;
- no dynamic innerHTML.

## Build

Web package:

`doobtube/web/package.json`

Qualification command:

`npm --prefix doobtube/web run qualify`

This runs:

1. structural/security check;
2. Node browser-facing fixture tests;
3. deterministic static build.

Build output contains:

- index;
- 404 fallback;
- JS/core modules;
- CSS;
- fail-closed runtime config;
- brand asset;
- generated `_headers`;
- build metadata.

Generated `dist/` is intentionally excluded from the committed-source inventory verifier.

## Browser/service fixture coverage

Fixture tests validate:

- fail-closed runtime;
- exact service identities;
- wrong-network Wallet rejection;
- anonymous route availability;
- every V1 route;
- safe playback URL policy;
- DoobTube public feed route;
- Media asset detail;
- Media public Search;
- creator-update subscription route;
- moderation report route;
- appeal route;
- HTTPS upload transport;
- unsafe upload rejection;
- in-memory idempotency/retry state reset.

Fixtures use exact qualified repository paths; no invented API route is substituted.

## Level 1 qualification

Qualified implementation SHA:

`624c3c618758e91d3220fb19dc7445825803c768`

Workflow: **DoobTube baseline audit**
Run: **37568824018**
Job: **baseline / 112622619440**
Result: **PASS**

Exact-head steps passed:

- exact PR-head checkout;
- exact implementation SHA assertion;
- Python setup;
- Node 22 setup;
- DoobTube Python compile;
- retained protocol-adapter tests;
- retained backend/control-plane tests;
- retained media-integration/adversarial tests;
- DoobTube web structural/security check;
- browser/service fixture tests;
- deterministic static web build;
- cumulative DOOBTUBE-0 architecture verification;
- cumulative DOOBTUBE-1 product verification;
- cumulative DOOBTUBE-2 dependency/trust verification;
- cumulative DOOBTUBE-3 lifecycle verification;
- cumulative DOOBTUBE-4 adapter verification;
- cumulative DOOBTUBE-5 backend verification;
- cumulative DOOBTUBE-6 media verification;
- DOOBTUBE-7 web verifier;
- roadmap/audit completion state;
- no false testnet/Genesis/production readiness claim.

No required DOOBTUBE-7 check was skipped, cancelled, missing, stale or silently substituted.

## Superseded failures

### Run 37568639935 / job 112622045213

Implementation SHA:

`8bac373e87ca2c68ac2b8acd71c3137c25518b91`

Result: **FAIL**

Passed before failure:

- exact SHA;
- Python compile;
- adapter tests;
- backend tests;
- media tests;
- complete web qualification command.

Failure classification: **cumulative verifier wording mismatch**.

Verifier required literal:

`canonical routes`

while the canonical document section was:

`Canonical user surfaces`

No frontend/runtime requirement failed.

### Run 37568687094 / job 112622193555

Implementation SHA:

`42dd9c06071fb7f03c6661852f16101501f052f2`

Result: **FAIL**

All executable/build/frontend tests passed.

Failure classification: **cumulative verifier wording mismatch**.

Verifier required literal:

`retry/revalidation`

while the canonical document expresses the same required semantics through exact retry reuse and canonical status refresh.

### Run 37568775243 / job 112622468867

Implementation SHA:

`a4da3cef304fc80ef8b6b8ca24816f5eb70d17ee`

Result: **FAIL**

All executable/build/frontend tests passed.

Failure classification: **cumulative verifier wording mismatch**.

Verifier required literal:

`Safe media rendering`

while the canonical document heading is:

`Media detail / safe rendering`

The verifier was aligned to exact committed requirement text across all DOOBTUBE-7 categories without removing or weakening any requirement.

## Security / invariant result

Qualified frontend invariants:

- public viewing does not require Wallet;
- mutation requires expected Wallet/network;
- authority state invalidates on account/network change;
- no private-key/seed/mnemonic custody;
- retry/idempotency state is memory-only;
- upload transport is not READY;
- unsafe media/upload URLs fail closed;
- service text cannot execute dynamic HTML;
- report/appeal cannot become moderation authority;
- creator update subscription is not paid entitlement or promotional consent;
- unsupported delete/export cannot be fabricated;
- unresolved runtime cannot execute by assumption;
- client route guards/buttons are not protected-resource authority;
- static build claims no production/testnet deployment.

No unresolved DOOBTUBE-7 repository/frontend defect remains.

## Current base

Current main / exact qualification base:

`f674fbed767efc126da253c66800e38d030dc1dd`

The branch was 0 commits behind current main at exact-head qualification.

## Milestone status

DOOBTUBE-7 is an **ordinary Level 1 roadmap step**.

The next canonical step is the documented retained Level 2 milestone:

**DOOBTUBE-8 — Ecosystem integration milestone**

No Level 2 run is required inside DOOBTUBE-7 itself.

## Intentionally deferred Level 3 qualification

Deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final complete affected client/service/Indexer/Search/RPC/frontend/backend suite;
- final security/static/deployment/config/build/lint/type closeout.

## Limitations / blockers

No repository blocker remains for DOOBTUBE-7.

Repository runtime configuration intentionally remains unresolved. Real production/testnet chain identity, API origins, TLS/domain, Wallet journey, live Storage/CDN transport and deployment evidence remain later DOOBTUBE-10/12/13 work.

## Evidence SHA rule

This document is a durable **evidence-only** update written after exact implementation qualification.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-8 — Ecosystem integration milestone**
