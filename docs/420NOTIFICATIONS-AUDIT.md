# 420Notifications repository audit — 2026-10-04

## Scope and authority

This audit is grounded in current repository evidence. The canonical application definition is `docs/420NOTIFICATIONS-ROADMAP.md`, reinforced by `docs/420NOTIFICATIONS.md`, `contracts/config/420notifications-genesis.json`, `docs/architecture/infrastructure/observability-status-operator-services.md`, the `notifications/` implementation, 420Indexer IDX-8 integration, Genesis application records and retained NOTIFY-10 closeout evidence.

420Notifications is a contract-free, non-canonical Genesis user application/service. Notifications-specific smart-contract deployment, token custody, upgradeable storage and frozen Notifications contract addresses are therefore **NOT APPLICABLE**, not missing requirements.

Baseline `main`: `2280fb6f9915b849560d9d4d5a95d999c4adc669`.

## Canonical definition

The app exists to provide opt-in alerts derived from canonical or registered sources while preserving provenance, network identity, finality/reorg context and the 420Wallet authorization boundary.

Canonical requirements include:

- service ID `420/service/notifications/v1`;
- no Notifications-specific Genesis contract or canonical state;
- private, reversible subscriptions and separate promotional consent;
- public 420Indexer ingestion through replayable envelopes rather than direct index-database coupling;
- consumer-owned chain-bound replay checkpoints;
- deterministic delivery deduplication, bounded retry/backoff, rate limiting and provider isolation;
- provider-neutral in-app/web/push delivery;
- provenance-safe deep links/handoffs only;
- private-source/payload exclusions;
- private notification history/watchlists/endpoints;
- append-only finalized/retracted/superseded presentation semantics;
- embedded Genesis frontend;
- service failure isolation from all canonical protocol operations;
- alternative clients/providers allowed.

## Architecture discovered

Repository implementation is a Go service with:

- `notifications/architecture` — invariant and authority-boundary model;
- `notifications/subscriptions` — private subscription/consent engine;
- `notifications/ingest` — replay/checkpoint/canonicality processing;
- `notifications/delivery` — queue, dedup, retry, dead-letter, priority and rate policy;
- `notifications/providers` — provider-neutral adapters;
- `notifications/security` — provenance and action-link validation;
- `notifications/feed` and `notifications/api` — private presentation/history service;
- `notifications/hardening` — private-source and abuse hardening;
- `notifications/runtime` — startup configuration, Indexer qualification, liveness/readiness and HTTP service;
- `notifications/web` — embedded dependency-free notification centre;
- `notifications/cmd/notifications420` — executable entrypoint;
- `notifications/closeout` — NOTIFY-10 qualification model.

The service consumes the public 420Indexer notification/event-stream boundary. It does not become authority for source events, Wallet actions, settlement, finality, identity, governance or any other protocol domain.

## File inventory

| Component | Current implementation | Status | Remediation |
|---|---|---|---|
| architecture/invariants | `notifications/architecture` | COMPLETE | none |
| subscription engine | `notifications/subscriptions` | COMPLETE | none |
| replay/Indexer ingestion | `notifications/ingest` | COMPLETE | none |
| delivery queue/retry/dedup | `notifications/delivery` | COMPLETE | none |
| provider-neutral adapters | `notifications/providers` | COMPLETE | none |
| provenance/action security | `notifications/security` | COMPLETE | none |
| private feed/history/API | `notifications/feed`, `notifications/api` | COMPLETE | none |
| privacy/abuse hardening | `notifications/hardening` | COMPLETE | none |
| runtime/readiness | `notifications/runtime` | COMPLETE | none |
| executable | `notifications/cmd/notifications420` | COMPLETE | none |
| Genesis frontend | `notifications/web` | COMPLETE | none |
| closeout qualification model | `notifications/closeout` | COMPLETE | none |
| canonical Genesis config | `contracts/config/420notifications-genesis.json` | COMPLETE | none |
| canonical service ID | `ServiceIds420.sol` + registry tests | COMPLETE | none |
| app manual package | `docs/apps/notifications/**` | COMPLETE | terse but present |
| app-local build/operator README | absent on baseline | PARTIAL | added by this audit |
| app-specific exact-head CI | absent on baseline | PARTIAL | added by this audit |
| live public backend/frontend | readiness URLs = `REPLACE` | BLOCKED | production-equivalent testnet |
| real provider operation | not live | BLOCKED | production-equivalent testnet |
| retained live replay/reorg/restart evidence | not live | BLOCKED | production-equivalent testnet |

## Smart contracts

420Notifications requires no app-specific smart contract. The contract-facing requirement is only canonical service identity/discovery.

Verified repository surfaces include:

- `ServiceIds420.NOTIFICATIONS = keccak256("420/service/notifications/v1")`;
- `ProtocolRegistry` Genesis-service recognition covered by `contracts/test/NotificationsGenesis420.t.sol`;
- `scripts/verify-genesis-dapps.py` checks the Notifications service/authority invariants.

Custody, allowances, fee accounting, reentrancy, upgrade storage layout, bridge proof verification, oracle-write authority and token-transfer semantics are **NOT APPLICABLE** to the Notifications app itself.

## Canonical invariant matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| NOTIFY-INV-001 no canonical state / no app contract | roadmap/config | architecture boundary | architecture + closeout + Genesis verifier | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-002 notification never authoritative | roadmap/config | architecture/feed/runtime/web | architecture/closeout/API | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-003 actionable provenance/origin | roadmap/config | security/feed/web | security/feed/web | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-004 no sign/spend/grant/bypass | roadmap/config | security/web/runtime boundary | security/web/closeout | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-005 opt-in reversible subscriptions + separate promo consent | roadmap/config | subscriptions/API/web | subscription/API/web | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-006 retry/fan-out cannot mutate protocol | roadmap/config | delivery/providers | delivery/providers/closeout | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-007 private payload exclusions | roadmap/config | hardening | hardening/closeout | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-008 private subscriptions/history/endpoints | roadmap/config | subscriptions/feed/hardening | architecture/API/hardening | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-009 chain/provenance/finality context | roadmap/config | ingest/security/feed | ingest/security/feed | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-010 append-only finality/retraction/supersession | roadmap/config | ingest/feed/web | ingest/feed/web | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-011 abuse controls do not redefine truth | roadmap/config | delivery/hardening/runtime | hardening/closeout | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-012 outage cannot block protocol | roadmap/config | no canonical dependency path | architecture/closeout | roadmap/infra docs | COMPLETE | none |
| NOTIFY-INV-013 alternative providers/clients allowed | roadmap/config | provider registry/boundary | providers/architecture | roadmap/docs | COMPLETE | none |
| NOTIFY-INV-014 checkpoint chain binding + post-success advance | roadmap/config | ingest | ingest/closeout | roadmap/docs | COMPLETE | none |

## Phase requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| NOTIFY-0 invariant baseline | roadmap | architecture/config | architecture tests | roadmap | COMPLETE | none |
| NOTIFY-1 runtime scaffold | roadmap | runtime + cmd | runtime package tests | roadmap + README | COMPLETE | none |
| NOTIFY-2 subscription engine | roadmap | subscriptions | subscription tests | roadmap | COMPLETE | none |
| NOTIFY-3 Indexer ingestion/replay | roadmap | ingest | replay/checkpoint tests | roadmap + 420Indexer docs | COMPLETE | none |
| NOTIFY-4 delivery queue/retry/dedup | roadmap | delivery | delivery tests | roadmap | COMPLETE | none |
| NOTIFY-5 provider-neutral adapters | roadmap | providers | provider tests | roadmap | COMPLETE | none |
| NOTIFY-6 provenance/security | roadmap | security | security tests | roadmap | COMPLETE | none |
| NOTIFY-7 API/feed/history | roadmap | API/feed | API/feed tests | roadmap | COMPLETE | none |
| NOTIFY-8 privacy/abuse hardening | roadmap | hardening | hardening tests | roadmap | COMPLETE | none |
| NOTIFY-9 Genesis frontend | roadmap | embedded web | web tests | roadmap | COMPLETE | none |
| NOTIFY-10 repository closeout model | roadmap | closeout | closeout tests | roadmap | COMPLETE | none |
| clean-build operator instructions | audit requirement | app README | dedicated workflow | README | COMPLETE after audit |
| exact-head app-local qualification | audit requirement | notifications-audit workflow | tests/race/vet/build/Genesis verifier | this record | COMPLETE after CI |
| production-equivalent testnet deployment | roadmap post-closeout | not live | cannot be repository-only | roadmap/readiness/README | BLOCKED | live testnet |
| public backend/frontend URLs | readiness record | `REPLACE` / `PENDING` | cannot be repository-only | readiness JSON | BLOCKED | deployment + DNS |
| real provider qualification | roadmap post-closeout | not live | live delivery required | README | BLOCKED | provider credentials/infrastructure |
| live replay/reorg/restart/failure evidence | roadmap post-closeout | not live | live qualification required | roadmap/readiness | BLOCKED | production-equivalent testnet |

## Application layer

### Frontend

The repository contains an embedded dependency-free notification centre under `notifications/web`. Tests assert the unread badge, preferences surface, provenance affordance, Wallet handoff, finalized/retracted/superseded states, security headers and absence of execution-authority controls.

The repository does **not** establish a live public frontend URL; `testnet/public-services/notifications/readiness.json` still records `REPLACE` and `PENDING`.

### Backend / service

The service runtime, API/feed, subscription model, replay processor, delivery queue and provider abstractions exist repository-side. Startup is bound to a configured chain ID and public Indexer endpoint.

A live public service deployment, real provider credentials/endpoints and production-equivalent operational evidence are not repository facts and remain blocked.

## Integration audit

| Dependency | Relationship | Repository status |
|---|---|---|
| 420Indexer | public replay/event source and startup identity/readiness dependency | COMPLETE boundary; live endpoint BLOCKED |
| 420Wallet | authorization/action handoff only; Notifications cannot execute | COMPLETE |
| 420Registry / service IDs | canonical service identity/discovery | COMPLETE |
| Pay / Swap / Bridge / Stake / Governance / Verify / AppStore / Status | source-event classes; Notifications remains downstream/non-authoritative | COMPLETE architecture boundary; live source qualification BLOCKED |
| Bong Goggles and other dApps | registered notification candidate integration | COMPLETE repository-side where implemented |
| Messenger / Commons / Resource / Identity / Attention | explicit private-data exclusions | COMPLETE |
| Smart contracts/frozen addresses | no Notifications-specific contract | NOT APPLICABLE |

No circular authority dependency was identified: source protocols do not depend on notification delivery for canonical operation.

## Security determination

Repository code addresses the app-specific threat surface: authority confusion, wrong-chain input, malformed provenance, hostile URL schemes/userinfo, replay/checkpoint misuse, duplicate delivery, retry amplification, dead-letter behavior, rate limiting, provider failure isolation, private-source leakage, endpoint correlation minimization, hostile/oversized presentation metadata and frontend execution-authority confusion.

No repository-local unresolved vulnerability was identified in the scoped review. This is not a substitute for a live deployment security review, provider-credential review or independent external assessment.

## Documentation determination

The canonical roadmap, architecture/infrastructure docs and standard app manual package are present. The material documentation gap on baseline was the absence of an app-local build/run/deployment/operator README comparable to other Genesis services. This audit adds that README and this durable audit record.

## Readiness state

- CODE COMPLETE: **YES** for the canonical repository implementation.
- BUILD COMPLETE: **YES**, subject to exact-head audit CI on this branch.
- CONTRACT COMPLETE: **YES / NOT APPLICABLE** — no Notifications-specific contract is required; service ID integration exists.
- TEST COMPLETE: **YES** for repository-local requirements after exact-head audit CI; live operational qualification remains separate.
- DOCUMENTATION COMPLETE: **YES** for repository/build/integration/deployment guidance after this audit.
- INTEGRATION COMPLETE: **NO** for live endpoints/provider topology. Repository integration boundaries are complete.
- SECURITY QUALIFIED: **YES** for repository-local scoped hardening after exact-head audit CI; **NO** for live production-equivalent deployment.
- TESTNET READY: **NO** until the official public testnet and real 420Indexer/provider topology are available and qualified.
- GENESIS READY: **NO** as an operational deployment claim until production-equivalent testnet evidence exists. No Genesis contract work is pending.
- PRODUCTION READY: **NO**.

## Outstanding blockers

1. live/public testnet chain and qualified 420Indexer;
2. deployed `notifications420` backend and public frontend endpoints;
3. real in-app/web/push provider configuration and credentials;
4. production-equivalent replay, reorg, restart, rate-limit and failure-injection evidence;
5. retained exact-release endpoint/configuration/provider evidence;
6. live security/operations review before Genesis/production-ready claims.

## Remediation roadmap

1. **NOTIFICATIONS-AUDIT-1 — repository audit remediation + exact-head qualification.** Add app-local README/operator guidance, dedicated exact-head CI and this audit record; qualify tests/race/vet/build/Genesis verifier on the exact final PR head. **Repository work.**
2. **NOTIFICATIONS-AUDIT-2 — production-equivalent testnet deployment.** Deploy `notifications420` against the official chain-420 testnet and qualified public 420Indexer; replace readiness placeholders only with real endpoints. **Blocked on testnet/infrastructure.**
3. **NOTIFICATIONS-AUDIT-3 — live provider/delivery qualification.** Configure real provider adapters/endpoints and prove subscription privacy, deduplication, retry/backoff, rate limiting, dead-letter behavior and provider failure isolation. **Blocked on testnet/provider credentials.**
4. **NOTIFICATIONS-AUDIT-4 — replay/reorg/restart/failure qualification.** Exercise canonical event replay, checkpoint resume, retraction/supersession/finality, restart recovery, Indexer outage/wrong-chain behavior and duplicate-suppression against the deployed topology. **Blocked on testnet.**
5. **NOTIFICATIONS-AUDIT-5 — public endpoint/operational closeout.** Verify backend/frontend DNS/TLS/security headers, monitoring, incident/recovery procedures and retain exact-release deployment/configuration evidence. **Blocked on infrastructure/DNS.**
6. **NOTIFICATIONS-AUDIT-6 — final security + Genesis/production closeout.** Review live provider/privacy/credential exposure, reconcile findings, requalify the exact release and make separate final TESTNET/GENESIS/PRODUCTION declarations. **Blocked on live deployment and human/external review.**

No later step may be declared complete merely because repository tests are green; live steps require live evidence.
