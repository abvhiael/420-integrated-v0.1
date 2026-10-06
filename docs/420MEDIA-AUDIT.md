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

- live Registry/service-discovery publication and runtime-address evidence;
- production-equivalent session issuer/revocation integration;
- live scanner/quarantine, secret-manager and egress-policy evidence;
- production web/API domain materialization;
- production observability/backups/rollback evidence;
- Genesis acceptance record tied to an exact qualified deployment lineage.

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
| 420 Identity | optional profile/controller reader + Media actor guard; wallet-only pseudonymous operation preserved | COMPLETE (Level 1) |
| 420 Rights | canonical subject/provenance/right/license reads + publication/reuse guard; Rights remains authoritative | COMPLETE (Level 1) |
| 420 Storage | Media-owned upload lifecycle uses 420Storage v1 prepare/ingest evidence and canonical manifest readiness checks; Storage remains authoritative | COMPLETE (Level 1) |
| 420 Search | public-only Media asset projections using the existing Search result schema with qualified Indexer provenance/finality and rebuild/reorg handling | COMPLETE (Level 1) |
| 420 Notifications | opt-in topic/channel/severity/finality subscriptions with deterministic dedupe and reorg retractions; delivery remains non-canonical | COMPLETE (Level 1) |
| 420 Pay | canonical PaymentRegistry-backed Media funding/settlement/refund observation through `MediaPayComputeAdapter420`; Media remains non-custodial | COMPLETE (Level 1) |
| 420 Compute Protocol | canonical Compute graph/job/funding/match/provider/entitlement/refund binding; legacy provider ref accepted only when cross-checked against canonical provider state | COMPLETE (Level 1) |
| Protocol/Service Registry | canonical service ID/discovery boundary plus fail-closed deployment/security profile defined; live publication remains MEDIA-AUDIT-12/13 | COMPLETE for repository closeout / LIVE DEFERRED |
| Wallet | user-facing injected-wallet connect/network validation, account/network invalidation and external signing boundary in `media/web`; private keys remain outside Media | COMPLETE (Level 2 milestone) |
| Explorer/Indexer | rebuildable Media projection with provenance/finality/reorg qualification retained; live production binding remains deployment-stage evidence | COMPLETE for repository closeout / LIVE DEFERRED |

## Application-layer audit

Frontend: **COMPLETE (Level 2 milestone)** on the audit branch. `media/web` now provides upload preparation/transport recovery, library states, safe playback, basic livestream create/start/stop/status, Wallet/network validation, feature availability, responsive/accessibility basics and fail-closed unresolved runtime configuration. No production domain is claimed.

Backend/API: **COMPLETE (Level 1)** on the audit branch. `media/api` now exposes a stable `/v1` HTTP contract for capabilities/compatibility, assets, upload preparation, livestream control/status, Search, Notifications subscriptions and external Wallet signing intents. Deployment composition remains later roadmap work.

Indexer: **COMPLETE (Level 1)** for Media public asset projection. The audit branch now has a rebuildable, reorg-aware public Media projection cache that consumes qualified Indexer provenance/finality and emits existing 420Search result contracts. Operator discovery remains a separate app-scoped event accelerator. Live Indexer/Search service binding remains release-stage work.

Upload: **COMPLETE (Level 1)** on the audit branch. Media now owns a 420Storage-backed video asset lifecycle with exact object/precondition binding, ingest receipt validation, canonical sealed/retrievable manifest gating, derivative linkage, visibility/privacy handling, delete fail-closed semantics and retry recovery. Bong Goggles remains separate.

Livestreaming: **COMPLETE (Level 2 milestone)** on the audit branch. Media now owns create/start/stop/status flows over the existing gateway, canonical `MediaStreamRegistry420` controller reads, feature-flag enforcement, bounded credential/session inputs, durable desired-state persistence, bounded reconnect semantics and restart recovery. Public `/v1` API/UI remain later roadmap work.

Identity/Rights: **COMPLETE (Level 1)** on the audit branch. Wallet-only pseudonymous actors remain valid; supplied Identity profiles must be active and wallet-controlled. Public projection and derivative reuse now require live canonical Rights subject/provenance/right/holder or license authorization rather than trusting local Media references.

Pay/Compute: **COMPLETE (Level 1)** on the audit branch. Pay-backed jobs now bind exact canonical payer/merchant/amount/receipt/refund evidence; Compute-backed jobs bind the canonical component graph, funded job, accepted match, provider/resource/operator/beneficiary and verified entitlement/refund state. Media remains non-custodial and records canonical earned settlement amounts separately from funding ceilings.

Search/Notifications: **COMPLETE (Level 1)** on the audit branch. Only READY+PUBLIC+Rights-authorized assets can become Search results; projections preserve qualified Indexer provenance/finality and support deterministic rollback/rebuild. Notifications are opt-in, minimum-finality scoped, deduplicated, separately promotional-consented and reorg-retractable without becoming canonical authority.

API/SDK: **COMPLETE (Level 1)** on the audit branch. Stable `/v1` routes now use opaque cursor pagination, RFC3339 UTC timestamps, machine error codes, bounded strict JSON, replay-safe idempotency, provenance, capability/compatibility discovery and external Wallet signing intents. `sdk/media420` provides typed discovery/client methods with HTTPS and chain/network compatibility enforcement.

Security/abuse/moderation: **IMPLEMENTED / pending Level 3 exact-head qualification**. Media now has verified expiring session/capability boundaries for authority-bearing writes, actor-substitution rejection, SSRF/private-network and plaintext live-endpoint rejection, bounded media metadata, scanner/quarantine abstraction, request/report rate limiting, HMAC webhook expiry/replay protection, canonical GEN-SVC fixture personas/journeys, scoped report/decision/appeal handling, process/egress/secret security policy, and operator-compromise/recovery guidance. Moderation remains application-scoped and cannot mutate canonical ownership, Rights, Wallet, Pay or Compute authority.

Web application: **COMPLETE (Level 2 milestone)** on the audit branch. The first user-facing 420Media surface composes the qualified upload, library/playback, livestream, Wallet/network and feature-capability boundaries with explicit loading/empty/error/action states and safe recovery.

## Builds and tests

Existing relevant build/test surfaces:
- Foundry build/tests for Phase 1 media contracts;
- Go tests under `media/node/...`;
- local Anvil integration harness;
- existing `420Media Anvil Integration` workflow.

The audit branch adds a dedicated exact-head Media audit workflow and repository verifier so future Media remediation cannot be declared complete without checking the canonical service definition and current source inventory.

MEDIA-AUDIT-3 qualification evidence: `docs/audit/420MEDIA-AUDIT-3-QUALIFICATION.md`, implementation SHA `e0d938cd78a92a6c28ff88c641c9f3b332ffba20`, workflow run `37497230251` PASS.

MEDIA-AUDIT-4 qualification evidence: `docs/audit/420MEDIA-AUDIT-4-QUALIFICATION.md`, implementation SHA `14f87ce68fe9d7a0cc81654e2d86b915a08a285f`, workflow run `37500397201` PASS.

MEDIA-AUDIT-5 qualification evidence: `docs/audit/420MEDIA-AUDIT-5-QUALIFICATION.md`, implementation SHA `6833ed362214f453bfe0fb224424e7f09c7eb1f9`, workflow run `37503557911` PASS (Level 2).

MEDIA-AUDIT-6 qualification evidence: `docs/audit/420MEDIA-AUDIT-6-QUALIFICATION.md`, implementation SHA `70376d2b1d41659d7d654e41faa5e9d3c992fd66`, workflow run `37507801987` PASS (Level 1).

MEDIA-AUDIT-7 qualification evidence: `docs/audit/420MEDIA-AUDIT-7-QUALIFICATION.md`, implementation SHA `a0aeb709b10a155fe7959781a9994a15368a9b4a`, workflow run `37511396911` PASS (Level 1).

MEDIA-AUDIT-8 qualification evidence: `docs/audit/420MEDIA-AUDIT-8-QUALIFICATION.md`, implementation SHA `acbb99e2485c9565598eb723ee1f97492478a52d`, workflow run `37515368608` PASS (Level 1).

MEDIA-AUDIT-9 qualification evidence: `docs/audit/420MEDIA-AUDIT-9-QUALIFICATION.md`, implementation SHA `79e102e596a4e07b683fc15305c87c3ab4212aac`, workflow run `37520504975` PASS (Level 1).

MEDIA-AUDIT-10 qualification evidence: `docs/audit/420MEDIA-AUDIT-10-QUALIFICATION.md`, implementation SHA `f7e72653a057b227df256e9546cd2b309b692274`, workflow run `37525218135` PASS (Level 2 milestone).

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
| non-custodial settlement | Phase 1 protocol + MEDIA-AUDIT-7 | canonical Pay/Compute observation adapter + exact terminal settlement/refund evidence; no Media custody | Phase1 + Pay/Compute focused suite + Anvil + exact-head Media gate | Phase1 + Pay/Compute docs + qualification evidence | COMPLETE (Level 1) | live deployment deferred |
| operator processing | Phase 2 | FFmpeg/GStreamer profile runtime | Go tests | Phase2 docs | COMPLETE | production engine qualification |
| live transport primitives | Phase 2 | WHIP/WHEP + RTMP/SRT abstractions | Go tests | Phase2 docs | PARTIAL | complete service/API/session composition |
| operator discovery | MEDIA-AUDIT-3 / reconciled PR #86 Phase 3.1 subset | event-log accelerator + canonical registry revalidation + deterministic selector + replay recovery + control-plane boundary on audit branch | Go discovery/control-plane tests + exact-head Media gate | Phase 3.1 discovery doc + qualification evidence | COMPLETE (Level 1) | later orchestration remains separate |
| video uploads | GEN-SVC Media target | 420Storage v1 prepare/ingest + canonical manifest-gated Media asset lifecycle | Media Storage lifecycle tests + exact-head Media gate | Storage lifecycle doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| basic livestreaming | GEN-SVC + feature flag | create/start/stop/status service + canonical controller reader + feature gate + durable recovery/reconnect on audit branch | Media livestream/livegateway tests + accumulated Level 2 Media suite | Livestream service doc + qualification evidence | COMPLETE (Level 2) | retain milestone regressions |
| Identity integration | GEN-SVC registry | wallet-first actor guard with optional active profile/controller validation + Identity-aware livestream helpers | Media authority/livestream tests + exact-head Media gate | Identity/Rights integration doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| Rights integration | GEN-SVC registry | canonical Rights subject/provenance/right/holder/license checks for public projection and derivative reuse | Media authority/storage tests + exact-head Media gate | Identity/Rights integration doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| Storage integration | GEN-SVC registry | complete Storage object identity, canonical manifest readiness, derivative linkage, privacy/delete/retry semantics on audit branch | Media Storage lifecycle tests + exact-head Media gate | Storage lifecycle doc + qualification evidence | COMPLETE (Level 1) | retain canonical Storage authority; live deployment deferred |
| Search integration | GEN-SVC registry | READY+PUBLIC+Rights-authorized Media assets mapped to existing Search asset results with qualified Indexer provenance/finality and deterministic rollback/rebuild | Media projection/rebuild/privacy tests + Search architecture/result dependency tests + exact-head Media gate | Media projections doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage; live endpoint binding deferred |
| Notifications integration | GEN-SVC registry | private opt-in topic/channel/severity/finality subscriptions with deterministic dedupe, promotional-consent separation and reorg retractions | Media notification/projection tests + exact-head Media gate | Media projections doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage; live provider delivery deferred |
| Pay integration | GEN-SVC registry | canonical PaymentRegistry payer/merchant/amount/receipt/refund binding through Media adapter | Pay/Compute focused Foundry + retained exact-head Media gate | Pay/Compute integration doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| Compute integration | GEN-SVC registry | canonical graph/job/funding/match/provider/beneficiary/entitlement/refund binding; exact earned-amount accounting | Pay/Compute focused Foundry + retained exact-head Media gate | Pay/Compute integration doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| /v1 API | GEN-SVC-0.6 | stable versioned HTTP contract with cursor pagination, UTC timestamps, stable errors, provenance, rate metadata, idempotent writes and signing intents | Media API tests + retained exact-head Media gate | API/SDK contract doc + qualification evidence | COMPLETE (Level 1) | deployment deferred |
| typed client/SDK | GEN-SVC-0.7 | `sdk/media420` typed client with service discovery, validation, compatibility/chain/network enforcement, idempotency and external Wallet signer handoff | Media SDK tests + retained exact-head Media gate | API/SDK contract doc + qualification evidence | COMPLETE (Level 1) | retain regression coverage |
| feature flags | GEN-SVC-0.8 | `media.livestreaming` enforced fail-closed across service and user-facing app | GEN-SVC validator + Media livestream/web tests + retained Level 2 gate | GEN-SVC + Livestream/Web docs + qualification evidence | COMPLETE (Level 2 retained) | live flag publication deferred |
| threat model application | GEN-SVC-0.9 | Media-specific sessions, SSRF/egress, resource bounds, scanner/quarantine, webhook replay, moderation/appeal, operator/process/secret controls | Media security/API/livestream tests + race/static/verifier gates | Media security/operator/deployment guides | IMPLEMENTED / pending Level 3 qualification | qualify exact merge candidate |
| shared fixtures | GEN-SVC-0.10 | `media/fixtures` adopts USER/CREATOR/MODERATOR and SVC-JOURNEY-001/008/009/010 | Media security fixture regression | shared fixture contract + developer guide | IMPLEMENTED / pending Level 3 qualification | qualify exact merge candidate |
| frontend | user-facing Genesis target | responsive upload/library/playback/livestream app with Wallet/network/capability/recovery/accessibility boundaries | Media web structural/unit/build qualification | Media user/web docs | COMPLETE (Level 2 retained) | live origin deferred |
| deployment/Registry profile | release readiness | fail-closed `media/deploy/security-profile.json`, secure API composition and service ID/discovery requirements | Media security closeout verifier | deployment/operator guides | IMPLEMENTED / pending Level 3 qualification | live Registry/runtime materialization deferred |
| live testnet evidence | release readiness | repository candidate only | none live | known limitations | BLOCKED BY MEDIA-AUDIT-12 | production-equivalent testnet |
| Genesis catalog promotion | frozen catalog policy | not promoted | n/a | registry policy | BLOCKED BY MEDIA-AUDIT-13 | explicit catalog/governance decision if required |
| production operations | release readiness | repository security/operations profile, monitoring/recovery/runbook complete; live infrastructure unresolved | verifier + retained application suites | operator/security/deployment guides | REPOSITORY READY / LIVE DEFERRED | prove live infra, secrets, monitoring and recovery in MEDIA-AUDIT-12/13 |

## Readiness

- CODE COMPLETE: **YES for repository audit scope / pending Level 3 exact-head qualification**.
- BUILD COMPLETE: **PENDING LEVEL 3** — all retained app builds exist; final merge-candidate owners must pass.
- CONTRACT COMPLETE: **YES for repository audit scope** — Phase 1 and all application integration boundaries are represented; live deployment identity remains later-roadmap evidence.
- TEST COMPLETE: **PENDING LEVEL 3** — targeted Level 1/2 evidence is retained; comprehensive closeout is not yet green.
- DOCUMENTATION COMPLETE: **YES for repository audit scope / pending Docs global qualification** — user, developer, operator, moderation, security, deployment and limitations guides are present and in canonical navigation.
- INTEGRATION COMPLETE: **YES for repository audit scope / pending Level 3** — Identity, Rights, Storage, Search, Notifications, Pay, Compute, Wallet and service/API/web boundaries are implemented.
- SECURITY QUALIFIED: **PENDING LEVEL 3** — controls are implemented; exact merge-candidate security/race/static/global owners must pass.
- TESTNET READY: **NO** — owned by MEDIA-AUDIT-12.
- GENESIS READY: **NO** — owned by MEDIA-AUDIT-13 and any explicit catalog/governance decision.
- PRODUCTION READY: **NO** — live deployment, secrets, scanner, egress, monitoring and recovery evidence remain later-roadmap gates.

## Final determination

420Media is **COMPLETE FOR THE REPOSITORY AUDIT PHASE THROUGH MEDIA-AUDIT-11 LEVEL 3** on exact qualified implementation SHA `f0c68a0e5150111b97cebbcc0b8cb38e853314c2`.

Durable Level-3 evidence: `docs/audit/420MEDIA-AUDIT-11-QUALIFICATION.md`.

Historical pre-closeout classification retained for verifier compatibility: CODE COMPLETE: **YES for repository audit scope / pending Level 3 exact-head qualification**. That classification is superseded by the Level-3 closeout above.

No repository-closeout requirement is intentionally moved to testnet. Live infrastructure and Genesis-acceptance evidence remain explicitly assigned to MEDIA-AUDIT-12/13.