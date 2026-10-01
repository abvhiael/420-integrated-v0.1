# 420Status repository audit — 2026-10-01

## Scope and authority

This audit is grounded in current repository evidence. The canonical app definition is `docs/420STATUS-ROADMAP.md`, reinforced by `docs/architecture/infrastructure/observability-status-operator-services.md`, the `status/` implementation, retained STATUS-10 evidence, Genesis/application records and integration references.

420Status is a contract-free, read-only, non-canonical operational-health and incident-presentation service. Smart-contract deployment, token custody, upgradeable storage and frozen Status contract addresses are therefore **NOT APPLICABLE**, not missing requirements.

Baseline `main`: `f6c4d082f60d2ac706a941c9289ed7a7309cf3ab`.

## Architecture discovered

The implementation is a Go service with:
- typed component registry;
- provider-neutral evidence ingestion;
- freshness/conflict fail-closed aggregation;
- append-only incident and maintenance lifecycle;
- append-only provenance/history;
- privacy-filtered read-only public API;
- SSRF/hostile-input hardening;
- runtime startup qualification against 420Indexer;
- liveness/readiness endpoints;
- embedded dependency-free web frontend;
- cross-phase closeout qualification tests.

The runtime depends on public operational evidence rather than canonical write authority. 420Notifications is downstream. 420Indexer is the startup identity/readiness dependency currently wired by `status420`.

## File inventory

| Component | Current implementation | Status | Remediation |
|---|---|---|---|
| architecture/invariants | `status/architecture` | COMPLETE | none |
| component registry/model | `status/components` | COMPLETE | none |
| evidence/adapters/ingestion | `status/evidence` | COMPLETE | none |
| incidents/maintenance | `status/incidents` | COMPLETE | none |
| aggregation/freshness/conflicts | `status/aggregation` | COMPLETE | none |
| append-only history/provenance | `status/history` | COMPLETE | none |
| public API | `status/api` | COMPLETE | none |
| security hardening | `status/security` | COMPLETE | none |
| runtime/Indexer probe | `status/runtime` | COMPLETE | none |
| service entrypoint | `status/cmd/status420` | COMPLETE | none |
| embedded frontend | `status/web` | COMPLETE | none |
| cross-phase qualification | `status/closeout/qualification_test.go` | COMPLETE | none |
| app-specific README/operator guide | absent on baseline | PARTIAL | added by this audit |
| exact-head app-specific CI | absent on baseline | PARTIAL | added by this audit |
| retained closeout evidence | pre-final text on baseline | STALE | reconciled by this audit |
| live production-equivalent deployment record | no live Status deployment yet | BLOCKED | requires official testnet |

## Smart contracts

420Status requires no Status-specific smart contract. There is no Status custody, token accounting, allowance, upgradeable storage, bridge verifier, oracle-write, governance-write or privileged on-chain role surface to audit. These contract-specific requirements are **NOT APPLICABLE** by canonical design.

The relevant security boundary is instead that Status observations, incidents, registry/discovery metadata and UI state never become canonical protocol authority.

## Canonical invariant matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| STATUS-INV-001 no canonical state / no Status contract | roadmap STATUS-0 | architecture boundary | architecture/closeout | roadmap + infra docs | COMPLETE | none |
| STATUS-INV-002 operational evidence only | roadmap STATUS-0 | aggregation/API/runtime/web non-authority markers | phase + closeout | roadmap + infra docs | COMPLETE | none |
| STATUS-INV-003 observation identity/freshness context | roadmap STATUS-0/3 | evidence model/ingestor | evidence tests | roadmap | COMPLETE | none |
| STATUS-INV-004 preserve references without rewrite | roadmap STATUS-0/6 | evidence/history | evidence/history tests | roadmap | COMPLETE | none |
| STATUS-INV-005 liveness != readiness | roadmap STATUS-0/1/2 | component/runtime models | component/runtime/closeout | roadmap + README | COMPLETE | none |
| STATUS-INV-006 conflict fails closed | roadmap STATUS-0/5 | aggregation engine | aggregation + closeout | roadmap | COMPLETE | none |
| STATUS-INV-007 incident state non-authoritative | roadmap STATUS-0/4 | incidents model/store | incident + closeout | roadmap | COMPLETE | none |
| STATUS-INV-008 private payload exclusion | roadmap STATUS-0/8 | public projections/security | API hardening + closeout | roadmap + README | COMPLETE | none |
| STATUS-INV-009 Status outage cannot block protocol | roadmap STATUS-0 | no canonical dependency path | architecture + closeout isolation | roadmap + infra docs | COMPLETE | none |
| STATUS-INV-010 alternate clients allowed | roadmap STATUS-0 | no exclusivity/canonical authority | architecture | roadmap | COMPLETE | none |
| STATUS-INV-011 stale evidence cannot remain healthy | roadmap STATUS-0/5 | expiry/freshness aggregation + runtime max age | aggregation/runtime | roadmap | COMPLETE | none |
| STATUS-INV-012 maintenance distinct from incident fault | roadmap STATUS-0/4/5 | incident kind + aggregation precedence | incident/aggregation | roadmap | COMPLETE | none |
| STATUS-INV-013 auditable append-only history | roadmap STATUS-0/4/6 | incident/history stores | incident/history | roadmap | COMPLETE | none |
| STATUS-INV-014 Notifications downstream | roadmap STATUS-0 | authority boundary / integration docs | architecture/closeout boundary | roadmap + infra docs | COMPLETE | none |

## Phase requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| STATUS-0 invariant baseline | 420STATUS roadmap | architecture model | architecture tests | roadmap | COMPLETE | none |
| STATUS-1 runtime scaffold | roadmap | runtime + cmd | runtime tests | roadmap + README | COMPLETE | none |
| STATUS-2 component registry | roadmap | components | component tests | roadmap | COMPLETE | none |
| STATUS-3 evidence ingestion | roadmap | evidence | evidence tests | roadmap | COMPLETE | none |
| STATUS-4 incident lifecycle | roadmap | incidents | incident tests | roadmap | COMPLETE | none |
| STATUS-5 aggregation/freshness | roadmap | aggregation | aggregation tests | roadmap | COMPLETE | none |
| STATUS-6 history/provenance | roadmap | history | history tests | roadmap | COMPLETE | none |
| STATUS-7 read-only API | roadmap | api | API tests | roadmap + README | COMPLETE | none |
| STATUS-8 privacy/security | roadmap | security/API/runtime | hardening tests + closeout | roadmap + README | COMPLETE | none |
| STATUS-9 Genesis frontend | roadmap | embedded web | web tests | roadmap + README | COMPLETE | none |
| STATUS-10 repository closeout | roadmap | closeout suite/evidence | closeout tests | roadmap/evidence | COMPLETE | evidence text refreshed |
| clean-build developer instructions | audit requirement | app README | dedicated workflow | README | COMPLETE | none |
| app-specific exact-head qualification gate | audit requirement | status-audit workflow | exact-head Go tests/race/vet/build | this record | COMPLETE | none |
| production-equivalent testnet deployment | roadmap post-closeout | not live | cannot be repository-only | roadmap + README | BLOCKED | live testnet deployment/evidence |
| public production endpoint / DNS | roadmap post-closeout | not live | cannot be repository-only | README | BLOCKED | infrastructure + DNS |
| live incident/recovery exercise | roadmap post-closeout | not live | cannot be repository-only | README | BLOCKED | production-equivalent testnet |

## Integration audit

| Dependency | Relationship | Status |
|---|---|---|
| 420Indexer | startup chain identity/readiness/freshness dependency | COMPLETE repository-side; live endpoint BLOCKED |
| consensus / execution / RPC | observable component classes/evidence sources; never Status authority | COMPLETE model boundary; live wiring BLOCKED |
| Explorer / Search / Analytics | observable public service classes | COMPLETE model boundary; live wiring BLOCKED |
| Storage / AI / Oracle / Bridge | observable provider/service classes | COMPLETE model boundary; live wiring BLOCKED |
| Wallet | observable Wallet-facing service class; Status cannot authorize | COMPLETE model boundary |
| 420Notifications | downstream opt-in incident/recovery delivery | COMPLETE authority boundary; live delivery BLOCKED |
| Registry/service discovery | endpoint identity/discovery only; no protocol authority | COMPLETE architecture boundary |
| Smart contracts/frozen addresses | no Status-specific contract | NOT APPLICABLE |

## Security determination

Repository code explicitly addresses the app-relevant threat surface: authority confusion, stale evidence, conflicting probes, hostile source/reference metadata, public/private data separation, unbounded history requests, SSRF/private-address probing, redirect revalidation, oversized probe bodies, wrong-chain startup, restart readiness and dependency failure isolation.

No repository-local unresolved vulnerability was identified in the scoped implementation review. This is not a substitute for live deployment security qualification or independent external review.

## Documentation determination

Baseline documentation accurately defined the authority model and phase behavior but lacked an app-local build/deploy/operator entry point, and the retained closeout evidence text lagged the roadmap's later final reconciliation record. This audit adds `status/README.md`, this audit record, a dedicated exact-head CI workflow and reconciled retained evidence.

## Readiness

- CODE COMPLETE: **YES** for the canonical repository implementation.
- BUILD COMPLETE: **YES**, subject to exact-head audit CI on this branch.
- CONTRACT COMPLETE: **YES / NOT APPLICABLE** — no Status-specific contract is required.
- TEST COMPLETE: **YES** for repository-local requirements, subject to exact-head audit CI; live operational qualification remains separate.
- DOCUMENTATION COMPLETE: **YES** for repository/build/integration/deployment guidance after this audit.
- INTEGRATION COMPLETE: **NO** for live endpoints/topology. Repository integration boundaries are complete; live wiring requires testnet.
- SECURITY QUALIFIED: **YES** for repository-local scoped hardening after exact-head audit CI; **NO** for live production-equivalent deployment.
- TESTNET READY: **NO** until the official production-equivalent testnet exists and 420Status is deployed against qualified endpoints.
- GENESIS READY: **NO** as an operational deployment claim until testnet deployment evidence exists. No Genesis contract work is pending.
- PRODUCTION READY: **NO**.

## Outstanding blockers and remediation roadmap

1. **STATUS-AUDIT-1 — repository audit remediation and exact-head qualification.** Add app-local documentation, dedicated exact-head CI and reconciled evidence; run tests/race/vet/build against the final PR head. **Repository work.**
2. **STATUS-AUDIT-2 — production-equivalent testnet deployment.** Deploy `status420` against the official chain-420 testnet, real 420Indexer and public service endpoints. **Blocked on testnet/infrastructure.**
3. **STATUS-AUDIT-3 — live hostile/failure qualification.** Exercise wrong-chain, stale/future evidence, dependency outage, conflicting probes, SSRF/redirect protections, maintenance/incident precedence and restart recovery against the deployed topology. **Blocked on testnet.**
4. **STATUS-AUDIT-4 — public endpoint and observability closeout.** Publish the Status hostname/endpoint, verify TLS/DNS/cache/security headers and external availability, retain release SHA/configuration/topology evidence. **Blocked on infrastructure/DNS.**
5. **STATUS-AUDIT-5 — external security and final Genesis operational closeout.** Review live deployment exposure, reconcile findings, and retain final exact-release evidence before a Genesis/production-ready claim. **Blocked on live deployment/human review.**

No later step may be declared complete merely because repository unit tests are green; live steps require live evidence.
