# 420Media — complete repository-grounded audit

Audit baseline: `main` @ `d86a3810d2901dc1082b65dc9061896c46e1911d`
Audit date: 2026-10-06
Status: repository audit baseline; remediation required

## Canonical definition

420Media is defined by the merged Phase 1 protocol, Phase 2 node documentation, Genesis consumer-service architecture, frozen Genesis application decision, and current repository implementation.

The canonical Genesis consumer-service record is `420/service/media/v1` with target `video_uploads_basic_livestreaming`, role `GENESIS_FACING_UPDATE`, authority `REPLACEABLE_APPLICATION`, and dependencies on 420 Identity, 420 Rights, 420 Storage, 420 Search, 420 Notifications, 420 Pay, and 420 Compute Protocol.

420Media is **not** currently a frozen application in `config/genesis-applications.json`. The consumer-service registry does not itself promote it into that catalog.

The on-chain Phase 1 protocol coordinates media operators, capabilities, stream identity, jobs, SLA evidence and non-custodial settlement. Raw media, stream secrets, HLS/WebRTC/RTMP/SRT transport, codec payloads, recordings, cache state and large content remain off-chain.

## Repository state

- repository: `abvhiael/420-integrated-v0.1`
- audited source branch: `main`
- audited main HEAD: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- audit branch: `audit/420media-complete-20261006`
- historical merged protocol PR: #56
- historical merged node PR: #60
- historical Phase 3 discovery PR: #86 — OPEN; its Phase 3.1 discovery/control-plane subset has been reconciled into the audit branch, while unrelated later orchestration/recovery changes remain non-authoritative

## Implemented architecture

### Smart contracts

| Component | Status | Notes |
|---|---|---|
| MediaCapabilityRegistry420 | COMPLETE | governed capability vocabulary, metadata/revisions, activation |
| MediaOperatorRegistry420 | COMPLETE | self-registration, operator lifecycle, capability advertisement, settlement account |
| MediaSLA420 | COMPLETE | governed SLA policies/reporters and one attestation per job |
| MediaStreamRegistry420 | COMPLETE | controller-owned stream metadata/treasury/provenance/lifecycle |
| MediaJobMarket420 | COMPLETE for Phase 1 | bounded job lifecycle, accepted operator authority, result commit/finalization |
| MediaSettlement420 | COMPLETE for Phase 1 | non-custodial settlement coordination through bound adapters |
| MediaIds420 | COMPLETE | canonical media capability/outcome identifiers |

These contracts are source-complete Phase 1 primitives. This audit does not infer deployed or Genesis-ready status from source presence.

### Operator/runtime layer

Present:
- `cmd/420media-node` operator configuration CLI;
- `media/node` worker lifecycle and lease model;
- Ethereum JSON-RPC adapter;
- remote signer boundary;
- file-backed cursor and lease persistence;
- FFmpeg/GStreamer processor profiles;
- WHIP/WHEP/WebRTC coordination abstraction;
- RTMP/SRT process-driver abstraction;
- SLA telemetry/evidence;
- Anvil contract/node integration harness.

The current CLI is operational tooling, not a user-facing 420Media application.

## Complete file/component inventory

### Present / COMPLETE or PARTIAL

- `contracts/src/media/*.sol` — COMPLETE for Phase 1 contract scope.
- `contracts/test/MediaPhase1Protocol420.t.sol` — COMPLETE for the original Phase 1 invariants represented by that test suite.
- `media/node/**` — PARTIAL for the current Genesis product target; substantial Phase 2 operator runtime exists.
- `cmd/420media-node/main.go` — PARTIAL operator CLI; no service daemon/start command is exposed.
- `scripts/420media-anvil-integration.sh` — COMPLETE local integration harness.
- `.github/workflows/420media-anvil.yml` — PARTIAL qualification workflow; only exercises the Anvil gate on matching changes.
- Phase 1/2 Media documentation — PARTIAL and partly stale because it predates GEN-SVC Media requirements.

### Missing for the canonical Genesis service target

- user-facing 420Media frontend;
- public `/v1` Media API;
- typed Media service SDK/client satisfying GEN-SVC-0.7;
- Identity/profile ownership integration;
- Rights/provenance/license integration;
- Search projection/index integration;
- Notifications integration;
- Pay integration beyond the older abstract vault/payout adapter boundary;
- canonical Compute Market integration;
- Registry/service-discovery publication/deployment profile;
- user authorization/session model;
- upload/livestream moderation and abuse handling;
- application observability/runbook and deployment manifests;
- production web/domain configuration;
- Genesis acceptance record tied to an exact release/deployment lineage.

### Reconciled historical work

PR #86 remains open and is not authoritative as a branch. MEDIA-AUDIT-3 selectively reconciles only its Phase 3.1 operator-discovery/control-plane foundation onto the current audit branch. Later stream orchestration, assigned-job contract changes, failover/recovery and geographic-resilience work from PR #86 are intentionally not imported by this step.

## Smart-contract security review

Verified/mitigated behavior from repository source:
- governance-only capability/SLA administration;
- accepted-operator binding before work execution;
- requester/operator/settlement caller isolation;
- capability deactivation fails closed for new operational checks;
- raw media and credentials remain outside contract state;
- settlement coordinator rejects direct native-value custody by design;
- successful settlement recipient is bound to the operator settlement account at funding;
- SLA failure resolves toward refund rather than release;
- stream mutation is controller-authorized;
- dependency binding is single-assignment in the Phase 1 contracts that use it.

Important design limitations / unresolved qualification:
- `stakeRef` and `computeProviderRef` are opaque references; Phase 1 does not validate canonical Stake/Compute state.
- Media SLA reporter trust remains governance-authorized oracle/reporter trust, not cryptographic proof of media quality.
- deployment graph, runtime hashes, Registry publication and ownership/admin handoff are not materialized as a Media release candidate.
- contract test coverage is narrow relative to the full current audit rubric: invariant/fuzz/property tests, hostile adapter behavior, dependency-code validation, and production deployment qualification remain incomplete.
- no live-chain reorg, multi-RPC disagreement, stale dependency or production operator compromise qualification is retained.

No critical source-level fund-custody vulnerability was identified in this audit pass, but the application is **not SECURITY QUALIFIED** because the full current service surface and live deployment do not yet exist.

## Genesis integration audit

| Dependency | Current state | Status |
|---|---|---|
| 420 Identity | no Media-owned integration found | MISSING |
| 420 Rights | no Media-owned integration found | MISSING |
| 420 Storage | Media-owned upload lifecycle uses 420Storage v1 prepare/ingest evidence and canonical manifest readiness checks; Storage remains authoritative | COMPLETE (Level 1) |
| 420 Search | no Media projection/search integration found | MISSING |
| 420 Notifications | no Media notification integration found | MISSING |
| 420 Pay | Phase 1 abstract settlement adapters only; no current canonical app/service binding | PARTIAL |
| 420 Compute Protocol | opaque compatibility reference only | PARTIAL |
| Protocol/Service Registry | no Media release publication/discovery profile found | MISSING |
| Wallet | no user-facing Media wallet workflow found | MISSING |
| Explorer/Indexer | events are indexable, but no Media-specific production projection qualification found | PARTIAL |

## Application-layer audit

Frontend: **MISSING** for 420Media itself.

Backend/API: **MISSING** as a stable public Media service. The Go code is an operator runtime/library and CLI, not a GEN-SVC `/v1` application API.

Indexer: **PARTIAL**. The audit branch now includes an app-scoped operator capability event projection used only as a discovery accelerator with mandatory canonical registry revalidation. There is still no general public Media projection/indexer service satisfying the full Genesis application contract.

Upload: **COMPLETE (Level 1)** on the audit branch. Media now owns a 420Storage-backed video asset lifecycle with exact object/precondition binding, ingest receipt validation, canonical sealed/retrievable manifest gating, derivative linkage, visibility/privacy handling, delete fail-closed semantics and retry recovery. Bong Goggles remains separate.

Livestreaming: **IMPLEMENTED / pending Level 2 exact-head qualification** on the audit branch. Media now owns create/start/stop/status flows over the existing gateway, canonical `MediaStreamRegistry420` controller reads, feature-flag enforcement, bounded credential/session inputs, durable desired-state persistence, bounded reconnect semantics and restart recovery. Public `/v1` API/UI remain later roadmap work.

## Builds and tests

Existing relevant build/test surfaces:
- Foundry build/tests for Phase 1 media contracts;
- Go tests under `media/node/...`;
- local Anvil integration harness;
- existing `420Media Anvil Integration` workflow.

The audit branch adds a dedicated exact-head Media audit workflow and repository verifier so future Media remediation cannot be declared complete without checking the canonical service definition and current source inventory.

MEDIA-AUDIT-3 qualification evidence: `docs/audit/420MEDIA-AUDIT-3-QUALIFICATION.md`, implementation SHA `e0d938cd78a92a6c28ff88c641c9f3b332ffba20`, workflow run `37497230251` PASS.

MEDIA-AUDIT-4 qualification evidence: `docs/audit/420MEDIA-AUDIT-4-QUALIFICATION.md`, implementation SHA `14f87ce68fe9d7a0cc81654e2d86b915a08a285f`, workflow run `37500397201` PASS.

## Documentation audit

Present:
- Phase 1 protocol document;
- Phase 2 node document;
- operator CLI/signer document;
- Anvil integration document.

Missing before this audit:
- current complete Media audit;
- stable audit remediation roadmap;
- explicit requirement/status matrix against GEN-SVC;
- application/user/operator/deployment documentation for the final service;
- exact-head audit qualification gate.

The first three gaps are remediated by this audit branch. Product documentation remains later-roadmap work because the product surfaces do not yet exist.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Phase 1 capability registry | Phase 1 protocol | contract present | Phase1 tests | Phase1 doc | COMPLETE | retain regression coverage |
| operator registry/lifecycle | Phase 1 protocol | contract present | Phase1 tests | Phase1 doc | COMPLETE | expand invariant/fuzz coverage |
| SLA policies/evidence | Phase 1 protocol | contract + node telemetry | unit coverage exists | Phase1/2 docs | COMPLETE | live reporter/security qualification |
| stream canonical identity | Phase 1 protocol | contract present | Phase1 tests | Phase1 doc | COMPLETE | bind final app ownership/rights model |
| media job lifecycle | Phase 1 protocol | contract + Go runner | Solidity/Go/Anvil | Phase1/2 docs | COMPLETE | expand adversarial/property tests |
| non-custodial settlement | Phase 1 protocol | abstract adapters | Phase1/Anvil | Phase1 doc | PARTIAL | bind canonical Pay/settlement deployment |
| operator processing | Phase 2 | FFmpeg/GStreamer profile runtime | Go tests | Phase2 docs | COMPLETE | production engine qualification |
| live transport primitives | Phase 2 | WHIP/WHEP + RTMP/SRT abstractions | Go tests | Phase2 docs | PARTIAL | complete service/API/session composition |
| operator discovery | MEDIA-AUDIT-3 / reconciled PR #86 Phase 3.1 subset | event-log accelerator + canonical registry revalidation + deterministic selector + replay recovery + control-plane boundary on audit branch | Go discovery/control-plane tests + exact-head Media gate | Phase 3.1 discovery doc + qualification evidence | COMPLETE (Level 1) | later orchestration remains separate |
| video uploads | GEN-SVC Media target | 420Storage v1 prepare/ingest + canonical manifest-gated Media asset lifecycle | Media Storage lifecycle tests + exact-head Media gate | Storage lifecycle doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| basic livestreaming | GEN-SVC + feature flag | create/start/stop/status service + canonical controller reader + feature gate + durable recovery/reconnect on audit branch | Media livestream/livegateway tests + accumulated Media suite | Livestream service doc | IMPLEMENTED / pending Level 2 qualification | qualify exact accumulated Media head |
| Identity integration | GEN-SVC registry | none | none | none | MISSING | implement scoped identity/profile boundary |
| Rights integration | GEN-SVC registry | provenance ref only, no Rights binding | none | none | MISSING | implement Rights/provenance validation |
| Storage integration | GEN-SVC registry | complete Storage object identity, canonical manifest readiness, derivative linkage, privacy/delete/retry semantics on audit branch | Media Storage lifecycle tests + exact-head Media gate | Storage lifecycle doc + qualification evidence | COMPLETE (Level 1) | retain canonical Storage authority; live deployment deferred |
| Search integration | GEN-SVC registry | none | none | none | MISSING | public-only Media projection |
| Notifications integration | GEN-SVC registry | none | none | none | MISSING | opt-in event delivery |
| Pay integration | GEN-SVC registry | abstract settlement adapters | Phase1 tests | Phase1 doc | PARTIAL | canonical Pay adapter and failure qualification |
| Compute integration | GEN-SVC registry | opaque provider ref only | limited | Phase1 doc | PARTIAL | canonical Compute Market coordination |
| /v1 API | GEN-SVC-0.6 | absent | none | none | MISSING | implement typed stable API |
| typed client/SDK | GEN-SVC-0.7 | absent | none | none | MISSING | implement Media SDK |
| feature flags | GEN-SVC-0.8 | `media.livestreaming` enforced fail-closed for create/start/recovery; stop/status remain available for safe shutdown/inspection | GEN-SVC validator + Media livestream tests | GEN-SVC + Livestream docs | IMPLEMENTED / pending Level 2 qualification | UI enforcement remains MEDIA-AUDIT-10 |
| threat model application | GEN-SVC-0.9 | shared model only | no Media-specific suite | shared docs | PARTIAL | Media abuse/privacy/rights threat tests |
| shared fixtures | GEN-SVC-0.10 | not used by Media | none | shared docs | MISSING | adopt canonical personas/journeys |
| frontend | user-facing Genesis target | absent | none | none | MISSING | implement |
| deployment/Registry profile | release readiness | absent | none | none | MISSING | materialize after service architecture closes |
| live testnet evidence | release readiness | absent | none | none | BLOCKED | production-equivalent testnet |
| Genesis catalog promotion | frozen catalog policy | not promoted | n/a | registry policy | BLOCKED | explicit catalog/governance decision if required |
| production operations | release readiness | absent | none | none | BLOCKED | live infra, secrets, monitoring, recovery, security closeout |

## Readiness

- CODE COMPLETE: **NO** — Genesis service/API/UI/upload/integration layers are missing.
- BUILD COMPLETE: **NO** — existing components can be built/tested, but required production components do not exist.
- CONTRACT COMPLETE: **YES for Phase 1 protocol scope / NO for application release qualification** — no new contract is inferred, but deployment/integration qualification is missing.
- TEST COMPLETE: **NO** — product and cross-app tests are missing.
- DOCUMENTATION COMPLETE: **NO** — product/user/operator/deployment docs remain dependent on missing implementation.
- INTEGRATION COMPLETE: **NO** — required GEN-SVC dependencies are mostly absent.
- SECURITY QUALIFIED: **NO** — only the existing protocol/runtime subset has repository-level controls.
- TESTNET READY: **NO** — no complete Media release candidate exists.
- GENESIS READY: **NO** — canonical Genesis target is not implemented end to end.
- PRODUCTION READY: **NO** — deployment, operations, security and live evidence are absent.

## Final determination

420Media is **not complete** on current `main`.

The Phase 1 protocol is a strong repository implementation and the Phase 2 node contains substantial, testable operator-runtime primitives. Those facts do not satisfy the newer Genesis consumer-service contract. The missing Media application/service layer and required integrations are release-blocking.

Proceed in stable dependency order using `docs/420MEDIA-ROADMAP.md`.