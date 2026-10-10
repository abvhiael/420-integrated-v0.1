# BUD-AUDIT-9 — Level 1 qualification evidence

Date: 2026-10-07

Status: COMPLETE

## Roadmap step

BUD-AUDIT-9 — Security Closeout

Qualification level: Level 1 — app-scoped security qualification.

## Authoritative implementation SHA

`24cd08e9fa759c7702fca8538d4596c25e5078a9`

Qualification merge/base SHA:

`c8e8b58d818611276f7a9bb2b8d2241004450d97`

Current `main` observed at evidence closeout:

`975d0b83338dd8d1b0a60d836adad9d501e75413`

Audit branch:

`audit/budtender-complete-20261007`

PR:

#561 — `audit(budtender): repository-grounded qualification and remediation`

At evidence closeout the branch is 92 commits ahead / 187 commits behind current `main`.

The one `main` commit added after the previously checked `8d8e89058b6badb08156e16562b39d5ae8e526b4` affects only DoobTube web/logo files and does not touch Budtender or shared Gaming dependencies. Earlier comparison of the preceding 186 commits likewise showed no Budtender/Gaming dependency change. Ordinary-step exact-SHA qualification therefore remains valid; reconciliation with current `main` remains intentionally deferred to Level 3.

## Canonical authority

- `docs/budtender/BUD-0-ARCHITECTURE.md`
- `docs/gaming/420GP-16-SECURITY-PRIVACY.md`
- qualified BUD-AUDIT-5 through BUD-AUDIT-8 evidence
- current Budtender simulation/application/web/access implementation
- `.github/workflows/budtender-gaming.yml`

## Security gap analysis

BUD-AUDIT-9 identified two repository-stage browser-host gaps:

1. mutation requests could be parsed as JSON without requiring the `application/json` media type, leaving a simple browser cross-origin POST/CSRF-like path to a locally running host;
2. static and API responses lacked baseline browser security headers.

No protocol, economy, replay, offline, or shared Gaming authority defect was found in previously qualified layers.

## Implementation summary

### Browser/API mutation hardening

`clients/budtender-web-v1/src/server.ts` now:

- requires `application/json` for mutation bodies;
- rejects browser requests with an `Origin` host that differs from the request `Host`;
- permits origin-less local/operator clients without creating browser session authority;
- preserves the existing 16 KiB body cap;
- preserves fail-closed malformed/non-object body handling;
- leaves game state unchanged when rejected.

### Browser response hardening

Static and JSON responses now carry:

- Content-Security-Policy with self-only default source, no base URI, no framing, self-only form action, and no object source;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: no-referrer`;
- restrictive `Permissions-Policy`;
- `Cross-Origin-Resource-Policy: same-origin`;
- `Cache-Control: no-store`.

### Static/path and local exposure protections

- repository-stage default bind remains `127.0.0.1`;
- static serving remains rooted to the client public directory;
- traversal-shaped paths fail closed without leaking package content.

### App-scoped static verifier

Added:

`clients/budtender-web-v1/scripts/security-check.mjs`

It requires the host security controls and loopback default, and rejects obvious dynamic/shell execution surfaces including:

- `eval(...)`;
- `new Function(...)`;
- `node:child_process`;
- `execSync`;
- `spawnSync`.

The verifier is exposed as `npm run security` and runs in the dedicated Budtender workflow.

## Files changed for this step

Executable / test / CI:

- `clients/budtender-web-v1/src/server.ts`
- `clients/budtender-web-v1/test/server.test.ts`
- `clients/budtender-web-v1/scripts/security-check.mjs`
- `clients/budtender-web-v1/package.json`
- `.github/workflows/budtender-gaming.yml`

Substantive documentation before qualification:

- `docs/budtender/BUD-AUDIT-9-SECURITY-CLOSEOUT.md`
- `clients/budtender-web-v1/README.md`
- `docs/audit/BUDTENDER-AUDIT-2026-10-07.md`

Evidence-only closeout follows the qualified implementation SHA.

## BUD-SEC invariants

`BUD-SEC-001` through `BUD-SEC-014` are satisfied at repository stage:

- rejected mutation requests do not mutate game state;
- non-JSON mutation requests fail closed;
- browser cross-origin mutation attempts fail closed;
- static/API responses carry baseline browser security headers;
- repository-stage server defaults to loopback;
- static serving is rooted and traversal-shaped paths fail closed;
- customer/order settlement remains replay-safe;
- caller-controlled pricing cannot override canonical economy pricing;
- presentation/Gaming policy surfaces cannot mutate game state outside sanctioned commands;
- offline reward application remains unavailable;
- wallet/session/Gaming authority remains shared-protocol scoped and optional;
- cross-game/unknown/hostile Gaming state fails closed;
- no obvious dynamic-code/child-process surface exists in the repository-stage host;
- unresolved Gaming live runtime remains deployment-pending and cannot become authoritative by client assertion.

## Test-harness and CI diagnosis during qualification

### Same-origin test-harness defect

Superseded Budtender run:

`37688757785`

SHA:

`e393126ffda7d47039d5043268564f38fb4d6aca`

The `web-client` job correctly returned HTTP 201 for a same-origin mutation, but the test incorrectly treated `CustomerSnapshot.queue` as an object array.

Canonical shape is:

- `queue: string[]`
- full customer records under `customers`.

The assertion was repaired without weakening behavior:

- queue must equal `["same-origin"]`;
- first customer object's `id` must equal `"same-origin"`.

Repair SHA:

`615fe2683d4bea09e939d1cdb83ce5059cb749c8`

This was a test-harness defect, not a security implementation defect.

### Stale concurrency-group orchestration defect

Superseded run `37688757785` also left its `core` job `113023251089` falsely marked `in_progress` with no steps and no logs after the other jobs were cancelled.

That orphaned legacy concurrency state blocked newer exact-head runs.

The connector exposed no run-cancel action, so the narrow root-cause workaround was to rotate the PR concurrency group while preserving its semantics:

`budtender-qualification-v2-${{ github.event.pull_request.number || github.ref }}`

`cancel-in-progress: true` remains enabled.

This workflow configuration change is included in the final implementation SHA and was exact-head qualified.

## Exact-head Level 1 evidence

Workflow: **Budtender Qualification**

Run: **37689407077**

Implementation SHA:

`24cd08e9fa759c7702fca8538d4596c25e5078a9`

Result: **SUCCESS**

### core

Job ID: `113025422730`

- checkout: PASS
- exact-head verification: PASS
- Budtender TypeScript syntax checks: PASS
- complete Budtender core/audit regression suite: PASS

### web-client

Job ID: `113025422958`

- checkout: PASS
- exact-head verification: PASS
- web client syntax checks: PASS
- full web host/API/security test suite: PASS
- same-origin mutation acceptance: PASS
- non-JSON mutation rejection/state integrity: PASS
- cross-origin mutation rejection/state integrity: PASS
- baseline response security headers: PASS
- static path/traversal isolation: PASS
- `npm run security` static security verifier: PASS

### gaming-integration

Job ID: `113025423061`

- checkout: PASS
- exact-head verification: PASS
- shared Gaming SDK tests: PASS
- Budtender Gaming integration tests: PASS

### gaming-client-hardening

Job ID: `113025422923`

- checkout: PASS
- exact-head verification: PASS
- hostile-state/four-game E2E suite: PASS
- cross-game qualification: PASS

### gaming-contract-security

Job ID: `113025422891`

- checkout: PASS
- exact-head verification: PASS
- Foundry toolchain setup: PASS
- shared Gaming Protocol security target build: PASS
- retained `GamingProtocol420*.t.sol` adversarial suite: PASS

## Additional exact-head corroborating runs

These shared Gaming workflows also passed on the final implementation SHA:

- 420 Gaming Client Hardening — run `37689407023`: SUCCESS
- 420 Gaming Four-Game E2E — run `37689406983`: SUCCESS
- 420 Gaming Cross-Game Qualification — run `37689407051`: SUCCESS

They are corroborating coverage only. BUD-AUDIT-9 does not require a new Level 2 milestone because BUD-AUDIT-8 already completed the material shared Gaming integration milestone and this step introduced no new shared authority or lifecycle.

## Security/adversarial result

PASS for the current repository-stage attack surface:

- malformed/oversized input fail-closed behavior;
- cross-origin browser mutation denial;
- JSON media-type enforcement;
- rejected-request state integrity;
- anti-framing/content-sniffing/referrer/capability response headers;
- static path isolation;
- loopback default exposure;
- no obvious dynamic-code/shell surface;
- economy overflow/insufficiency/canonical pricing guards;
- replay-safe settlement;
- offline reward isolation;
- application-service authority isolation;
- canonical Gaming namespace;
- hostile/cross-game Gaming fail-closed behavior;
- retained Gaming Protocol adversarial contract behavior.

No unresolved critical/high repository-stage Budtender security finding remains.

## Level 2 status

Not required.

BUD-AUDIT-8 already completed the app's shared Gaming integration milestone. BUD-AUDIT-9 hardens the existing application boundary without introducing a new cross-component authority or lifecycle.

## Intentionally deferred Level 3 checks

Deferred to final accumulated Budtender app-phase closeout:

- reconciliation with then-current `main`;
- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- global Docs reconciliation;
- retained app/client/service qualification;
- applicable Indexer/Search/RPC checks if later introduced;
- final security/static/deployment/config/build reconciliation;
- roadmap/audit/frozen-address/deployment reconciliation.

The canonical full Foundry inventory is not duplicated here.

## Limitations / later-stage blockers

BUD-AUDIT-9 itself has no remaining repository-stage blocker.

Later release work still includes:

- production hosting hardening;
- TLS/reverse-proxy/WAF configuration;
- durable authentication/session handling if introduced;
- durable versioned persistence/save migration;
- cloud-save authorization and recovery;
- production wallet/signing UX;
- live Gaming Protocol runtime/finality qualification;
- native mobile platform hardening;
- persistent data encryption, backup, and recovery strategy.

These limitations are explicitly outside this repository-stage security closeout.

## Completion state

**BUD-AUDIT-9 — COMPLETE**

Qualified implementation SHA:

`24cd08e9fa759c7702fca8538d4596c25e5078a9`

Evidence-closeout commits are documentation/evidence-only and inherit this exact qualification result without recursive substantive requalification.

## Next canonical roadmap step

**BUD-AUDIT-10 — Deployment & Operations**
