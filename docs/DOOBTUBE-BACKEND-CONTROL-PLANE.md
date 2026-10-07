# DoobTube — backend/API/indexing/service control plane

Roadmap step: **DOOBTUBE-5 — Backend/API/indexing/service control plane**
Status: **ADOPTED / IMPLEMENTED**
Date: 2026-10-06

## 1. Purpose

DOOBTUBE-5 implements DoobTube's replaceable backend/control-plane runtime around already-qualified canonical services.

It does **not** duplicate 420Media's media API or take protocol authority. The DoobTube backend owns only application-scoped durable preferences, idempotency records, replay-safe jobs, rebuildable public feed projection state, API error/version contracts, operational metrics and health/readiness state.

## 2. Runtime package

Implemented under:

- `doobtube/api/types.py`
- `doobtube/api/errors.py`
- `doobtube/api/persistence.py`
- `doobtube/api/service.py`

Tests:

- `doobtube/tests/test_doobtube_backend.py`

## 3. Versioned API

### DT-API-001 — Version namespace

All application routes are under:

`/v1/*`

Unknown or unversioned routes return stable `NOT_FOUND`.

### DT-API-002 — Version response envelope

Responses expose:

- body `version: "v1"`;
- header `X-DoobTube-API-Version: v1`.

### DT-API-003 — Implemented V1 control-plane routes

Repository runtime implements:

- `GET /v1/health`
- `GET /v1/readiness`
- `GET /v1/feed`
- `GET /v1/preferences`
- `PUT /v1/preferences`
- `POST /v1/control/rebuild`
- `GET /v1/metrics`

These are DoobTube-owned application/control-plane routes. Media upload/playback/livestream/moderation authority remains with qualified 420Media interfaces and is not reimplemented here.

## 4. Authentication and authorization

### DT-AUTH-001 — Public routes

Health, readiness and public feed are safe without Wallet authorization.

### DT-AUTH-002 — Wallet-required routes

Preference mutation/read and operator routes require a non-empty Wallet context.

### DT-AUTH-003 — Chain/network binding

Authority-bearing requests fail closed when Wallet chain or network differs from configured runtime chain/network.

### DT-AUTH-004 — Capability checks

Mutation/control routes require explicit capability strings:

- `doobtube.preferences`
- `doobtube.operator.rebuild`
- `doobtube.operator.metrics`

A connected Wallet alone is insufficient authorization.

### DT-AUTH-005 — No private-key custody

The backend accepts only external Wallet/session authorization context. It stores no private key, seed phrase or mnemonic.

## 5. Idempotency and replay

### DT-IDEMP-API-001 — Required key

Mutating routes require bounded `Idempotency-Key`.

### DT-IDEMP-API-002 — Exact replay

Same actor + operation + key + semantic payload returns the original stored result.

### DT-IDEMP-API-003 — Payload conflict

Same actor + operation + key with a changed payload returns stable `IDEMPOTENCY_CONFLICT`.

### DT-IDEMP-API-004 — Durable replay state

Idempotency records are SQLite durable state and survive process restart.

### DT-IDEMP-API-005 — Deterministic rebuild job identity

Rebuild requests use deterministic job IDs derived from actor + idempotency key, preventing duplicate durable jobs under replay.

## 6. Pagination and timestamps

### DT-PAGE-001 — Opaque cursor

Feed pagination uses opaque versioned Base64 cursors rather than raw database offsets in the public contract.

### DT-PAGE-002 — Bounded page size

V1 page limit is bounded to 1..100.

### DT-PAGE-003 — Cursor validation

Malformed/oversized cursors fail with `INVALID_REQUEST`.

### DT-TIME-001 — UTC timestamps

Runtime timestamps are timezone-aware and serialized as RFC3339 UTC.

## 7. Stable errors

Stable machine error vocabulary includes:

- `INVALID_REQUEST`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `IDEMPOTENCY_CONFLICT`
- `RATE_LIMITED`
- `UNAVAILABLE`
- `DEPENDENCY_MISMATCH`
- `INTERNAL`

Error responses retain the V1 envelope and a stable machine code.

## 8. Persistence and migrations

### DT-PERSIST-001 — SQLite repository runtime

Repository qualification uses SQLite durable persistence with WAL and foreign keys enabled.

### DT-PERSIST-002 — Schema version

Schema version is stored in `meta.schema_version`.

DOOBTUBE-5 freezes schema version **1**.

### DT-PERSIST-003 — Durable tables

Schema v1 includes:

- `idempotency`;
- `preferences`;
- `jobs`;
- `projection_blocks`;
- `feed_items`.

### DT-PERSIST-004 — Forward safety

A database whose schema version is newer than the runtime fails closed.

### DT-PERSIST-005 — Transactional writes

Authority-sensitive local mutations use SQLite transactions and rollback on error.

## 9. Bounded retries and replay-safe jobs

### DT-JOB-001 — Durable jobs

Control-plane jobs are persisted with:

- stable job ID;
- kind;
- payload;
- state;
- attempts;
- max attempts;
- next attempt timestamp;
- bounded last error;
- created/updated timestamps.

### DT-JOB-002 — Retry bound

Runtime max attempts is bounded to 1..10.

### DT-JOB-003 — Exponential bounded backoff

Retry delay uses bounded exponential backoff capped at 300 seconds.

### DT-JOB-004 — Terminal failure

After max attempts the job becomes `FAILED`; it is not retried forever.

### DT-JOB-005 — Successful completion

Successful handlers mark jobs `DONE`.

## 10. Indexing / projection control plane

### DT-INDEX-001 — Public-only feed state

Only:

- `READY`;
- `PUBLIC`;
- Rights-authorized

Media events create/retain public feed items.

UNLISTED, PRIVATE, not-ready or Rights-denied events remove/exclude public feed state.

### DT-INDEX-002 — Rebuildable authority

`feed_items` and `projection_blocks` are DoobTube derived state only.

They do not become Media/Rights/Storage authority.

### DT-INDEX-003 — Ordered chain provenance

Projection events retain:

- height;
- block hash;
- parent hash;
- finalized marker;
- observation timestamp.

### DT-INDEX-004 — Duplicate replay

Replaying the same block hash at the same height is idempotent.

### DT-INDEX-005 — Non-finalized replacement

A conflicting non-finalized same-height event may rollback derived state to the previous height and replace it.

### DT-INDEX-006 — Finalized conflict

A conflicting finalized height fails closed with `CONFLICT`.

### DT-INDEX-007 — Finality boundary

A reorg may not cross the retained finalized height.

### DT-INDEX-008 — Parent continuity

Non-contiguous or wrong-parent projection input fails closed rather than fabricating chain continuity.

## 11. Recovery and rebuild

### DT-RECOVERY-001 — Full derived rebuild

Projection state can be discarded and rebuilt deterministically from a strictly ordered canonical event stream.

### DT-RECOVERY-002 — Rebuild validation

Out-of-order rebuild input fails closed.

### DT-RECOVERY-003 — Restart durability

Preferences, idempotency, jobs and projection state survive backend restart through SQLite.

### DT-RECOVERY-004 — Ephemeral state not authoritative

In-memory metrics and request state may be lost on restart without affecting canonical Media/protocol state.

## 12. Secrets boundary

### DT-SECRET-001 — No raw secret config

`RuntimeConfig.raw_secret` is rejected if populated.

### DT-SECRET-002 — Secret references only

Runtime may retain a bounded opaque `secret_provider_ref`, not the secret value itself.

### DT-SECRET-003 — No secrets in projection/preferences/jobs by design

Control-plane schemas contain no private-key or mnemonic fields.

## 13. Observability

### DT-OBS-001 — In-process counters

Runtime tracks bounded operational counters including:

- API requests;
- API errors;
- idempotency replays;
- projection rebuilds;
- completed jobs;
- failed job attempts.

### DT-OBS-002 — Protected metrics

`GET /v1/metrics` requires `doobtube.operator.metrics`.

Observability is application state and does not become protocol authority.

## 14. Health and readiness

### DT-HEALTH-001 — Liveness

`GET /v1/health` reports process liveness and UTC timestamps.

### DT-HEALTH-002 — Dependency-aware readiness

`GET /v1/readiness` requires, at minimum:

- 420Media available;
- ProtocolRegistry available.

Unavailable required dependencies produce HTTP-style status 503 with stable `not_ready` state.

### DT-HEALTH-003 — Readiness identity

Readiness reports configured chain, network, dependency state and schema version.

## 15. Security / boundary decisions

- public feed remains derived/non-authoritative;
- Wallet context is not blanket authorization;
- wrong chain/network fails closed;
- mutation capabilities are allowlisted;
- raw secrets are rejected;
- no protocol custody/accounting exists;
- no private keys are accepted;
- rebuild/operator operations are capability-gated;
- idempotency is actor+operation scoped;
- finality conflicts fail closed;
- unversioned/unknown API routes do not fall through.

## 16. Explicit deferrals

DOOBTUBE-5 does not yet implement:

- raw upload transport;
- media parser/transcoder execution;
- playback CDN/provider verification;
- livestream transport;
- browser/web UI;
- production authentication/session issuer;
- real public testnet dependency endpoints;
- production DB/HA topology;
- production backup/restore;
- deployment/TLS/domain configuration.

Those remain DOOBTUBE-6, -7, -8, -10, -12 and -13 as already defined.

## 17. Invariants

- **DT-API-INV-001:** all DoobTube API routes are versioned under `/v1`.
- **DT-API-INV-002:** mutating application routes require Wallet + correct chain/network + explicit capability.
- **DT-API-INV-003:** same idempotency key cannot execute a changed payload.
- **DT-API-INV-004:** durable idempotency survives restart.
- **DT-API-INV-005:** feed projection contains only READY+PUBLIC+Rights-authorized media.
- **DT-API-INV-006:** derived projection cannot rewrite canonical Media authority.
- **DT-API-INV-007:** finalized projection conflicts fail closed.
- **DT-API-INV-008:** rebuild is deterministic from ordered input.
- **DT-API-INV-009:** jobs have bounded retry/terminal failure.
- **DT-API-INV-010:** raw secrets are rejected.
- **DT-API-INV-011:** metrics/control operations are operator capability-gated.
- **DT-API-INV-012:** readiness is dependency-aware and cannot report ready when required Media/Registry dependencies are down.

## 18. Exit decision

DOOBTUBE-5 is satisfied when:

1. versioned API exists;
2. authentication/authorization is explicit and tested;
3. durable replay-safe idempotency exists;
4. opaque bounded pagination and RFC3339 timestamps exist;
5. stable machine errors exist;
6. persistence schema/migration exists;
7. bounded retry jobs exist;
8. projection reorg/finality handling exists;
9. recovery/rebuild exists;
10. raw-secret boundary exists;
11. observability exists;
12. health/readiness exists;
13. backend compile/build check passes;
14. requirement-mapped backend service/integration tests pass;
15. cumulative DoobTube verifier passes on the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-6 — Media processing, delivery and livestream integration.**
