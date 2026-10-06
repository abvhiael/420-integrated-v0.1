# 420Media — MEDIA-AUDIT-9 qualification evidence

## Step

**MEDIA-AUDIT-9 — Stable /v1 API and typed SDK**

Status: **COMPLETE**

Qualification level: **Level 1 — app-scoped fast qualification**

## Authoritative implementation

- implementation SHA: `79e102e596a4e07b683fc15305c87c3ab4212aac`
- current `main` SHA at qualification closeout: `721a7f358e802bce91835851721eb93c4340f501`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**
- original audit baseline: `d86a3810d2901dc1082b65dc9061896c46e1911d`

## Canonical definition

MEDIA-AUDIT-9 requires the first stable Media service contract to implement the GEN-SVC API/SDK conventions:

- stable `/v1` routes;
- cursor pagination;
- RFC3339 UTC timestamps;
- opaque stable IDs;
- stable machine-readable errors;
- explicit provenance;
- idempotency for retriable writes;
- pagination bounds and rate-limit metadata;
- compatibility/capability discovery;
- chain/network validation before authority-bearing SDK actions;
- Wallet signing handoff rather than private-key custody;
- typed Media service client/SDK.

All repository-scope requirements are satisfied.

## Implementation completed

### Stable /v1 HTTP contract

Added `media/api` with:

- `GET /v1/status`;
- `GET /v1/capabilities`;
- `GET /v1/compatibility`;
- `GET /v1/assets`;
- `GET /v1/assets/{id}`;
- `POST /v1/uploads/prepare`;
- `POST /v1/livestreams`;
- `GET /v1/livestreams/{id}`;
- `POST /v1/livestreams/{id}/start`;
- `POST /v1/livestreams/{id}/stop`;
- `GET /v1/search`;
- `POST /v1/notifications/subscriptions`;
- `DELETE /v1/notifications/subscriptions/{id}`;
- `POST /v1/signing/intents`.

The package exposes a backend composition interface and does not claim live deployment.

### API conventions

The service contract now enforces:

- versioned envelopes with `version=v1`;
- opaque cursor pagination;
- default page size 50;
- maximum page size 200;
- rejection of offset pagination;
- RFC3339 UTC-normalized timestamps;
- stable machine error codes plus human messages;
- explicit service/API headers;
- explicit rate-limit metadata;
- strict JSON decoding;
- bounded request bodies;
- bounded cursor/idempotency inputs;
- no-store cache policy;
- `nosniff` response hardening.

### Idempotent retriable writes

All retriable writes require `Idempotency-Key`.

Repository-scope replay semantics:

1. request fingerprint includes method, path, query and exact body;
2. exact successful retry returns the retained response without re-executing the backend;
3. reuse of a key with a different fingerprint returns `idempotency_conflict`;
4. backend failures are not cached as successful results.

The in-process store establishes contract semantics for repository qualification. Durable distributed idempotency storage remains deployment-stage work.

### Capability and compatibility discovery

The API exposes machine-readable:

- canonical Media service ID `420/service/media/v1`;
- API version;
- compatibility major;
- minimum client major;
- feature availability;
- resource set;
- pagination convention;
- timestamp convention;
- Wallet-signing mode;
- stable error vocabulary;
- runtime chain/network when supplied by the backend.

The server fails closed when backend-reported service/version/compatibility does not match the Media contract.

### Typed SDK

Added `sdk/media420`.

Typed client methods cover:

- status;
- capabilities;
- compatibility;
- asset list/get;
- upload preparation;
- livestream create/get/start/stop;
- Search projection reads;
- Notifications subscription create/delete;
- Wallet signing-intent preparation.

The SDK validates:

- secure endpoint policy;
- stable response version;
- typed response envelopes;
- page bounds;
- idempotency requirements;
- API compatibility;
- expected chain/network before authority-bearing writes.

Non-loopback HTTP endpoints are rejected; HTTPS is required outside local development.

### Canonical service discovery

The SDK includes an injected `ServiceDiscovery` interface.

Discovery resolves exactly:

`420/service/media/v1`

A discovered endpoint must provide the expected service ID, URL, nonzero chain ID and network.

No production endpoint or Registry address is invented.

### Wallet signing boundary

Added external signing-intent handoff using domain:

`420/MEDIA/API/SIGNING/V1`

Signing intents bind:

- wallet;
- chain ID;
- network;
- action;
- resource ID;
- payload hash;
- nonce;
- expiry;
- exact message.

The SDK exposes a caller-provided `WalletSigner` that receives only the prepared message.

420Media never requests, derives, stores or receives a wallet private key.

## Files changed

Implementation/test surface:

- `media/api/types.go`
- `media/api/backend.go`
- `media/api/idempotency.go`
- `media/api/server.go`
- `media/api/server_test.go`
- `sdk/media420/errors.go`
- `sdk/media420/client.go`
- `sdk/media420/discovery.go`
- `sdk/media420/client_test.go`
- `.github/workflows/420media-audit.yml`
- `scripts/verify-420media-audit.py`

Documentation/audit surface in the qualified implementation SHA:

- `docs/420-MEDIA-API-SDK.md`
- `docs/420MEDIA-AUDIT.md`

## Security / adversarial / boundary results

PASS:

- cursor pagination bounds;
- offset pagination rejected;
- duplicate/unsupported pagination parameters rejected;
- strict JSON unknown fields rejected;
- stable error-envelope classification;
- required idempotency key;
- exact retry does not duplicate backend execution;
- idempotency-key reuse with changed request fails closed;
- rate-limit metadata present;
- UTC timestamp normalization;
- capability identity/version validation;
- compatibility-major validation;
- SDK chain mismatch blocks authority-bearing write;
- SDK network mismatch blocks signing intent;
- insecure non-loopback HTTP endpoint rejected;
- canonical service discovery resolves the Media service ID;
- signing-intent domain/chain/network/wallet/action/resource/payload binding;
- external Wallet signer handoff only;
- typed pagination and typed response decoding;
- retained Media Go regressions;
- retained Search contract dependency tests;
- retained Media Solidity/Phase-1 tests;
- retained Anvil integration.

## CI diagnosis history

Two superseded candidates failed before the authoritative pass.

### Run #105 — formatting defect

- run: `37520209330`
- job: `112463489656`
- exact SHA assertion: PASS
- verifier: PASS
- formatting gate: FAIL
- cause: `sdk/media420/client_test.go` required `gofmt`
- downstream checks were skipped and are not evidence.

This was a source-formatting defect only.

### Run #106 — SDK build defect

- run: `37520375425`
- job: `112463947073`
- exact SHA assertion: PASS
- verifier: PASS
- formatting: PASS
- GEN-SVC validator: PASS
- Media Go tests: PASS
- typed SDK step: FAIL
- cause: unused `errors` import in `sdk/media420/client.go`
- downstream checks were skipped and are not evidence.

The unused import was removed. No API/SDK semantics, authorization boundary or test assertion was weakened.

## Exact-head Level 1 qualification

Workflow: **420Media audit**

- run: **37520504975**
- run number: **107**
- job: **112464389357**
- exact implementation SHA: `79e102e596a4e07b683fc15305c87c3ab4212aac`

Results:

- exact implementation SHA assertion: **PASS**
- canonical Media verifier: **PASS**
- Media/API/SDK gofmt gate: **PASS**
- GEN-SVC validator: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go test ./sdk/media420 -count=1`: **PASS**
- Search projection dependency tests: **PASS**
- `go vet ./media/... ./cmd/420media-node ./sdk/media420`: **PASS**
- Media Solidity build: **PASS**
- retained Media Phase-1 Foundry suite: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

No required check was skipped, cancelled, missing or stale in the authoritative run.

## Current-main dependency check

At closeout, current `main` is:

`721a7f358e802bce91835851721eb93c4340f501`

Compared with the prior Media dependency baseline `23ebff000a471bfbc4439894f797f3b17a530867`, current main advanced by 68 commits.

None of those commits change:

- `media/**`;
- `sdk/media420/**`;
- Media contracts;
- Search source used by Media;
- Storage SDK used by Media;
- `config/genesis-consumer-services.json`;
- GEN-SVC service definitions applicable to MEDIA-AUDIT-9.

Therefore there is no material dependency drift requiring Level-1 reconciliation/requalification for this step.

The complete branch remains diverged from current main; accumulated reconciliation is intentionally reserved for the documented Level-3 app-phase closeout.

## Level 2 status

No Level 2 milestone is defined for MEDIA-AUDIT-9.

The previously qualified MEDIA-AUDIT-5 Level-2 milestone remains the retained cross-component application milestone.

No ceremonial broader rerun was performed.

## Intentionally deferred Level 3 checks

Deferred to MEDIA-AUDIT-11 app-phase closeout:

- complete branch reconciliation with then-current `main`;
- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- full affected client/service/Indexer/Search/RPC/frontend/backend inventory;
- final adversarial/security/static-analysis/deployment/config qualification;
- exact accumulated merge-candidate qualification.

## Deferred later-roadmap work

- user-facing frontend and Wallet UX — MEDIA-AUDIT-10;
- live HTTP executable/deployment composition — MEDIA-AUDIT-10/12/13 as applicable;
- durable multi-instance idempotency backend — deployment-stage qualification;
- production Registry/service endpoint publication — MEDIA-AUDIT-12/13;
- production TLS/origin/monitoring/rate-limit infrastructure evidence — MEDIA-AUDIT-12/13;
- broader API abuse/rate-limit/webhook/security closeout — MEDIA-AUDIT-11.

## Exit-criterion verification

- stable `/v1` routes: **SATISFIED**
- cursor pagination: **SATISFIED**
- RFC3339 UTC timestamps: **SATISFIED**
- opaque stable IDs: **SATISFIED**
- stable machine errors: **SATISFIED**
- explicit provenance: **SATISFIED**
- idempotency: **SATISFIED**
- pagination/rate metadata: **SATISFIED**
- capability discovery: **SATISFIED**
- compatibility/version reporting: **SATISFIED**
- canonical service discovery boundary: **SATISFIED**
- chain/network validation: **SATISFIED**
- Wallet signing handoff without key custody: **SATISFIED**
- typed Media SDK: **SATISFIED**
- exact-head Level 1 workflow: **PASS**
- retained Media regressions: **PASS**
- durable API/SDK documentation: **SATISFIED**

## Blockers

None for MEDIA-AUDIT-9 repository Level-1 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-10 — User-facing 420Media application**
