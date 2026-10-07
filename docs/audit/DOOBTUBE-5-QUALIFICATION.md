# DoobTube — DOOBTUBE-5 qualification evidence

Roadmap step: **DOOBTUBE-5 — Backend/API/indexing/service control plane**
Qualification level: **Level 1 — app-scoped backend/control-plane qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-5 implements the repository-qualified DoobTube backend/API/indexing/service control plane without duplicating canonical 420Media authority.

Implemented:

- versioned `/v1` API contracts;
- Wallet/chain/network/capability authorization;
- durable replay-safe idempotency;
- opaque bounded pagination;
- RFC3339 UTC timestamps;
- stable machine error codes;
- SQLite persistence and schema migration;
- bounded durable retry jobs;
- replay-safe control jobs;
- public-only derived feed projection;
- non-finalized rollback and finalized-conflict fail-closed handling;
- deterministic projection rebuild/recovery;
- raw-secret rejection and opaque secret-provider references;
- protected application metrics;
- health and dependency-aware readiness.

## Files changed

- `doobtube/api/__init__.py`
- `doobtube/api/errors.py`
- `doobtube/api/types.py`
- `doobtube/api/persistence.py`
- `doobtube/api/service.py`
- `doobtube/tests/test_doobtube_backend.py`
- `docs/DOOBTUBE-BACKEND-CONTROL-PLANE.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `scripts/verify-doobtube-baseline.py`
- `.github/workflows/doobtube-baseline.yml`

## Canonical runtime scope

DoobTube owns only replaceable application/control-plane state:

- preferences;
- idempotency records;
- durable application jobs;
- derived public feed projection;
- operational counters;
- health/readiness presentation.

It does not reimplement:

- 420Media MediaAsset/Stream authority;
- Storage readiness authority;
- Rights/provenance authority;
- Wallet signing;
- Pay/Compute settlement;
- raw upload/media processing;
- livestream transport.

## Versioned API

Implemented routes:

- `GET /v1/health`
- `GET /v1/readiness`
- `GET /v1/feed`
- `GET /v1/preferences`
- `PUT /v1/preferences`
- `POST /v1/control/rebuild`
- `GET /v1/metrics`

Unknown/unversioned routes return stable `NOT_FOUND`.

Responses carry API version `v1` in both response body and `X-DoobTube-API-Version`.

## Authentication / authorization

Qualified behavior:

- public health/readiness/feed routes require no Wallet;
- preference and operator routes require Wallet context;
- wrong chain/network fails closed;
- mutation/control routes require explicit capabilities;
- connected Wallet alone is not blanket authority;
- no private-key/seed/mnemonic custody exists.

Capabilities used:

- `doobtube.preferences`
- `doobtube.operator.rebuild`
- `doobtube.operator.metrics`

## Idempotency

Mutating requests require bounded `Idempotency-Key`.

Durable key scope:

`actor + operation + key`

Exact semantic replay returns the original stored response.

Same key with a changed payload returns:

`IDEMPOTENCY_CONFLICT`

Rebuild job IDs are deterministic from actor + idempotency key, preventing duplicate durable jobs on replay.

## Pagination / timestamps / errors

- feed page size bounded to 1..100;
- cursor is opaque/versioned Base64;
- malformed/oversized cursor fails with `INVALID_REQUEST`;
- runtime timestamps are timezone-aware RFC3339 UTC;
- stable errors include INVALID_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, IDEMPOTENCY_CONFLICT, RATE_LIMITED, UNAVAILABLE, DEPENDENCY_MISMATCH and INTERNAL.

## Persistence / migrations

Repository runtime uses SQLite with:

- foreign keys;
- WAL;
- transactional write paths.

Schema version: **1**.

Durable tables:

- `idempotency`;
- `preferences`;
- `jobs`;
- `projection_blocks`;
- `feed_items`.

A database schema newer than the runtime fails closed.

## Bounded retries / jobs

Durable jobs retain:

- stable ID;
- kind/payload;
- state;
- attempt count;
- max attempts;
- next-attempt timestamp;
- bounded error text;
- created/updated timestamps.

Retry behavior:

- max attempts bounded 1..10;
- exponential retry delay;
- delay capped at 300 seconds;
- success -> `DONE`;
- terminal exhaustion -> `FAILED`.

## Indexing / projection

Public feed admission requires:

- Media state `READY`;
- visibility `PUBLIC`;
- Rights authorization.

UNLISTED, PRIVATE, not-ready and Rights-denied inputs do not become public feed state.

Projection state retains:

- block height;
- block hash;
- parent hash;
- finalized marker;
- observed timestamp.

Behavior qualified:

- exact duplicate block replay is idempotent;
- same-height non-finalized replacement can rollback derived state;
- finalized-history conflict fails closed;
- reorg cannot cross finalized boundary;
- non-contiguous/wrong-parent events fail closed;
- derived state is disposable/rebuildable and not canonical Media authority.

## Recovery / rebuild

Full projection state may be discarded and deterministically rebuilt from strictly ordered canonical input.

Out-of-order rebuild fails closed.

Preferences/idempotency/jobs/projection survive restart through SQLite.

In-memory metrics/request state is explicitly non-authoritative.

## Secrets boundary

Runtime config rejects populated raw-secret fields.

Only a bounded opaque `secret_provider_ref` may be retained.

No private-key/mnemonic field exists in durable control-plane schemas.

## Observability

Runtime counters cover:

- API requests;
- API errors;
- idempotency replays;
- projection rebuilds;
- completed jobs;
- failed job attempts.

Metrics are protected by `doobtube.operator.metrics`.

## Health / readiness

`/v1/health` reports liveness and UTC timestamps.

`/v1/readiness` is fail-closed on required dependency state.

Minimum required dependencies:

- 420Media;
- ProtocolRegistry.

Required dependency failure reports `not_ready` with HTTP-style status 503.

Readiness includes chain ID, network, dependency state and schema version.

## Level 1 qualification

Qualified implementation SHA:

`76e8ec4fc085ff880571020c7c6ce35a0f825fb7`

Workflow: **DoobTube baseline audit**
Run: **37563773221**
Job: **baseline / 112606757298**
Result: **PASS**

Exact-head checks passed:

- exact PR-head checkout;
- exact implementation SHA assertion;
- Python compile/build for the DoobTube package;
- DOOBTUBE-4 adapter regression suite;
- DOOBTUBE-5 backend service/integration suite;
- cumulative DOOBTUBE-0 architecture verification;
- cumulative DOOBTUBE-1 product verification;
- cumulative DOOBTUBE-2 dependency/trust verification;
- cumulative DOOBTUBE-3 lifecycle verification;
- cumulative DOOBTUBE-4 adapter verification;
- DOOBTUBE-5 API/control-plane verifier;
- exact DoobTube repository file inventory;
- roadmap/audit completion state;
- no false testnet/Genesis/production readiness claim.

No required DOOBTUBE-5 check was skipped, cancelled, missing, stale or silently substituted.

## Backend test coverage

Qualified tests include:

- liveness and dependency-aware readiness;
- versioned API and stable errors;
- Wallet/chain/network/capability mutation authorization;
- exact idempotent replay;
- changed-payload idempotency conflict;
- preference persistence across restart;
- public-only projection filtering;
- opaque pagination cursor;
- finalized-history conflict rejection;
- non-finalized replacement;
- deterministic rebuild;
- out-of-order rebuild rejection;
- replay-safe rebuild job creation;
- bounded retry then success;
- bounded terminal job failure;
- raw-secret rejection;
- operator-protected metrics;
- durable migration version;
- unknown preference rejection;
- malformed cursor rejection.

## Security / adversarial / invariant result

Qualified invariants include:

- all DoobTube API routes are versioned;
- application mutations require correct external authority context;
- idempotency cannot execute changed payload under the same key;
- replay state survives restart;
- public feed admits only READY+PUBLIC+Rights-authorized media;
- derived projection cannot become canonical Media authority;
- finalized conflicts fail closed;
- projection rebuild is ordered/deterministic;
- jobs terminate after bounded retry;
- raw secrets are rejected;
- operator metrics/rebuild are capability-gated;
- readiness cannot report ready while Media/Registry is down.

No unresolved DOOBTUBE-5 backend/control-plane defect remains.

## Repository base

Current `main` / qualification base:

`ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`

The branch remained 0 commits behind current main during DOOBTUBE-5 implementation and exact-head qualification.

## Milestone status

DOOBTUBE-5 is an **ordinary Level 1 roadmap step**.

The documented retained app integration milestone remains:

**DOOBTUBE-8 — Ecosystem integration milestone**

No Level 2 qualification is required at DOOBTUBE-5.

## Intentionally deferred Level 3 qualification

Deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final affected client/service/Indexer/Search/RPC/frontend/backend suite;
- final security/static/deployment/config/build/lint/type closeout.

These are not blockers for this ordinary app-scoped backend step.

## Limitations / blockers

No blocker remains for DOOBTUBE-5.

The backend intentionally does not yet implement raw media upload processing, transcoding/delivery, verified playback-provider behavior or livestream transport. Those belong to the next canonical step.

## Evidence SHA rule

This file is a durable **evidence-only** update after the exact implementation SHA qualified.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirement. The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-6 — Media processing, delivery and livestream integration**
