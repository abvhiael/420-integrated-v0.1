# 420Media — MEDIA-AUDIT-10 qualification evidence

## Step

**MEDIA-AUDIT-10 — User-facing 420Media application**

Status: **COMPLETE**

Qualification level: **Level 2 — app integration milestone**

## Authoritative implementation

- implementation SHA: `f7e72653a057b227df256e9546cd2b309b692274`
- current `main` SHA at closeout: `ba7b9c2067877bf1ec9093f251928089420350b5`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**
- original audit baseline: `d86a3810d2901dc1082b65dc9061896c46e1911d`

## Canonical definition

MEDIA-AUDIT-10 requires a user-facing 420Media frontend covering:

- upload;
- library;
- playback;
- livestream workflows;
- Wallet/network validation;
- loading/empty/error/transaction states;
- safe recovery;
- accessibility basics;
- responsive behavior;
- feature availability;
- no production-domain claim before deployment exists.

All repository-scope exit criteria are satisfied.

## Milestone classification

MEDIA-AUDIT-10 is treated as a **Level 2 app-integration milestone**.

This is the first user-facing convergence of accumulated qualified work from:

- MEDIA-AUDIT-4 — Storage-backed upload/media lifecycle;
- MEDIA-AUDIT-5 — livestreaming;
- MEDIA-AUDIT-6 — Identity/Wallet/Rights;
- MEDIA-AUDIT-8 — Search/Notifications projections;
- MEDIA-AUDIT-9 — stable /v1 API and typed SDK.

Qualification remains Media-focused. No repository-wide Level 3 inventory was run.

## Implementation completed

### User-facing application

Added `media/web` as a static browser application following repository web-app conventions.

Primary surfaces:

- media library;
- video playback;
- upload preparation/transport/recovery;
- livestream create/status/start/stop;
- Wallet/network session state;
- feature availability;
- action/transaction state.

### Fail-closed runtime

Added:

- `runtime-config.json`;
- `runtime-config.example.json`;
- runtime-schema validation;
- canonical Media service-ID validation;
- secure URL validation;
- unresolved chain/network/API defaults;
- explicit execution lock until canonical runtime is materialized.

Repository runtime config intentionally contains:

- no production origin;
- no API origin;
- no chain ID;
- no network ID;
- no secret-bearing field.

MEDIA-AUDIT-10 therefore does **not** invent or claim `media.420integrated.org` or any other production domain.

### Wallet/network boundary

The application:

- requests accounts from an injected wallet;
- validates EVM address shape;
- reads `eth_chainId`;
- requires the runtime/API compatibility chain;
- fails closed on wrong network;
- invalidates local wallet, livestream and retry state on account/chain changes;
- stores no wallet private key, mnemonic or seed;
- does not persist authority state in localStorage/sessionStorage/IndexedDB.

### Feature availability

Runtime configuration and `/v1/capabilities` are composed to expose available/unavailable UI states.

Canonical `media.livestreaming` availability controls livestream actions.

Disabled/unresolved features do not execute speculative writes.

### Library

Implemented:

- cursor-backed list;
- loading state;
- empty state;
- error state;
- populated state;
- refresh;
- load-more pagination;
- safe selection into playback.

Library failure never mutates canonical Media state.

### Playback

Extended Media API `Asset` presentation model with optional:

`playback_url`

This is non-authoritative transport/presentation metadata.

Playback accepts only safe browser URLs:

- HTTPS;
- local-development loopback HTTP;
- `blob:`.

Unsafe schemes such as `javascript:` fail closed.

The browser video surface uses native controls, no autoplay, metadata preloading and explicit error state.

A missing URL is rendered as unavailable rather than derived/fabricated.

### Upload

Extended Media API `UploadPlan` with optional:

`endpoint`

This is an off-chain transport locator only.

Browser flow:

1. select a `video/*` file;
2. validate Wallet/network;
3. select visibility;
4. provide Storage agreement/capacity references;
5. compute browser-side SHA-256;
6. prepare deterministic request-side object/provenance references;
7. submit idempotent Media `/v1/uploads/prepare`;
8. retain the canonical returned plan;
9. PUT raw bytes directly to a safe prepared off-chain endpoint when materialized;
10. poll Media asset status;
11. treat only canonical `READY` as completion;
12. refresh the library.

Transport acceptance is never represented as canonical readiness.

### Upload recovery

In-memory retry state retains:

- exact idempotency key;
- exact prepare payload;
- selected file;
- returned plan when available.

Prepare, transport and canonical-ready failures remain retryable without falsely advancing state.

No retry/authority data is persisted across page reloads.

### Livestream

User-facing controls implement:

- create;
- status;
- start;
- stop.

Create captures:

- session ID;
- protocol;
- direction;
- endpoint;
- opaque credential reference;
- stream reference;
- bounded maximum duration.

Authority-bearing actions require valid Wallet/network plus feature availability.

Start/stop are idempotent API writes.

Failure explicitly instructs status revalidation rather than assuming canonical session state.

### Explicit UI states

Qualified state surfaces include:

- runtime loading/ready/locked;
- Wallet disconnected/connected/wrong-network;
- feature checking/available/unavailable;
- library loading/empty/error/populated;
- playback unavailable/ready/error;
- upload idle/preparing/uploading/waiting-ready/success/error;
- livestream idle/created/active/closed/error;
- action/transaction pending/success/error.

### Accessibility and responsive behavior

Implemented and structurally qualified:

- semantic main/sections/headings/forms;
- skip-to-content;
- explicit form labels;
- native controls;
- ARIA live regions;
- role=status / role=alert surfaces;
- visible focus treatment;
- reduced-motion support;
- mobile single-column fallbacks;
- responsive grids/actions/video;
- no dynamic remote-content `innerHTML`.

### Static build/security

Added deterministic web qualification/build:

- `npm run check`;
- `npm test`;
- `npm run build`;
- aggregate `npm run qualify`.

Build output includes:

- static app files;
- core modules;
- 404 fallback;
- security headers;
- build metadata.

Security headers cover:

- nosniff;
- no-referrer;
- frame denial;
- Permissions Policy;
- restrictive CSP for script/media/connect/image/frame sources.

Build metadata records no production origin and fail-closed runtime execution.

## Files changed

### Media API/interface

- `media/api/types.go`
- `media/api/server_test.go`

### User-facing application

- `media/web/package.json`
- `media/web/index.html`
- `media/web/styles.css`
- `media/web/app.js`
- `media/web/runtime-config.json`
- `media/web/runtime-config.example.json`
- `media/web/security-headers.json`
- `media/web/core/config.js`
- `media/web/core/service.js`
- `media/web/core/wallet.js`
- `media/web/core/state.js`
- `media/web/scripts/check.mjs`
- `media/web/scripts/build.mjs`
- `media/web/test/web.test.js`

### Qualification/documentation

- `docs/420-MEDIA-WEB-APPLICATION.md`
- `scripts/verify-420media-audit.py`
- `.github/workflows/420media-audit.yml`
- `docs/420MEDIA-AUDIT.md`

## Security / negative / failure-path results

PASS:

- wrong service ID fails runtime validation;
- production origin cannot be configured before deployment;
- unresolved runtime remains fail-closed;
- wrong Wallet chain fails closed;
- account/network change invalidates local authority state;
- remote HTTP Media API endpoint rejected;
- unsafe upload endpoint rejected;
- unsafe playback URL rejected;
- API envelope is version-validated;
- idempotency header is preserved;
- retry state stays memory-only;
- no localStorage/sessionStorage/IndexedDB authority persistence;
- dynamic innerHTML use rejected structurally;
- upload transport completion is not treated as canonical READY;
- upload retry preserves prepared/idempotent semantics;
- livestream failure does not invent canonical session state;
- feature-disabled actions are disabled;
- runtime configuration secret-like fields are rejected structurally;
- accessibility/responsive requirements structurally present;
- playback/upload API presentation fields are Go-qualified;
- all prior Media API/SDK/Search/Go/Solidity/Anvil regressions remain green.

## CI diagnosis history

Superseded/intermediate runs are not qualification evidence.

### Verifier/documentation mismatch

A superseded candidate failed because the Media verifier required literal phrase:

`upload/library/playback/livestream`

while the web document described those workflows individually.

The durable contract wording was aligned. No implementation behavior changed.

### Node setup workflow defect

Run #124 / `37524794010` failed in `actions/setup-node@v4` before any test because workflow input `cache: false` was interpreted as unsupported cache mode.

The invalid cache input was removed.

This was a CI/workflow defect, not application behavior.

### Go formatting defect

Run #125 / `37524900809` passed verifier/GEN-SVC setup but stopped at gofmt because the updated playback API fixture required formatting.

Only the affected fixture was normalized.

### Test-harness compile defect

Run #126 / `37525077025` reached Media Go tests and failed because the updated test fixture passed one extra zero argument to `time.Date`.

The fixture typo was corrected.

No API/web semantics or assertion strength was changed.

## Exact-head Level 2 qualification

Workflow: **420Media audit**

- run: **37525218135**
- run number: **127**
- job: **112480377063**
- exact implementation SHA: `f7e72653a057b227df256e9546cd2b309b692274`

Results:

- exact implementation SHA assertion: **PASS**
- Python setup: **PASS**
- Go setup: **PASS**
- Node 22 setup: **PASS**
- Foundry setup: **PASS**
- canonical Media verifier: **PASS**
- Media/API/SDK gofmt gate: **PASS**
- GEN-SVC validator: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go test ./sdk/media420 -count=1`: **PASS**
- Search architecture/result dependency tests: **PASS**
- `go vet ./media/... ./cmd/420media-node ./sdk/media420`: **PASS**
- `npm --prefix media/web run qualify`: **PASS**
- Media Solidity build: **PASS**
- retained `MediaPhase1*420.t.sol` Foundry suite: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

No required check was skipped, cancelled, missing or stale in the authoritative run.

## Current-main dependency check

At closeout current `main` is:

`ba7b9c2067877bf1ec9093f251928089420350b5`

Current main advanced by 111 commits since the MEDIA-AUDIT-9 closeout baseline `721a7f358e802bce91835851721eb93c4340f501`.

None of those commits modify:

- `media/**`;
- `sdk/media420/**`;
- Search dependencies consumed by Media;
- `sdk/storage420/**`;
- Media contracts;
- applicable GEN-SVC Media service definitions.

There is therefore no material dependency drift requiring ceremonial branch reconciliation or requalification for this Level 2 milestone.

Full accumulated branch reconciliation remains intentionally deferred to MEDIA-AUDIT-11 Level 3 closeout.

## Requirements satisfied

- upload workflow: **SATISFIED**
- library workflow: **SATISFIED**
- playback workflow: **SATISFIED**
- livestream workflow: **SATISFIED**
- Wallet validation: **SATISFIED**
- network validation: **SATISFIED**
- loading states: **SATISFIED**
- empty states: **SATISFIED**
- error states: **SATISFIED**
- transaction/action states: **SATISFIED**
- safe recovery: **SATISFIED**
- accessibility basics: **SATISFIED**
- responsive behavior: **SATISFIED**
- feature availability: **SATISFIED**
- no undeployed production-domain claim: **SATISFIED**
- exact-head retained app integration qualification: **PASS**

## Intentionally deferred Level 3 checks

Deferred to MEDIA-AUDIT-11:

- final reconciliation of complete accumulated Media branch with then-current `main`;
- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- complete affected client/service/Indexer/Search/RPC/frontend/backend inventory;
- final security/adversarial/invariant/static-analysis closeout;
- deployment/configuration closeout;
- exact merge-candidate qualification.

## Later live/deployment limitations

Repository qualification does not claim:

- a live production Media domain;
- a deployed Media API origin;
- a materialized production upload transport;
- a live Media runtime chain/network;
- production Wallet transaction/signing evidence;
- production moderation/abuse infrastructure;
- public-testnet end-to-end evidence.

These remain later canonical roadmap work.

## Blockers

None for MEDIA-AUDIT-10 repository Level 2 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-11 — Security, abuse, moderation and repository closeout**
