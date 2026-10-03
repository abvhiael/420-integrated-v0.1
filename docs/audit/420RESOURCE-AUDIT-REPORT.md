# 420ResourceProtocol repository-grounded audit report

Status: **IN PROGRESS — implementation remediation staged; exact-head qualification pending**

Audit branch: `audit/resource-protocol-remediation-20261002`  
Pull request: **#498 — Audit and remediate 420ResourceProtocol**  
Audit baseline `main`: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`

## 1. Scope and canonical definition

This audit treats current repository evidence as authoritative. The canonical Resource Protocol is the shared on-chain/off-chain infrastructure for four service classes:

- `420Relay`
- `420Store`
- `420Cache`
- `420Gateway`

`420Repair` is an off-chain Resource Network capability and is not a fifth canonical on-chain service class.

Primary authorities reviewed:

- `contracts/config/420resource-genesis.json`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/genesis-address-namespace.json`
- `docs/architecture/infrastructure/420store-roadmap.md`
- `docs/architecture/infrastructure/storage-resource-infrastructure.md`
- `docs/architecture/protocols/storage-proof-resource-protocol.md`
- `docs/developers/storage-and-resource-integration.md`
- `docs/developers/420storage-*.md`
- Resource/Storage contracts under `contracts/src/resource/`
- Resource/Storage Foundry suites under `contracts/test/`
- Resource Network runtime under `execution/storage/`
- Go client SDK under `sdk/storage420/`
- historical Resource foundation PR #24 and retained SR-0 through SR-10 roadmap/evidence

Canonical architecture boundary:

- payload traffic, stored bytes, cache bodies, repair traffic and gateway transport remain off-chain;
- chain state owns identities, service policy, capabilities, immutable offers/agreements/commitments, bounded metering, proof receipts and settlement control state;
- provider activation requires a nonzero stake reference;
- operational runtime credentials do not create protocol authority;
- Resource settlement is bounded; Storage settlement is Vault-backed;
- derived/indexed views are not canonical authority.

## 2. Repository state at audit start

| Field | Value |
|---|---|
| Repository | `abvhiael/420-integrated-v0.1` |
| Base branch | `main` |
| Baseline main SHA | `d37d751dfa232b20c8158d55c20c13cc1d7a10ef` |
| Audit branch | `audit/resource-protocol-remediation-20261002` |
| Pull request | #498 |
| Initial divergence | 0 behind / branch created directly from baseline main |
| Fixed Resource predeploy required | No |
| Resource router address model | `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS` |

The lack of a fixed Resource predeploy is intentional. It must not be treated as a missing address. Live deployment still requires verified implementation/codehash evidence and authorized Registry publication.

## 3. Contract inventory

### Shared Resource core

| Component | Baseline state | Audit state |
|---|---|---|
| `ResourceIds420.sol` | COMPLETE | COMPLETE |
| `ResourceAuthorization420.sol` | COMPLETE | COMPLETE |
| `ResourcePolicyRegistry420.sol` | COMPLETE | COMPLETE |
| `ResourceProviderRegistry420.sol` | PARTIAL | REMEDIATED — exact-head qualification pending |
| `ResourceNodeRegistry420.sol` | PARTIAL | REMEDIATED — exact-head qualification pending |
| `ResourceOfferRegistry420.sol` | PARTIAL | REMEDIATED — exact-head qualification pending |
| `ResourceSessionRegistry420.sol` | PARTIAL | REMEDIATED — exact-head qualification pending |
| `ResourceReceiptRegistry420.sol` | PARTIAL | REMEDIATED — exact-head qualification pending |
| `ResourceRouter420.sol` | COMPLETE | COMPLETE |

### Storage / 420Store protocol

| Component | Repository state |
|---|---|
| `StorageIds420.sol` | COMPLETE |
| `StorageProofIds420.sol` | COMPLETE |
| `IStorageProofVerifier420.sol` | COMPLETE |
| `StorageProofSchemeRegistry420.sol` | COMPLETE |
| `StorageCapacityRegistry420.sol` | COMPLETE |
| `StorageCommitmentRegistry420.sol` | COMPLETE |
| `StorageProofRegistry420.sol` | COMPLETE |
| `StorageAgreementRegistry420.sol` | COMPLETE |
| `StorageObjectManifestRegistry420.sol` | COMPLETE |
| `StorageSettlementRegistry420.sol` | COMPLETE |

The Storage family has explicit lifecycle events, canonical IDs, proof replay/deadline controls, capacity reservations, agreement lifecycle, manifests/placements and Vault-backed settlement window state. Targeted Foundry requalification is part of the audit workflow.

## 4. Application/runtime inventory

| Component | State | Notes |
|---|---|---|
| Dedicated end-user frontend | NOT APPLICABLE | Resource Protocol is infrastructure; no canonical dedicated web UI requirement was found. |
| Resource Network runtime | COMPLETE | `execution/storage/` contains config, trust, lifecycle, discovery, accounting, observability, Gateway, Repair, production operations/topology/load/fault-injection and developer HTTP/S3 surfaces. |
| Go SDK | COMPLETE | `sdk/storage420/` contains client/types and retained tests. |
| Developer HTTP/S3 surface | COMPLETE | Repository implementation present with tests. |
| Dedicated Resource on-chain Indexer reducer | PARTIAL | General Indexer/Explorer infrastructure exists, but no dedicated current Resource registry event projection was established by this audit. Newly added mutation events make deterministic indexing possible. |
| Deployment script for Resource contract graph | MISSING | No dedicated `contracts/script` or deployment program instantiating the Resource core was found. |
| Live ProtocolRegistry publication | BLOCKED | Requires live deployment, verified runtime codehash and authorized publication evidence. |
| Dedicated public Resource website | NOT APPLICABLE | No canonical requirement established. |

## 5. Baseline defects found and remediation

### RESOURCE-AUDIT-FIND-001 — service policy ceilings were stored but not enforced

Baseline behavior:

- `ResourcePolicyRegistry420.maxUnits` was not enforced by offer publication;
- `ResourcePolicyRegistry420.maxSessionSeconds` was not enforced by session opening;
- a provider could therefore publish/session within its own offer bounds while exceeding governance service ceilings.

Severity: **high protocol-consistency defect**.

Audit remediation:

- reject an offer whose `maxUnits` exceeds the active service policy;
- reject a session whose units exceed the service policy;
- reject a session whose expiry exceeds `maxSessionSeconds`;
- add adversarial regressions.

Status: **PARTIAL** until the exact remediated head passes the dedicated audit workflow.

### RESOURCE-AUDIT-FIND-002 — declared node-update authority had no implementation

`ACTION_UPDATE_NODE` existed, and Node records had endpoint/capacity hashes plus revision state, but no `updateNode` path existed.

Remediation:

- implement scoped node metadata updates;
- restrict mutation to non-ACTIVE/non-RETIRED state;
- permit node operator, provider operator or exact node-scoped capability;
- increment revision and emit `NodeUpdated`;
- add authorization and active-state negative tests.

Status: **PARTIAL** pending exact-head qualification.

### RESOURCE-AUDIT-FIND-003 — mutation/event provenance was incomplete

Baseline provider metadata updates, offer publication, Resource session transitions and receipt submission lacked complete event provenance.

Remediation:

- `ProviderUpdated`
- `NodeUpdated`
- `OfferPublished`
- `SessionOpened`
- `SessionClosed`
- `SessionCancelled`
- `SessionSettled`
- `ReceiptSubmitted`

Status: **PARTIAL** pending exact-head qualification.

### RESOURCE-AUDIT-FIND-004 — receipt action capability was declared but bypassed

`ACTION_SUBMIT_RECEIPT` existed but baseline receipt submission admitted only the exact node operator.

Remediation:

- preserve exact node-operator authority;
- additionally admit only an exact node-scoped `ACTION_SUBMIT_RECEIPT` capability;
- default-deny an ungranted delegate;
- add positive/negative delegated receipt tests.

Status: **PARTIAL** pending exact-head qualification.

### RESOURCE-AUDIT-FIND-005 — cumulative receipt progression admitted zero/equal usage

Canonical documentation describes cumulative metering that advances monotonically. Baseline accepted zero cumulative usage and multiple distinct receipts at the same cumulative unit count.

Remediation:

- reject zero cumulative units;
- require cumulative units to strictly advance;
- retain max-session-unit enforcement;
- add zero/equal-unit adversarial regressions.

Status: **PARTIAL** pending exact-head qualification.

### RESOURCE-AUDIT-FIND-006 — CANCELLED Resource session state was unreachable

Baseline enum exposed `CANCELLED` but no transition reached it.

Remediation:

- add consumer-only cancellation from OPEN;
- emit `SessionCancelled`;
- add unauthorized-caller and terminal-state test coverage.

Status: **PARTIAL** pending exact-head qualification.

### RESOURCE-AUDIT-FIND-007 — Resource genesis status metadata is stale/ambiguous

`contracts/config/420resource-genesis.json` still says `IMPLEMENTATION_QUALIFICATION`, while the canonical SR roadmap states SR-0 through SR-10 complete/merged. The repository uses similar historical status strings elsewhere, so this audit does **not** silently rewrite the schema value without a canonical status vocabulary/migration rule.

Status: **STALE**.

Required remediation: define/confirm the allowed genesis-config lifecycle vocabulary, then reconcile the Resource descriptor without misrepresenting live deployment readiness.

### RESOURCE-AUDIT-FIND-008 — deployment/publication evidence is absent

No dedicated Resource deployment script, deployed address set, target-network runtime codehash evidence or authorized ProtocolRegistry publication was established.

Status: **BLOCKED** for testnet/Genesis/production deployment claims.

This is distinct from source implementation completeness.

## 6. Security review

Verified/repository-backed properties:

- no `delegatecall`, `selfdestruct` or `tx.origin` appears in `contracts/src/resource/`;
- shared authorization delegates to `CapabilityRegistry420` with provider/node/session/proof-scheme scoping;
- provider activation requires nonzero stake reference;
- node ACTIVE state requires active parent provider;
- offers require active node/service policy and snapshot price/unit cap/terms/expiry;
- Resource sessions cap units and maximum native-$420 spend;
- receipt IDs are domain-separated by chain and contract instance and cumulative usage is bounded;
- settlement requires exact session-scoped `ACTION_SETTLE` authority and cannot exceed `maxSpend420`;
- Storage proof submission includes replay tracking, deadlines, active node/scheme checks and a reentrancy guard;
- Storage settlement is windowed and Vault-backed rather than granting providers ambient debit authority.

Risks/limitations that remain:

- generic Resource settlement records terminal control state but is not itself a Vault payment engine; callers must not present `SETTLED` as proof of external wallet payment;
- live CapabilityRegistry grants, timelock identity, Vault bindings and Registry publication remain deployment evidence;
- endpoint/metadata hashes are commitments, not proof that an off-chain endpoint is honest or reachable;
- off-chain volumetric DDoS and reverse-proxy/TLS misconfiguration remain operator risks documented in storage security/runbooks;
- no live-chain replay/reorg/restart evidence is established by repository unit tests alone.

Targeted Slither high-severity analysis is included in the dedicated Resource audit workflow.

## 7. Test inventory

Direct contract suites:

- `contracts/test/ResourceGenesis420.t.sol`
- `contracts/test/StorageCapacityRegistry420.t.sol`
- `contracts/test/StorageProofProtocol420.t.sol`
- `contracts/test/StorageAgreementRegistry420.t.sol`
- `contracts/test/StorageObjectManifestRegistry420.t.sol`
- `contracts/test/StorageSettlementRegistry420.t.sol`

Runtime/SDK tests include:

- Resource config/trust/accounting/network/lifecycle/discovery/observability;
- Gateway and developer HTTP/upload/discovery helpers;
- production topology/operations/fault injection/load;
- `sdk/storage420` client and fixture suites.

Audit workflow: `.github/workflows/resource-protocol-audit.yml`.

The generic `Solidity Contracts` workflow is not accepted as Resource evidence when its PR classifier skips Foundry execution.

## 8. Documentation audit

Strong documentation exists for:

- architecture and source-of-truth boundaries;
- product/service definitions;
- proof/capacity/agreement/manifest/settlement model;
- Resource Network configuration and trust;
- developer integration, HTTP/S3 API and SDK;
- production topology, security/abuse, fault injection, credential rotation;
- operator SLOs/alerts;
- testnet evidence model and production closeout;
- SR-0 through SR-10 roadmap/evidence.

Documentation gaps:

- no single Resource contract/API reference enumerates every current core event/action/state transition after this remediation;
- no dedicated Resource contract deployment/runbook was found;
- no live deployment/address/codehash/Registry publication record is present.

Overall documentation state: **PARTIAL**, not because documentation is sparse, but because deployment/reference material does not yet match the complete release lifecycle.

## 9. Integration audit

| Dependency | Status | Evidence/limit |
|---|---|---|
| CapabilityRegistry420 / Smart Accounts | COMPLETE | Core Resource authorization is capability-scoped. |
| Governance timelock | COMPLETE repository-level | Resource service policy is governance controlled; live timelock binding is deployment evidence. |
| 420Stake | PARTIAL | Provider ACTIVE requires a nonzero stake reference; generic Resource registry does not itself prove live collateral semantics. |
| 420Vault | COMPLETE for Storage design / BLOCKED live | StorageSettlementRegistry420 uses Vault obligation semantics; target deployment binding remains live evidence. |
| 420Registry / ProtocolRegistry | PARTIAL | Registry-resolved address model is canonical; live publication absent. |
| Wallet | NOT APPLICABLE to core authority | Wallet permissioning is a separate user-authorization surface. |
| Explorer/Indexer/Search/Analytics | PARTIAL | Derived infrastructure exists; dedicated Resource event projection/live reconstruction not established here. |
| 420Compute | COMPLETE boundary | Compute docs explicitly keep Resource sessions/receipts separate from canonical Compute jobs/receipts. |
| 420AI | COMPLETE boundary | AI is not Resource authority. |
| Bridge | NOT APPLICABLE | No bridge dependency required by core Resource flows. |
| Oracle | NOT APPLICABLE | No stale-oracle dependency found in core Resource contracts. |

## 10. Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Four canonical service classes | Genesis map / architecture | Present | Resource test | Present | COMPLETE | none |
| Capability-scoped provider/node/session/proof authority | genesis invariant 003 | Present; receipt delegation remediated | expanded Resource suite | Present | PARTIAL | exact-head qualify remediation |
| Provider stake gate | genesis invariant 001 | Present | tested | Present | COMPLETE | live stake semantics are deployment evidence |
| Node parent/service binding | genesis invariant 002 | Present | retained + expanded | Present | COMPLETE | live deployment evidence |
| Node metadata revision path | declared action + node revision model | added by audit | added | audit report | PARTIAL | exact-head qualify |
| Governance service policy | architecture / policy registry | Present | retained | Present | COMPLETE | none |
| Enforce service unit ceiling | policy registry | added by audit | added | audit report | PARTIAL | exact-head qualify |
| Enforce service session duration | bounded-session architecture | added by audit | added | audit report | PARTIAL | exact-head qualify |
| Immutable bounded offer snapshot | genesis invariant 004 | Present | retained | Present | COMPLETE | none |
| Replay-safe bounded session | genesis invariant 005 | Present; cancellation added | expanded | Present | PARTIAL | exact-head qualify |
| Monotonic bounded receipt | invariants 006/007 | strict advancement added | expanded | Present | PARTIAL | exact-head qualify |
| Capability-scoped settlement <= maxSpend | invariant 008 | Present | tested | Present | COMPLETE | do not present state as external payment proof |
| Off-chain payload boundary | invariant 009 / architecture | Present | runtime tests | Extensive | COMPLETE | live ops evidence |
| No cross-service confusion | invariant 010 | Present | tested | Present | COMPLETE | none |
| Store commitment / active Store node | invariant 011 | Present | Storage suites | Present | COMPLETE | exact-head rerun |
| Replay/deadline/versioned proof verifier | invariant 012 | Present | Storage proof suite | Present | COMPLETE | exact-head rerun |
| Canonical capacity/agreement/manifest/placement/settlement | invariant 013 | Present | targeted suites | Present | COMPLETE | exact-head rerun |
| Vault-backed proof-window settlement | invariant 014 | Present | settlement suite | Present | COMPLETE | live Vault deployment binding |
| Runtime/SDK | SR-4 through SR-10 | Present | Go tests | Extensive | COMPLETE | exact-head rerun |
| Dedicated Resource frontend | architecture | none required | n/a | n/a | NOT APPLICABLE | none |
| Dedicated Resource deployment tooling | deployment-readiness requirement | not found | none | missing | MISSING | implement deterministic deploy/materialize/verify flow |
| Live Registry publication/codehash | Registry/address architecture | absent | none | no live record | BLOCKED | testnet deploy + verify + authorized publish |
| Live restart/reorg/multi-provider evidence | testnet/production docs | repository harness only | simulation exists | evidence model exists | BLOCKED | production-equivalent testnet |
| Genesis config lifecycle status | Resource genesis descriptor / SR roadmap | contradictory/stale label | n/a | conflicting | STALE | reconcile vocabulary/status |
| Exact final-head qualification | audit rule | pending | dedicated workflow running/queued | this report | BLOCKED | all required jobs must pass on final substantive SHA |

## 11. Readiness determination

At this in-progress evidence point:

- CODE COMPLETE: **NO** — remediation has not yet passed exact-head qualification.
- BUILD COMPLETE: **NO** — exact remediated build evidence pending.
- CONTRACT COMPLETE: **NO** — exact-head contract/security gate pending.
- TEST COMPLETE: **NO** — dedicated audit workflow pending.
- DOCUMENTATION COMPLETE: **NO** — deployment/reference closeout remains.
- INTEGRATION COMPLETE: **NO** — live Registry/Vault/stake/indexed deployment evidence remains.
- SECURITY QUALIFIED: **NO** — targeted Slither/hardening exact-head gate pending.
- TESTNET READY: **NO** — no verified deployed Resource graph/Registry publication record.
- GENESIS READY: **NO** — live deployment/codehash/publication/acceptance evidence missing.
- PRODUCTION READY: **NO** — Genesis/testnet blockers plus live operational qualification remain.

These values must be refreshed only from the exact final audit head and durable CI/deployment evidence.

## 12. Final determination at audit stage

The baseline repository does **not** justify calling 420ResourceProtocol fully complete or production-ready solely from the historical SR-0–SR-10 COMPLETE roadmap labels.

The repository contains a substantial and mature Resource/Storage implementation, runtime, SDK and operations/documentation stack. The audit nevertheless found enforceable core-policy gaps, incomplete mutation provenance, unreachable lifecycle state and unused declared authority that required source remediation. Even after those code repairs qualify, live deployment, runtime codehash verification, ProtocolRegistry publication and production-equivalent network evidence remain distinct blockers to testnet/Genesis/production readiness.
