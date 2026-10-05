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

The pieces exist, and APPSTORE-AUDIT-2 through APPSTORE-AUDIT-5 now wire canonical source ingestion, catalogue lifecycle, retained ApplicationView composition, the discovery API, embedded frontend, abuse controls and dependency-aware public service composition. APPSTORE-AUDIT-6 qualifies that repository-side composition; live public-testnet evidence remains outstanding.

## Critical finding: production runtime is incomplete

`appstore/cmd/appstore420/main.go` now performs the APPSTORE-1 network qualification, APPSTORE-2 finalized Registry ingestion, APPSTORE-3 catalogue bootstrap/refresh, APPSTORE-AUDIT-4 ApplicationView composition and APPSTORE-AUDIT-5 public service composition before serving the dependency-aware public handler.

The APPSTORE-AUDIT-2 remediation now creates a concrete 420Indexer-backed `registry.Source`, binds it to the configured chain/frozen ProtocolRegistry address, filters the projection to the Indexer finalized boundary, validates the resulting snapshot through APPSTORE-2 projection rules, and runs the initial synchronization before the process starts serving.

The production executable now performs the repository-side APPSTORE-2 through APPSTORE-9 composition required by this remediation. Remaining incompleteness is operational rather than missing repository wiring: live public-testnet backend/frontend endpoints, live Registry/RPC/Verify behavior, restart/rebuild and browser/Wallet evidence still require APPSTORE-AUDIT-7.

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
| Deterministic projection/persistence | APPSTORE-3 | production restore/rebuild/persist/refresh lifecycle wired | store/registry/race tests | present | COMPLETE | live testnet qualification later |
| Curation/ranking | APPSTORE-4 | noncanonical package plus production ApplicationView composition input wired | policy/composition tests | present | COMPLETE (local) | live/operator input qualification later |
| Security provenance | APPSTORE-5 | evidence package integrated into ApplicationView composition | evidence/composition tests | present | COMPLETE (local) | live provenance-source qualification later |
| Wallet handoff | APPSTORE-6 | handoff and requested-scope inputs integrated into canonical-bound ApplicationView composition | handoff/composition tests | present | COMPLETE (local) | live Wallet qualification later |
| Discovery API | APPSTORE-7 | dynamic `/v1/apps*` handler mounted in production public service | API/public-service tests | present | COMPLETE (repository) | live testnet qualification later |
| Privacy/abuse/failure policy | APPSTORE-8 | validators, limiter and dependency-aware BLOCKED/DEGRADED behavior wired in production | hardening/public-service tests | present | COMPLETE (repository) | live outage/degraded qualification later |
| Genesis frontend | APPSTORE-9 | embedded static UI mounted at `/` under production handler | web/public-service tests | present | COMPLETE (repository) | qualify real endpoint on testnet |
| Exact-head repository qualification | APPSTORE-10 / audit remediation | exact-head AppStore and Docs repository gates pass on accumulated implementation | race/vet/build/verifier + Docs qualification | docs present | COMPLETE (pre-testnet repository gate) | final reconciled Level 3 closeout remains later |
| AppStore-specific contracts | Genesis config | none required | n/a | explicit | NOT APPLICABLE | none |
| Live testnet backend/frontend | readiness | no deployed URLs | no live E2E evidence | placeholder/pending | BLOCKED | requires testnet deployment/infrastructure |
| Production deployment | APPSTORE-10/readiness | no production config/evidence | none | incomplete operational evidence | BLOCKED | follows runtime completion + testnet qualification |

## Documentation audit

The repository has the APPSTORE-0 through APPSTORE-10 architecture/phase documents plus user-oriented AppStore documentation. The principal contradiction found was the readiness JSON claiming implementation qualification despite the production executable not serving the implemented API/frontend or performing Registry catalogue composition. This audit corrects that readiness state.

A dedicated AppStore audit verifier and workflow are added because the generic qualification workflows do not, by themselves, provide AppStore-specific requirement coverage.

## Smart-contract determination

**AppStore-specific contract status: NOT APPLICABLE.** The Genesis config explicitly sets `contractsRequired=false`. ProtocolRegistry remains the canonical upstream contract. The audit did not create a new contract, reserve a new address, or transfer canonical authority to AppStore.

## Readiness determination at this audit stage

- CODE COMPLETE: **YES for repository-side pre-testnet scope**; live deployment evidence remains outstanding.
- BUILD COMPLETE: **YES for APPSTORE-AUDIT-6 exact-head repository qualification**.
- CONTRACT COMPLETE: **YES / NOT APPLICABLE for AppStore-owned contracts**.
- TEST COMPLETE: **YES for repository-side AppStore qualification; NO for live testnet E2E**.
- DOCUMENTATION COMPLETE: **YES for the current repository gate; live deployment/operator evidence remains APPSTORE-AUDIT-7/8 work**.
- INTEGRATION COMPLETE: **YES for repository-side composition; NO for live-testnet integration**.
- SECURITY QUALIFIED: **YES for repository-local/adversarial scope; NO for live dependency/testnet behavior**.
- TESTNET READY: **NO**.
- GENESIS READY: **NO** as an operable AppStore service, despite the contract-free canonical definition being frozen.
- PRODUCTION READY: **NO**.

## Audit completion statement

**Repository audit status: COMPLETE. Remediation status: OPEN.**

The audit has established the canonical AppStore definition, inspected the implemented packages and production entrypoint, reconciled historical qualification claims against current repository behavior, repaired the bounded local security defects identified during inspection, and recorded a requirement matrix and remediation roadmap.

The final audit determination at APPSTORE-AUDIT-6 is that **420AppStore is repository-qualified for the pre-testnet stage but is not yet release-ready as a live Genesis application**. The contract-free authority model, production source/lifecycle/ApplicationView/public-service composition, discovery API, frontend, abuse controls and dependency behavior are implemented and exact-head qualified. Live deployment/testnet evidence remains intentionally unclaimed.

Historical APPSTORE-9/10 evidence remains provenance only and must not be used to override this current determination. Live-testnet and production claims remain blocked until the remediation roadmap is completed and requalified.

## Remediation roadmap

1. **APPSTORE-AUDIT-1 — durable audit baseline and local hardening.** Preserve this report, truthful readiness state, race-safe Registry projection, deep-link hardening, finite rating validation, and exact-head audit workflow.
2. **APPSTORE-AUDIT-2 — production canonical source.** **COMPLETE — Level 1.** Production uses the explicitly qualified 420Indexer-backed finalized ProtocolRegistry projection, with chain/Registry/finality/authority-claim and malformed/upstream-failure checks. Exact implementation SHA `03071f147041efe2d0bcd9df151a75c54f5c467c` passed AppStore Audit Qualification run `37252857689`, job `111583875589`.
3. **APPSTORE-AUDIT-3 — runtime catalogue lifecycle.** **COMPLETE — Level 1 + Level 2 lifecycle milestone.** Source sync, deterministic restore/rebuild/persistence, crash-safe atomic replacement, finalized-staleness/conflict protection, periodic refresh, and append-only non-canonical presentation history are wired and qualified at exact implementation SHA `6ea9a46ef889e8ebcc8888a100efaac9013f1e84`.
4. **APPSTORE-AUDIT-4 — ApplicationView composition.** **COMPLETE — Level 1 + Level 2 composition milestone.** Canonical latest-version records are composed with strict optional curation/security/Wallet/link inputs, retained atomically, and rebuilt after finalized catalogue refresh without allowing presentation sources to select or rewrite canonical Registry fields. Exact implementation SHA `0a2abad993d6ea508919a461b2a2ba7dfe761282` passed AppStore Audit Qualification run `37256398366`, job `111594309071`.
5. **APPSTORE-AUDIT-5 — public service composition.** **COMPLETE — Level 1 + Level 2 public-service milestone.** Health/readiness, dynamic `/v1/apps*`, embedded frontend, in-memory anonymous abuse limiting and dependency-aware blocked/degraded behavior are mounted under one production handler. Exact implementation SHA `65ac599806ce4cf910e7f8154f564498d7cb707b` passed AppStore Audit Qualification run `37257635038`, job `111598019149`.
6. **APPSTORE-AUDIT-6 — repository qualification.** **COMPLETE — Level 1 + Level 2 repository milestone.** Formatting, race tests, vet, production build, AppStore verifier and full 420Docs qualification passed on exact SHA `94d81b40d251fe425ae89cbacffa8cf766fcbb97`.
7. **APPSTORE-AUDIT-7 — live testnet qualification.** **TESTNET HANDOFF / BLOCKED ON LIVE PUBLIC TESTNET.** Canonical obligations are recorded in `docs/ROADMAP.md`; deploy backend/frontend, populate real URLs, exercise canonical Registry ingestion, restart/rebuild, Wallet handoff, outage/degraded cases, privacy boundaries and browser/API behavior against the live testnet.
8. **APPSTORE-AUDIT-8 — Genesis/production closeout.** **HANDED OFF AFTER APPSTORE-AUDIT-7.** Record exact deployment/configuration evidence, monitoring/recovery procedure, final security review and production-domain configuration, then perform the applicable Level-3 release closeout on the exact live-qualified candidate.

Do not mark 420AppStore COMPLETE until APPSTORE-AUDIT-1 through APPSTORE-AUDIT-8 are satisfied or a later repository-authoritative decision explicitly narrows the canonical scope.

## APPSTORE-AUDIT-2 durable qualification evidence

- **Roadmap step:** APPSTORE-AUDIT-2 — production canonical source.
- **Completion state:** COMPLETE.
- **Qualification level:** Level 1 — app-scoped fast qualification.
- **Implementation SHA:** `03071f147041efe2d0bcd9df151a75c54f5c467c`.
- **Qualification base/main observed:** `f6a426fc386b21f871b1805e00a57b1dad2bf902`; PR #514 remains intentionally unreconciled at this ordinary-step boundary because complete main reconciliation is reserved for Level 3 phase closeout.
- **Production source decision:** 420Indexer-backed finalized ProtocolRegistry projection. 420Indexer remains non-authoritative; ProtocolRegistry and chain state remain canonical.
- **Implementation:** added `appstore/registry/indexer_source.go`; required `APPSTORE_INDEXER_URL`; wired source construction, projection construction and initial fail-closed `registry.Sync` into `appstore/cmd/appstore420` after RPC chain/Registry qualification and before serving traffic.
- **Finality/reorg semantics:** source accepts only the configured chain and frozen ProtocolRegistry address, rejects Indexer authority claims, filters service versions to the Indexer finalized boundary, restores pre-finalization active state when a deprecation is not yet finalized, and validates the complete snapshot through `Projection.Rebuild` before publication to the caller.
- **Adversarial/failure coverage:** wrong chain, wrong Registry address, spoofed canonical-authority response, unfinalized version, unfinalized deprecation, malformed canonical record, upstream HTTP failure, projection conflict/version-gap/finality regression and concurrent replay/read coverage.
- **Required Level 1 CI:** `420AppStore Audit Qualification` run `37252857689`, exact-head job `111583875589` — PASS. Exact-head verification PASS; APPSTORE-AUDIT-2 formatting PASS; `go test -race ./appstore/...` PASS; `go vet ./appstore/...` PASS; `go build ./appstore/cmd/appstore420` PASS; `python3 scripts/verify-420appstore-audit.py` PASS.
- **Prior failed evidence:** run `37252437550` is superseded. It correctly exposed a stale runtime test fixture requiring the new Indexer URL; the new Registry source package itself passed under race. The fixture and step-scoped formatting were repaired before the successful exact-head run.
- **Level 2:** not required for this step. No shared Indexer/Registry implementation or interface was modified; AppStore only consumes the existing qualified read surface. Broader AppStore integration is retained for the later composition milestone.
- **Level 3 intentionally deferred:** latest-main reconciliation, canonical full Solidity inventory, Genesis/address-authority, 420 Integrated/global, Docs/global, full deployment/config and live-testnet qualification remain phase-closeout work and were not redundantly executed here.
- **Remaining blockers outside APPSTORE-AUDIT-2:** APPSTORE-3 catalogue lifecycle; ApplicationView composition; public API/frontend composition; abuse/dependency-state wiring; live public-testnet evidence.
- **Next canonical remediation step:** APPSTORE-AUDIT-3 — runtime catalogue lifecycle.

## APPSTORE-AUDIT-3 durable qualification evidence

- **Roadmap step:** APPSTORE-AUDIT-3 — runtime catalogue lifecycle.
- **Completion state:** COMPLETE.
- **Qualification level:** Level 1 plus Level 2 AppStore lifecycle milestone.
- **Implementation SHA:** `6ea9a46ef889e8ebcc8888a100efaac9013f1e84`.
- **Qualification base/main observed:** `f6a426fc386b21f871b1805e00a57b1dad2bf902`; PR #514 remains intentionally unreconciled because latest-main reconciliation is a Level 3 app-phase closeout responsibility.
- **Files changed for this step:** `appstore/catalog/store.go`, `appstore/catalog/lifecycle.go`, `appstore/catalog/lifecycle_test.go`, `appstore/catalog/presentation_history.go`, `appstore/catalog/presentation_history_test.go`, `appstore/cmd/appstore420/main.go`, `appstore/closeout/closeout_test.go`, APPSTORE-3 docs, readiness/audit evidence, app-specific verifier and workflow.
- **Runtime lifecycle:** production opens the configured catalogue store, validates/restores persisted state, refreshes from the APPSTORE-2 finalized Registry source before serving, durably persists the rebuilt document before swapping live state, and runs periodic finalized-source refresh thereafter.
- **Restart/recovery:** missing local storage rebuilds from the canonical source; corrupt/tampered storage fails closed; temporary crash remnants are never accepted as authority; writes use unique temp files, fsync, atomic rename and directory sync.
- **Stale/finality protections:** canonical source finality may not move behind persisted finality; finalized versions may not disappear or rewrite immutable implementation/hash/block provenance; finalized inactive versions may not reactivate; same-finality active-state rewrites fail closed; persistence failure leaves the prior in-memory state unchanged.
- **Presentation history:** APPSTORE-3's original presentation-history requirement is implemented as append-only per-service monotonic non-canonical revisions. Curation validation prevents canonical-field overrides and hardening validation prevents private/install/launch-history or unsafe metadata persistence.
- **Security/adversarial results:** missing/corrupt store, interrupted temp write, stale source, finalized-history rewrite, failed persistence/no-live-swap, canonical-override attempt, private launch-history attempt, history corruption, deterministic rebuild and restart restoration all PASS under the race-enabled AppStore suite.
- **Required CI:** `420AppStore Audit Qualification` run `37255518380`, job `111591611187` — PASS on exact implementation SHA. Exact-head verification PASS; APPSTORE-AUDIT-3 formatting PASS; prior APPSTORE-AUDIT-2 regression formatting PASS; `go test -race ./appstore/...` PASS; `go vet ./appstore/...` PASS; production entrypoint build PASS; audit verifier PASS.
- **Superseded failures:** run `37255246790` exposed only an APPSTORE-AUDIT-3 gofmt defect and was fixed before semantic testing; run `37255402153` then passed formatting and lifecycle/catalog tests but exposed a stale closeout fixture that still required five blockers after the lifecycle blocker was legitimately resolved. The fixture was replaced with explicit assertions for the four remaining blockers before the successful run.
- **Level 2 milestone:** required because this step introduces the production catalogue lifecycle boundary. No separate broader AppStore workflow exists; the retained app-specific workflow already executes the full race-enabled `./appstore/...` suite, vet, production build and verifier. The same exact-SHA run therefore supplies Level 2 coverage without duplicating equivalent work.
- **Level 3 intentionally deferred:** latest-main reconciliation, canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Docs/global reconciliation, deployment/config verification and live-testnet qualification remain app-phase closeout work.
- **Remaining blockers outside APPSTORE-AUDIT-3:** ApplicationView composition; discovery API/frontend composition; abuse/dependency-state public-runtime wiring; public testnet backend/frontend URLs and live dependency qualification.
- **Next canonical remediation step:** APPSTORE-AUDIT-4 — ApplicationView composition.


## APPSTORE-AUDIT-4 durable qualification evidence

- **Roadmap step:** APPSTORE-AUDIT-4 — ApplicationView composition.
- **Completion state:** COMPLETE.
- **Qualification level:** Level 1 plus Level 2 AppStore composition milestone.
- **Implementation SHA:** `0a2abad993d6ea508919a461b2a2ba7dfe761282`.
- **Qualification base/main observed:** `f6a426fc386b21f871b1805e00a57b1dad2bf902`; PR #514 remains intentionally unreconciled because latest-main reconciliation is reserved for Level 3 app-phase closeout.
- **Files changed for this step:** `appstore/api/composition.go`, `appstore/api/composition_test.go`, `appstore/cmd/appstore420/main.go`, `appstore/cmd/appstore420/main_test.go`, `appstore/runtime/config.go`, `appstore/closeout/closeout_test.go`, APPSTORE runtime/discovery documentation, readiness/audit evidence, and the app-specific verifier/workflow.
- **Canonical composition rule:** the APPSTORE-3 finalized catalogue is revalidated through `catalog.RestoreProjection`; one view is composed per service using the highest canonical Registry version present. Presentation inputs cannot select a different version or supply replacement implementation/provenance fields.
- **Curation boundary:** optional curation metadata is service-bound, normalized and hardened. Unknown services, duplicate services, service-ID mismatches, canonical-field override attempts, private launch/install fields and unsafe metadata fail closed.
- **Security boundary:** sourced evidence is validated by APPSTORE-5 and rebound to the canonical service/latest version. Unsafe endorsement/safety claims and malformed evidence fail closed.
- **Wallet boundary:** chain ID and service ID are constructed from canonical runtime/catalogue state rather than accepted from operator input. Strict JSON decoding rejects unknown authority-bearing fields; action requests still require explicit Wallet confirmation; unsafe/direct-link disagreement fails closed.
- **Atomic runtime state:** `ViewSet` swaps only after the full replacement composition validates and returns defensive snapshots; a rejected replacement preserves the last-good composed set. Production startup composes views after canonical catalogue bootstrap, and each successful finalized catalogue refresh is followed by a fail-closed view rebuild.
- **Adversarial/boundary coverage:** latest canonical version selection, canonical-only default views, unknown/duplicate service rejection, canonical override rejection, curation service mismatch, private presentation rejection, unsafe security claim rejection, hostile link rejection, Wallet confirmation boundary, Wallet/direct URL disagreement, strict unknown-field rejection, trailing-JSON rejection, deterministic ordering, tampered canonical document rejection, atomic failed-rebuild preservation and defensive snapshot isolation all pass under the race-enabled suite.
- **Required CI:** `420AppStore Audit Qualification` run `37256398366`, job `111594309071` — PASS on exact implementation SHA. Exact-head verification PASS; APPSTORE-AUDIT-4 formatting PASS; retained APPSTORE-AUDIT-3/2 formatting regressions PASS; branch formatting PASS; `go test -race ./appstore/...` PASS; `go vet ./appstore/...` PASS; production entrypoint build PASS; audit verifier PASS.
- **Superseded failures:** run `37256187273` identified the initial APPSTORE-AUDIT-4 gofmt defects before semantic testing; run `37256272006` narrowed the remaining deterministic formatting defect to `composition_test.go`. Both are superseded by the successful exact-head run.
- **Level 2 milestone:** required because this step is the convergence point for canonical APPSTORE-3 state plus APPSTORE-4 curation, APPSTORE-5 security evidence, APPSTORE-6 Wallet context and APPSTORE-7 view-model validation. The retained AppStore workflow already executes the complete app race suite, vet, production build and verifier on the exact SHA, so no duplicate equivalent workflow was run.
- **Level 3 intentionally deferred:** latest-main reconciliation, canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Docs/global reconciliation, deployment/config qualification and live-testnet qualification remain app-phase closeout work.
- **Remaining blockers outside APPSTORE-AUDIT-4:** production `/v1/apps*` API mounting, embedded frontend mounting, abuse/dependency-state public-runtime composition, public testnet backend/frontend URLs and live dependency qualification.
- **Next canonical remediation step:** APPSTORE-AUDIT-5 — public service composition.


## APPSTORE-AUDIT-5 durable qualification evidence

- **Roadmap step:** APPSTORE-AUDIT-5 — public service composition.
- **Completion state:** COMPLETE.
- **Qualification level:** Level 1 plus Level 2 AppStore public-service milestone.
- **Implementation SHA:** `65ac599806ce4cf910e7f8154f564498d7cb707b`.
- **Qualification base/main observed:** `e0c8d4b22bdfd0a75e90198404bcb00b5e04d5da`; PR #514 remains intentionally unreconciled because latest-main reconciliation is reserved for Level 3 app-phase closeout.
- **Files changed for this step:** `appstore/publicservice/service.go`, `dependencies.go`, `probe.go` and their tests; `appstore/runtime/service.go`, `config.go`, runtime tests; `appstore/cmd/appstore420/main.go`; closeout/readiness assertions; APPSTORE runtime/hardening docs; audit verifier and AppStore qualification workflow.
- **Public composition:** production now mounts one handler containing `/healthz`, dependency-aware `/readyz`, dynamic `/v1/apps*` and the embedded frontend. The discovery API is rebuilt from the current retained `ApplicationView` set per request.
- **Canonical failure behavior:** runtime readiness is included in dependency assessment. Registry/RPC loss forces `BLOCKED` mode and canonical API requests return 503 rather than serving stale canonical claims. The frontend and process health surface remain reachable.
- **Verify degraded behavior:** optional `APPSTORE_VERIFY_URL` probes 420Verify `/readyz`. Verify outage produces `DEGRADED` mode while browse/search remain available, but verification-class evidence and warnings are omitted until Verify is ready again; evidence is never fabricated.
- **Store/search behavior:** successful APPSTORE-3 bootstrap/refresh marks store availability; the in-process browse/search implementation is the active Search surface for this service. Catalogue refresh failure still terminates the production process rather than continuing indefinitely on stale state.
- **Abuse/privacy boundary:** a fixed-window limiter applies only to `/v1/apps*`, keyed by request transport address in memory. It requires no Wallet/account identity, persists no launch/install ledger, and returns 429 with retry guidance after the limit. Health/readiness/frontend are not subject to this discovery limiter.
- **Frontend/security:** the existing embedded APPSTORE-9 frontend is mounted at `/`; its CSP/permissions/read-only protections remain active. Public composition also adds `nosniff` and no-referrer headers at the outer handler.
- **Adversarial/failure coverage:** API/frontend/health mounting, canonical dependency block, frontend availability during block, degraded Verify readiness, removal of Verify evidence, transport-key rate limiting, unqualified-runtime block, public security headers, optional Verify probe success/failure, runtime readiness accessor and invalid Verify URL configuration all pass under the race-enabled AppStore suite.
- **Required CI:** `420AppStore Audit Qualification` run `37257635038`, job `111598019149` — PASS on exact implementation SHA. Exact-head verification PASS; APPSTORE-AUDIT-5 formatting PASS; retained APPSTORE-AUDIT-4/3/2 formatting regressions PASS; branch formatting PASS; `go test -race ./appstore/...` PASS; `go vet ./appstore/...` PASS; production entrypoint build PASS; audit verifier PASS.
- **Superseded failure:** run `37257475522` identified only deterministic gofmt issues in the new public-service files before semantic testing. The exact files were corrected before the successful run.
- **Level 2 milestone:** required because APPSTORE-AUDIT-5 is the convergence point for runtime readiness, APPSTORE-3 lifecycle, APPSTORE-4/5/6/7 view composition, APPSTORE-8 privacy/abuse/degraded policy and APPSTORE-9 frontend serving. The retained exact-head AppStore workflow already executes the full app race suite, vet, production build and verifier, so no duplicate equivalent suite was run.
- **Level 3 intentionally deferred:** latest-main reconciliation, canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Docs/global reconciliation, deployment/config verification and live-testnet qualification remain app-phase closeout work.
- **Remaining blockers outside APPSTORE-AUDIT-5:** APPSTORE-AUDIT-6 repository qualification; public testnet backend/frontend URLs and live dependency qualification; later Genesis/production closeout.
- **Next canonical remediation step:** APPSTORE-AUDIT-6 — repository qualification.


## APPSTORE-AUDIT-6 durable qualification evidence

- **Roadmap step:** APPSTORE-AUDIT-6 — repository qualification.
- **Completion state:** COMPLETE.
- **Qualification level:** Level 1 plus Level 2 pre-testnet repository milestone.
- **Implementation SHA:** `94d81b40d251fe425ae89cbacffa8cf766fcbb97`.
- **Qualification base/main observed:** `e0c8d4b22bdfd0a75e90198404bcb00b5e04d5da`. Latest-main reconciliation is intentionally deferred to Level 3 app-phase closeout.
- **AppStore repository gate:** `420AppStore Audit Qualification` run `37258566421`, job `111600724647` — PASS on the exact implementation SHA. Exact-head verification, retained step formatting gates, branch formatting, `go test -race ./appstore/...`, `go vet ./appstore/...`, production build and AppStore audit verifier all passed.
- **Documentation gate:** `420Docs Qualification` run `37258566434`, job `111600709511` — PASS on the same exact implementation SHA, including front matter/versioning, links, orphan navigation, required coverage, generated-reference integration/freshness, publication contracts, workflow self-tests and the retained documentation qualification stages.
- **Repository defects discovered and repaired during qualification:** the Docs gate first exposed four governed but unreachable AI/Arbitration pages; `mkdocs.yml` navigation was repaired without changing page semantics. It then exposed a generated Indexer reference gap after new AI routes had entered `420-indexer/src/api-contract.ts`; `scripts/reference_indexer_renderer.py` was extended with exact query/path parameter references for every AI route and the generated Indexer page was refreshed to deterministic output.
- **Superseded Docs failures:** run `37257793470` identified the orphan-navigation defect; run `37258418199` then advanced to and identified the missing `ai-providers` generated-reference parameter mapping; run `37258520061` confirmed the renderer mapping but rejected the committed generated page as byte-for-byte stale. All are superseded by the successful exact-SHA Docs run.
- **Requirement-specific exit criteria:** formatting PASS; race suite PASS; vet PASS; production build PASS; AppStore requirement verifier PASS; full documentation qualification PASS; exact-head identity PASS for both required workflows.
- **Milestone status:** APPSTORE-AUDIT-6 is the pre-testnet repository milestone. It qualifies accumulated repository-side AppStore implementation and documentation before live testnet work, without converting the step into Level 3.
- **Level 3 intentionally deferred:** branch reconciliation with latest `main`, canonical full Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, final Docs/global reconciliation on the reconciled merge candidate, deployment/config verification and final release-head qualification.
- **Remaining blocker:** APPSTORE-AUDIT-7 live public-testnet qualification requires real backend/frontend URLs and live Registry/RPC/Verify/Wallet/browser/restart/outage evidence. No live evidence has been fabricated.
- **Next canonical remediation step:** APPSTORE-AUDIT-7 — live testnet qualification.


## Testnet roadmap handoff

Repository-local APPSTORE-AUDIT remediation through APPSTORE-AUDIT-6 is complete. The unfinished APPSTORE-AUDIT-7 live public-testnet qualification and APPSTORE-AUDIT-8 Genesis/production closeout are now tracked under the canonical testnet handoff in `docs/ROADMAP.md`. This branch does not claim live backend/frontend URLs, live dependency health, live Wallet/Verify/Indexer behavior, or production readiness.
