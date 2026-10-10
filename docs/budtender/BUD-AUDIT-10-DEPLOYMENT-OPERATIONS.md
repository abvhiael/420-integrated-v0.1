# BUD-AUDIT-10 — Deployment & Operations

Status: COMPLETE — Level 1 exact-head qualified

## Scope and authority

BUD-AUDIT-10 defines repository-stage deployment and operations requirements for the current Budtender browser-hosted application slice.

Canonical authority:

- `docs/budtender/BUD-0-ARCHITECTURE.md`;
- qualified BUD-AUDIT-5 through BUD-AUDIT-9 evidence;
- `clients/budtender-web-v1`;
- active Budtender qualification workflow.

This step does not claim live public hosting, production TLS termination, durable persistence, native mobile packaging, or live Gaming Protocol testnet qualification.

## Operational model

Budtender currently runs as a Node.js 22+ HTTP service hosting the presentation client and authoritative in-memory application service.

Repository-stage defaults must remain local-safe:

- host `127.0.0.1`;
- port `4207`;
- no public-origin claim;
- no live deployment claim;
- no testnet-qualified claim.

## Runtime configuration

Supported environment variables:

- `HOST`;
- `PORT`;
- `BUDTENDER_PUBLIC_ORIGIN`.

Rules:

- `PORT` must be an integer in 1..65535;
- empty/invalid hosts fail startup;
- loopback hosts may operate without a public origin;
- any non-loopback host requires an explicit `BUDTENDER_PUBLIC_ORIGIN`;
- non-loopback deployment requires an HTTPS public origin;
- the public-origin value must be an origin only, with no credentials/path/query/fragment.

Remote exposure policy is therefore explicit and fail-closed.

## Health and readiness

`GET /healthz` reports process/service liveness.

`GET /readyz` reports whether the service is ready for application traffic.

Liveness is intentionally independent from readiness.

During shutdown, readiness must become false before listener close begins.

Health/readiness payloads are operational metadata only and are not game/protocol authority.

## Graceful shutdown

The repository host must handle:

- `SIGTERM`;
- `SIGINT`.

Shutdown behavior:

1. mark readiness false;
2. mark the service as shutting down;
3. stop accepting new listener traffic through `server.close`;
4. preserve visible failure reporting if close returns an error.

No gameplay or blockchain state is manufactured during shutdown.

## Deployment manifest

`clients/budtender-web-v1/deployment.runtime.json` records the repository deployment contract:

- Node runtime;
- package/entrypoint;
- default host/port;
- health/readiness paths;
- remote exposure policy;
- persistence mode;
- Gaming runtime state;
- explicit `liveDeployment: false`;
- explicit `testnetQualified: false`.

This manifest must not be edited to pretend a live deployment exists before BUD-AUDIT-11.

## Operations verifier

`npm run ops` must fail if:

- health/readiness endpoints disappear;
- graceful shutdown hooks disappear;
- runtime exposure guards disappear;
- package runtime/start/ops scripts drift;
- deployment manifest claims live deployment or testnet qualification prematurely;
- health/readiness manifest paths drift.

## BUD-OPS invariants

- `BUD-OPS-001`: repository default bind is loopback-only.
- `BUD-OPS-002`: invalid port/host/public-origin configuration fails closed.
- `BUD-OPS-003`: non-loopback bind requires explicit HTTPS public origin.
- `BUD-OPS-004`: liveness and readiness are separate operational signals.
- `BUD-OPS-005`: readiness fails closed when service is not ready/shutting down.
- `BUD-OPS-006`: health/readiness do not mutate gameplay state.
- `BUD-OPS-007`: SIGTERM/SIGINT initiate graceful listener shutdown.
- `BUD-OPS-008`: repository manifest cannot claim live deployment/testnet qualification.
- `BUD-OPS-009`: operations verifier guards the deployment contract.
- `BUD-OPS-010`: Gaming runtime remains deployment-pending until live qualification.
- `BUD-OPS-011`: in-memory persistence limitation remains explicit.
- `BUD-OPS-012`: external TLS/reverse-proxy/platform configuration remains outside repository-host authority.

## Level 1 qualification

Required exact-head qualification:

- Budtender core syntax/tests;
- web host syntax/tests;
- runtime-config tests;
- health/readiness tests;
- BUD-AUDIT-9 security verifier;
- BUD-AUDIT-10 operations verifier;
- Budtender Gaming integration regressions;
- retained Gaming hostile-state/adversarial suite.

Level 2 is not required because this step introduces no new shared protocol authority or cross-component lifecycle milestone.

Level 3 remains deferred to the final app-phase closeout.

## Exit criteria

BUD-AUDIT-10 is COMPLETE only when:

1. BUD-OPS-001 through BUD-OPS-012 are satisfied;
2. runtime config validates/fails closed as specified;
3. health/readiness semantics are implemented and tested;
4. graceful shutdown hooks exist;
5. repository deployment manifest is present and truthful;
6. operations verifier passes;
7. BUD-AUDIT-9 security regressions remain green;
8. exact-head Budtender Qualification passes (satisfied by `8506349da6c700d9f5cbf9df1b9c528657447130`, run `37694891271`);
9. durable evidence records implementation/evidence SHA, current main/base, jobs/results, limitations, blockers, and next roadmap step (recorded in `docs/audit/BUD-AUDIT-10-EVIDENCE-2026-10-07.md`);
10. live deployment/testnet work remains explicitly deferred to BUD-AUDIT-11 rather than falsely marked complete.

## Next canonical roadmap step

**BUD-AUDIT-11 — Live Testnet Qualification**
