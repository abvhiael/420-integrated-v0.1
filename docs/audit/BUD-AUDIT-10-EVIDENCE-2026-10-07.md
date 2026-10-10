# BUD-AUDIT-10 — Level 1 qualification evidence

Date: 2026-10-07

Status: COMPLETE

## Roadmap step

BUD-AUDIT-10 — Deployment & Operations

Qualification level: Level 1 — ordinary app-scoped deployment/operations qualification.

## Authoritative implementation SHA

`8506349da6c700d9f5cbf9df1b9c528657447130`

Qualification merge/base SHA:

`c8e8b58d818611276f7a9bb2b8d2241004450d97`

Current `main` observed at qualification/evidence closeout:

`975d0b83338dd8d1b0a60d836adad9d501e75413`

Audit branch:

`audit/budtender-complete-20261007`

PR:

#561 — `audit(budtender): repository-grounded qualification and remediation`

At qualification closeout the branch was 109 commits ahead / 187 commits behind current `main`.

BUD-AUDIT-10 is an ordinary step. Reconciliation with current `main` is intentionally deferred to Level 3 because current-main divergence does not alter Budtender or the shared Gaming dependencies qualified here.

## Canonical authority

- `docs/budtender/BUD-0-ARCHITECTURE.md`
- qualified BUD-AUDIT-5 through BUD-AUDIT-9 evidence
- `clients/budtender-web-v1`
- active `.github/workflows/budtender-gaming.yml`
- repository off-chain service operations patterns

No pre-existing repository file named BUD-AUDIT-10 existed before this step. The step was frozen from the approved canonical roadmap name **Deployment & Operations** and the actual repository release boundary without inventing gameplay, persistence, hosting, or live-testnet functionality.

## Gap analysis

Before BUD-AUDIT-10, the repository-stage Budtender web host lacked:

- validated HOST/PORT/public-origin runtime configuration;
- explicit fail-closed remote-exposure policy;
- liveness endpoint;
- readiness endpoint;
- graceful SIGTERM/SIGINT shutdown;
- repository deployment-state manifest;
- deployment/operations verifier;
- deployment/operator runbook;
- CI coverage for deployment/operations controls.

The repository also had to continue stating truthfully that:

- gameplay persistence is in-memory;
- live public deployment is not yet qualified;
- Gaming Protocol live runtime is deployment-pending;
- production/testnet qualification belongs to BUD-AUDIT-11.

## Implementation summary

### Validated runtime configuration

Added:

`clients/budtender-web-v1/src/runtime-config.ts`

Controls:

- default `HOST=127.0.0.1`;
- default `PORT=4207`;
- PORT must be an integer in 1..65535;
- invalid/empty runtime inputs fail closed;
- loopback hosts may run without a public-origin declaration;
- non-loopback HOST requires `BUDTENDER_PUBLIC_ORIGIN`;
- non-loopback deployment requires an HTTPS public origin;
- public origin must contain no credentials, path, query, or fragment.

### Health/readiness

`clients/budtender-web-v1/src/server.ts` now exposes:

- `GET /healthz` — process/service liveness;
- `GET /readyz` — application traffic readiness.

Readiness and liveness are distinct. Readiness returns 503 while the service is not ready/shutting down without turning liveness into a false failure signal.

### Graceful shutdown

The repository host now handles:

- `SIGTERM`;
- `SIGINT`.

Shutdown:

1. marks readiness false;
2. marks the host as shutting down;
3. calls `server.close`;
4. reports a close failure through stderr/exitCode.

### Repository deployment manifest

Added:

`clients/budtender-web-v1/deployment.runtime.json`

It records:

- Node >=22 runtime;
- package/entrypoint;
- default host/port;
- health/readiness paths;
- remote exposure policy;
- external TLS termination boundary;
- `persistence: "in-memory"`;
- `gamingRuntime: "deployment-pending"`;
- `liveDeployment: false`;
- `testnetQualified: false`.

The manifest therefore cannot be used as false evidence of a live or testnet-qualified release.

### Operations verifier

Added:

`clients/budtender-web-v1/scripts/operations-check.mjs`

Exposed as:

`npm run ops`

It fails if:

- health/readiness endpoints disappear;
- SIGTERM/SIGINT/server-close controls disappear;
- runtime exposure guards disappear;
- Node/start/ops package contract drifts;
- the deployment manifest claims live deployment or testnet qualification;
- health/readiness paths drift.

### Operations documentation

Added:

- `docs/budtender/BUD-AUDIT-10-DEPLOYMENT-OPERATIONS.md`
- `docs/budtender/BUD-AUDIT-10-OPERATIONS-RUNBOOK.md`

Updated:

- `clients/budtender-web-v1/README.md`
- `docs/audit/BUDTENDER-AUDIT-2026-10-07.md`

The runbook documents startup, configuration, probes, shutdown, recovery, monitoring, deployment manifest semantics, and current release limitations.

## Files changed for BUD-AUDIT-10

Executable/configuration/test/CI:

- `clients/budtender-web-v1/src/runtime-config.ts`
- `clients/budtender-web-v1/src/server.ts`
- `clients/budtender-web-v1/deployment.runtime.json`
- `clients/budtender-web-v1/scripts/operations-check.mjs`
- `clients/budtender-web-v1/scripts/security-check.mjs`
- `clients/budtender-web-v1/test/runtime-config.test.ts`
- `clients/budtender-web-v1/test/server.test.ts`
- `clients/budtender-web-v1/package.json`
- `.github/workflows/budtender-gaming.yml`

Documentation:

- `docs/budtender/BUD-AUDIT-10-DEPLOYMENT-OPERATIONS.md`
- `docs/budtender/BUD-AUDIT-10-OPERATIONS-RUNBOOK.md`
- `clients/budtender-web-v1/README.md`
- `docs/audit/BUDTENDER-AUDIT-2026-10-07.md`

## BUD-OPS invariant disposition

All BUD-OPS-001 through BUD-OPS-012 are satisfied at repository stage:

- `BUD-OPS-001`: default bind remains loopback-only.
- `BUD-OPS-002`: invalid host/port/public-origin configuration fails closed.
- `BUD-OPS-003`: non-loopback exposure requires explicit HTTPS public origin.
- `BUD-OPS-004`: liveness and readiness are separate signals.
- `BUD-OPS-005`: readiness fails closed when not ready/shutting down.
- `BUD-OPS-006`: health/readiness do not mutate gameplay state.
- `BUD-OPS-007`: SIGTERM/SIGINT initiate graceful listener shutdown.
- `BUD-OPS-008`: deployment manifest cannot claim live/testnet qualification.
- `BUD-OPS-009`: operations verifier protects the repository deployment contract.
- `BUD-OPS-010`: Gaming runtime remains deployment-pending until live qualification.
- `BUD-OPS-011`: in-memory persistence limitation remains explicit.
- `BUD-OPS-012`: TLS/reverse-proxy/platform configuration remains external to the repository host.

## Qualification diagnosis

Two CI/test issues were encountered and diagnosed before rerunning exact-head qualification.

### Security-verifier drift

Superseded run:

`37694580207`

Superseded implementation/documentation SHA:

`bce49086c6872234b300421b46d9100f283ca2d2`

Web-client job:

`113043042421`

Observed:

- syntax checks: PASS;
- web host/API tests: PASS;
- BUD-AUDIT-9 security verifier: FAIL;
- operations verifier: skipped after that failure.

Failure:

`missing required Budtender web security control: server.listen(port, "127.0.0.1"`

Root cause:

BUD-AUDIT-10 moved the same loopback-security property from a hard-coded `server.listen` literal into validated runtime configuration. The BUD-AUDIT-9 verifier still asserted the obsolete implementation form.

Repair:

The security verifier now reads the runtime configuration and requires:

- the loopback default;
- non-loopback public-origin requirement;
- HTTPS public-origin requirement.

This preserves the security invariant instead of weakening it.

Repair SHA:

`bde5538cc611681d671cbb0d468cb2ad00ab092a`

### Stale concurrency-group orchestration

Superseded Budtender runs #83/#84 were not reliably cancelled by GitHub PR concurrency despite `cancel-in-progress: true`, causing the final exact-head run to remain blocked behind stale work.

The connector exposed no cancellation action.

Narrow repair:

Concurrency group rotated from:

`budtender-qualification-v2-...`

to:

`budtender-qualification-v3-...`

while retaining:

`cancel-in-progress: true`

This CI configuration change created the final implementation SHA and was itself exact-head qualified.

## Exact-head Level 1 evidence

Workflow:

**Budtender Qualification**

Run:

**37694891271**

Run number:

**86**

Implementation SHA:

`8506349da6c700d9f5cbf9df1b9c528657447130`

Result:

**SUCCESS**

### web-client

Job:

`113044079291`

Result: **SUCCESS**

- checkout: PASS
- exact-head verification: PASS
- web-client syntax check: PASS
- complete web-client tests: PASS
- BUD-AUDIT-9 security verifier: PASS
- **BUD-AUDIT-10 deployment operations verifier: PASS**

Covered BUD-AUDIT-10 behavior includes:

- safe runtime defaults;
- invalid PORT rejection;
- remote bind without public origin rejection;
- non-HTTPS remote origin rejection;
- valid explicit HTTPS remote exposure acceptance;
- malformed public-origin rejection;
- liveness/readiness distinction;
- readiness 503 when withdrawn;
- liveness remaining available while readiness is false.

### core

Job:

`113044079656`

Result: **SUCCESS**

- exact-head verification: PASS
- Budtender TypeScript syntax: PASS
- complete Budtender core/audit regression suite: PASS

### gaming-integration

Job:

`113044079662`

Result: **SUCCESS**

- exact-head verification: PASS
- shared Gaming SDK: PASS
- Budtender Gaming integration: PASS

### gaming-client-hardening

Job:

`113044079888`

Result: **SUCCESS**

- exact-head verification: PASS
- hostile-state/four-game E2E: PASS
- Gaming cross-game qualification: PASS

### gaming-contract-security

Job:

`113044079502`

Result: **SUCCESS**

- exact-head verification: PASS
- Foundry setup: PASS
- shared Gaming Protocol security build: PASS
- retained Gaming Protocol adversarial suite: PASS

## Additional exact-head corroborating Gaming runs

Also SUCCESS on `8506349da6c700d9f5cbf9df1b9c528657447130`:

- 420 Gaming Four-Game E2E — run `37694891283`
- 420 Gaming Client Hardening — run `37694891266`
- 420 Gaming Cross-Game Qualification — run `37694891269`

These are corroborating retained shared-Gaming checks, not a new Level 2 milestone.

The 420Docs workflow was skipped on this ordinary app-scoped step and is not a Level 1 requirement. Repository-wide Docs reconciliation remains a Level 3 responsibility.

## Security / operational result

PASS for the current repository-stage deployment surface:

- configuration failure paths;
- safe default exposure;
- explicit remote exposure;
- HTTPS origin requirement;
- liveness/readiness distinction;
- graceful shutdown hooks;
- truthful deployment manifest;
- security verifier regression;
- operations verifier;
- existing browser/API security boundary;
- Gaming hostile-state and cross-game protections;
- retained Gaming Protocol adversarial behavior.

No unresolved BUD-AUDIT-10 repository-stage implementation defect remains.

## Level 2 status

Not required.

BUD-AUDIT-10 adds repository-stage operationalization but no new shared protocol authority, cross-component lifecycle, or app integration milestone beyond the previously qualified BUD-AUDIT-8 shared Gaming boundary.

## Intentionally deferred Level 3 work

Deferred to final accumulated Budtender phase closeout:

- reconciliation with then-current `main`;
- canonical full repository Solidity inventory exactly once under Solidity ownership;
- Genesis/address-authority qualification without duplicating the full Foundry inventory;
- 420 Integrated/global qualification;
- global Docs reconciliation;
- retained Budtender app/client/service qualification;
- any later-applicable Indexer/Search/RPC/frontend/backend qualification;
- complete security/static/deployment/config/build reconciliation;
- audit/roadmap/evidence/frozen-address/deployment-state reconciliation.

## Current limitations / later-stage blockers

BUD-AUDIT-10 itself has no remaining repository-stage blocker.

Still intentionally unresolved:

- durable versioned save/persistence;
- cloud-save service/authorization/recovery;
- production TLS/reverse-proxy/WAF configuration;
- production hosting/platform deployment;
- native iOS/Android packaging;
- live Gaming Protocol chain/contract/operator runtime;
- live testnet finality/registry/entitlement journeys;
- persistent data encryption/backup/recovery.

These do not block BUD-AUDIT-10 because live deployment qualification is the next canonical step.

## Completion state

**BUD-AUDIT-10 — COMPLETE**

Qualified implementation SHA:

`8506349da6c700d9f5cbf9df1b9c528657447130`

Evidence-only commits after this implementation SHA inherit the exact qualification result and do not require recursive substantive requalification.

## Next canonical roadmap step

**BUD-AUDIT-11 — Live Testnet Qualification**
