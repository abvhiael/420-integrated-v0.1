---
title: 420AppStore Repository Audit — 2026-10-04
audience: [developer, operator, security, governance]
category: audit
status: development
version: current
---
# 420AppStore repository audit — 2026-10-04

## Scope and authority

This audit treats the repository and current `main` as authoritative. The canonical AppStore definition is `contracts/config/420appstore-genesis.json`, the APPSTORE-0 through APPSTORE-10 roadmap, the AppStore architecture documents, the merged implementation, and committed qualification/readiness evidence.

The audit began from `main` commit `bec8fb5b43f48c3df8862eee93d9a33769cec5e7`. Historical GEN-10.6 implementation PR #305 is merged, but historical phase qualification is not accepted as proof that the current repository head is complete.

## Canonical application definition

420AppStore is a Genesis user application and is intentionally contract-free. It is a curated, non-authoritative discovery layer. Canonical application/service identity, version, implementation and chain provenance belong to 420Registry / ProtocolRegistry and chain state. Wallet and Smart Accounts remain the authorization boundary. Catalogue ranking, categories, reviews, descriptions, screenshots, featured placement and sponsorship remain non-canonical. AppStore must not index designated private/encrypted ecosystem payloads or publish launch/install history by default.

No AppStore-specific Genesis smart contract is required. ProtocolRegistry is an upstream dependency, not an AppStore-owned contract.

## Architecture found

The repository contains the intended implementation layers:

- `appstore/architecture`: authority model and APP-INV enumeration;
- `appstore/runtime`: configuration, RPC network/Registry startup probe, health/readiness;
- `appstore/registry`: canonical Registry projection and source abstraction;
- `appstore/catalog`: deterministic non-canonical persistence of canonical projection data;
- `appstore/curation`: non-canonical presentation metadata and ranking;
- `appstore/security`: sourced verification/audit/publisher/trust/deprecation warning presentation;
- `appstore/wallet`: permission/capability presentation and Wallet handoff;
- `appstore/api`: read-only browse/search/category/detail API;
- `appstore/hardening`: metadata, URL, privacy, dependency and limiter policy;
- `appstore/web`: embedded dependency-free Genesis frontend;
- `appstore/cmd/appstore420`: production executable entrypoint.

The pieces exist, but the production executable does not compose them into the application described by APPSTORE-2 through APPSTORE-9.

## Critical finding: production runtime is incomplete

`appstore/cmd/appstore420/main.go` performs only the APPSTORE-1 startup network check and serves `runtime.Service.Handler()`. That handler exposes only `/healthz` and `/readyz`.

The APPSTORE-AUDIT-2 remediation now creates a concrete 420Indexer-backed `registry.Source`, binds it to the configured chain/frozen ProtocolRegistry address, filters the projection to the Indexer finalized boundary, validates the resulting snapshot through APPSTORE-2 projection rules, and runs the initial synchronization before the process starts serving.

The production executable still does **not**:

1. restore/rebuild and persist the APPSTORE-3 catalogue as part of runtime lifecycle;
2. compose canonical records with APPSTORE-4 curation, APPSTORE-5 security provenance and APPSTORE-6 Wallet handoff into `api.ApplicationView` values;
3. mount the APPSTORE-7 `/v1/apps*` discovery API;
4. mount the APPSTORE-9 embedded frontend;
5. connect the APPSTORE-8 limiter/dependency assessment to the public request path.

Therefore the historical readiness statement `implementation_status: QUALIFIED` overstated the current executable state. This audit changes the current readiness status to `PARTIAL` while preserving old run IDs only as historical provenance.

APPSTORE-AUDIT-2 makes that previously-open source decision explicitly: production uses the repository's 420Indexer Registry projection as a non-authoritative observation source, constrained to the Indexer finalized boundary and cross-bound to the frozen ProtocolRegistry deployment. ProtocolRegistry/chain state remain canonical.

## Security findings repaired in this audit

### Registry projection synchronization

The prior `Projection.Apply` read `p.finalized` outside the mutex, creating a data-race risk under concurrent synchronization/read activity. `Rebuild` also cleared live projection state before validating/applying the replacement snapshot, which could expose transient empty state and permitted a finality-regressing rebuild.

The remediation stages and validates records before the atomic swap, performs finality checks while locked, and preserves the existing projection when a rebuild is rejected. Concurrent replay/read coverage is added and the dedicated audit workflow runs `go test -race ./appstore/...`.

### Public URL and Wallet deep-link hardening

The prior Wallet handoff accepted plain HTTP application URLs and the shared URL validator rejected localhost but not the complete class of literal private/link-local IP targets. The remediation requires Wallet handoffs to use the shared public-URL validator and rejects loopback, private, unspecified, link-local and multicast IP literals plus localhost/local hostnames.

### Curation rating validation

The prior rating range check accepted IEEE NaN because ordinary range comparisons with NaN are false. Infinite values were also not explicitly rejected. The remediation rejects NaN and positive/negative infinity.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Contract-free/non-canonical authority | Genesis config; APPSTORE-0 | architecture boundary present | boundary/closeout tests | present | COMPLETE | none |
| APP-INV-001..013 | Genesis config | enumerated | closeout coverage | present | COMPLETE | keep exact-head qualification |
| Startup chain/network qualification | APPSTORE-1 | RPC chain ID + Registry bytecode probe | runtime tests | present | COMPLETE | live network qualification still required |
| Canonical Registry ingestion | APPSTORE-2 | projection + concrete finalized 420Indexer-backed production Source wired at startup | source/projection/adversarial tests | present | COMPLETE (local) | live testnet qualification deferred to APPSTORE-AUDIT-7 |
| Deterministic projection/persistence | APPSTORE-3 | store/rebuild/restore present; concurrency repaired | store/registry/race tests | present | COMPLETE | integrate into production lifecycle |
| Curation/ranking | APPSTORE-4 | package present; noncanonical boundaries enforced | policy tests | present | COMPLETE | wire metadata source/runtime composition |
| Security provenance | APPSTORE-5 | evidence package present | evidence tests | present | COMPLETE | wire live provenance inputs |
| Wallet handoff | APPSTORE-6 | presentation/handoff present; URL hardening repaired | handoff tests | present | COMPLETE | wire runtime ApplicationView generation |
| Discovery API | APPSTORE-7 | handler package present | API tests | present | PARTIAL | mount in production executable |
| Privacy/abuse/failure policy | APPSTORE-8 | validators/limiter/dependency assessment present | hardening tests | present | PARTIAL | wire limiter/dependency state into public service |
| Genesis frontend | APPSTORE-9 | embedded static UI present | web tests | present | PARTIAL | mount in production executable and qualify real endpoint |
| Exact-head closeout | APPSTORE-10 | historical evidence only; dedicated audit workflow added here | race/vet/build/evidence workflow | docs present | PARTIAL | obtain green exact-head audit run; later live-testnet evidence |
| AppStore-specific contracts | Genesis config | none required | n/a | explicit | NOT APPLICABLE | none |
| Live testnet backend/frontend | readiness | no deployed URLs | no live E2E evidence | placeholder/pending | BLOCKED | requires testnet deployment/infrastructure |
| Production deployment | APPSTORE-10/readiness | no production config/evidence | none | incomplete operational evidence | BLOCKED | follows runtime completion + testnet qualification |

## Documentation audit

The repository has the APPSTORE-0 through APPSTORE-10 architecture/phase documents plus user-oriented AppStore documentation. The principal contradiction found was the readiness JSON claiming implementation qualification despite the production executable not serving the implemented API/frontend or performing Registry catalogue composition. This audit corrects that readiness state.

A dedicated AppStore audit verifier and workflow are added because the generic qualification workflows do not, by themselves, provide AppStore-specific requirement coverage.

## Smart-contract determination

**AppStore-specific contract status: NOT APPLICABLE.** The Genesis config explicitly sets `contractsRequired=false`. ProtocolRegistry remains the canonical upstream contract. The audit did not create a new contract, reserve a new address, or transfer canonical authority to AppStore.

## Readiness determination at this audit stage

- CODE COMPLETE: **NO** — production composition/wiring is missing.
- BUILD COMPLETE: **pending exact-head workflow**.
- CONTRACT COMPLETE: **YES / NOT APPLICABLE for AppStore-owned contracts**.
- TEST COMPLETE: **NO** — repository-level tests are being strengthened, but live integration and testnet E2E remain absent.
- DOCUMENTATION COMPLETE: **NO** — production runtime/deployment/operator procedure must be updated after the source/wiring decision.
- INTEGRATION COMPLETE: **NO** — Registry source wiring is implemented, but catalogue lifecycle/composition and API/frontend runtime wiring remain incomplete.
- SECURITY QUALIFIED: **NO** — local hardening is improved, but the final composed service and live dependency behavior are not yet qualified.
- TESTNET READY: **NO**.
- GENESIS READY: **NO** as an operable AppStore service, despite the contract-free canonical definition being frozen.
- PRODUCTION READY: **NO**.

## Audit completion statement

**Repository audit status: COMPLETE. Remediation status: OPEN.**

The audit has established the canonical AppStore definition, inspected the implemented packages and production entrypoint, reconciled historical qualification claims against current repository behavior, repaired the bounded local security defects identified during inspection, and recorded a requirement matrix and remediation roadmap.

The final audit determination is that **420AppStore is not presently complete or release-ready as an operable Genesis application**. Its contract-free authority model and most component packages are implemented, but the production composition path is incomplete: the executable now binds and synchronizes a concrete finalized Registry catalogue source, but it does not yet bind catalogue lifecycle, ApplicationView composition, discovery API, embedded frontend, abuse/dependency controls, and live deployment evidence into one qualified service.

Historical APPSTORE-9/10 evidence remains provenance only and must not be used to override this current determination. Live-testnet and production claims remain blocked until the remediation roadmap is completed and requalified.

## Remediation roadmap

1. **APPSTORE-AUDIT-1 — durable audit baseline and local hardening.** Preserve this report, truthful readiness state, race-safe Registry projection, deep-link hardening, finite rating validation, and exact-head audit workflow.
2. **APPSTORE-AUDIT-2 — production canonical source.** **IMPLEMENTED; Level 1 qualification pending exact-head CI.** Production uses the explicitly qualified 420Indexer-backed finalized ProtocolRegistry projection, with chain/Registry/finality/authority-claim and malformed/upstream-failure checks.
3. **APPSTORE-AUDIT-3 — runtime catalogue lifecycle.** Wire source sync, deterministic store restore/rebuild, interruption recovery, and stale-state handling into `appstore420`.
4. **APPSTORE-AUDIT-4 — ApplicationView composition.** Define and wire curation/security/Wallet/link inputs without allowing any presentation source to override canonical Registry fields.
5. **APPSTORE-AUDIT-5 — public service composition.** Mount health/readiness, `/v1/apps*`, embedded frontend, abuse controls and dependency-state behavior under one production handler; readiness must represent the composed application, not only Registry bytecode reachability.
6. **APPSTORE-AUDIT-6 — repository qualification.** Run formatting, race tests, vet, production build, documentation qualification, and requirement-specific exact-head checks.
7. **APPSTORE-AUDIT-7 — live testnet qualification.** Deploy backend/frontend, populate real URLs, exercise canonical Registry ingestion, restart/rebuild, Wallet handoff, outage/degraded cases, privacy boundaries and browser/API behavior against the live testnet.
8. **APPSTORE-AUDIT-8 — Genesis/production closeout.** Record exact deployment/configuration evidence, monitoring/recovery procedure, final security review and production-domain configuration, then requalify the exact release head.

Do not mark 420AppStore COMPLETE until APPSTORE-AUDIT-1 through APPSTORE-AUDIT-8 are satisfied or a later repository-authoritative decision explicitly narrows the canonical scope.
