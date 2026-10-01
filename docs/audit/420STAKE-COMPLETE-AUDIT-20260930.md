# 420Stake complete repository audit — 2026-09-30

## Scope and authority

This audit evaluates **420 Stake / `Stake420`** against repository evidence, not conversational plans. The audited baseline is `main` at `cbff831984df5d57540a26c879663cf95bcf61c9`. Remediation is isolated on `feature/420stake-audit-remediation`.

The prompt contains stray references to 420Registry, 420Identity and 420Names. Those are treated only as dependency/integration subjects; the audited application is 420Stake.

Historical PR #2 is useful provenance but is not current qualification evidence. It merged on 2026-08-27 and recorded green checks for its historical head `e0ab60366acd21684171f7f0c3ac3b8f0b089571`. Current qualification must attach to the final remediation head.

## Canonical definition

420 Stake is a Genesis protocol-and-user application. Its purpose is validator registration, the 42,000 native-420 effective bond, optional matched protocol credit, readiness/lifecycle presentation, reward accounting and withdrawals. Genesis explicitly excludes public delegation and stake-weighted governance.

Canonical authority is split:

- `ValidatorRegistry` — validator records, native-420 bond custody and lifecycle materialization;
- `CommunityValidatorReserve` — matched protocol credit custody/accounting;
- `fourtwentyd` — committee selection, proposer scheduling, finality, reward arithmetic and slash adjudication;
- `ConsensusSystemCall420` — privileged consensus-to-execution gateway;
- `RewardController` — execution-side reward accounting receiver;
- `Stake420` — read-oriented facade, not a second staking economy;
- Wallet/Indexer/Explorer/Search/Analytics — replaceable presentation/projection layers only.

Frozen/testnet economics and lifecycle include: 42,000 effective bond; minimum 21,000 owned; up to 21,000 protocol credit; 420-block epoch; 42-epoch / 17,640-block rotation; three-rotation active term; one-rotation activation delay; one-rotation voluntary-exit notice; three-rotation cooldown; six-rotation / 105,840-block withdrawal hold; minimum 60 eligible validators; active targets 15/18/21/24/27/30; one-third turnover; three-snapshot hysteresis.

## Canonical sources reviewed

- `config/genesis-applications.json`
- `config/protocol.json`
- `docs/ROADMAP.md`
- `docs/PROTOCOL-v0.1.md`
- `docs/VALIDATOR-LIFECYCLE-SLASHING-v1.md`
- `docs/DYNAMIC-VALIDATOR-REWARD-RAMP-v0.4.md`
- `docs/CONSENSUS-SYSTEM-CALL-v1.md`
- `docs/architecture/consensus/**`
- `docs/architecture/protocols/stake-governance-treasury-grants.md`
- `docs/architecture/GENESIS-CONTRACT-INTERFACE-LAYER.md`
- `docs/apps/stake/**`
- `contracts/config/genesis-dapp-contract-map.json`
- `contracts/config/genesis-canonical-addresses.json`
- `contracts/config/system-addresses.json`
- `contracts/config/deployment-manifest.json`
- `contracts/config/predeploy/predeploy-plan.json`
- `contracts/config/predeploy/storage-init.json`
- `contracts/config/predeploy/readiness.json`
- `contracts/config/security/genesis-suite-registry.json`
- `contracts/config/interfaces/genesis-interface-layer.json`
- `contracts/config/interfaces/dependency-matrix.json`
- `contracts/config/interfaces/system-safety-semantics.json`
- `contracts/config/consensus-system-call.json`
- `contracts/src/apps/Stake420.sol`
- `contracts/src/system/ValidatorRegistry.sol`
- `contracts/src/system/CommunityValidatorReserve.sol`
- `contracts/src/system/RewardController.sol`
- `contracts/src/system/ConsensusSystemAccess420.sol`
- `contracts/src/system/ConsensusSystemCall420.sol`
- `contracts/src/IValidatorRegistry.sol`
- `contracts/src/IRewardController.sol`
- `contracts/test/StakeValidatorGenesis420.t.sol`
- `contracts/test/ValidatorEligibility420.t.sol`
- `contracts/test/ConsensusSystemCall420.t.sol`
- `consensus/systemcall/**`
- `consensus/engine/systemcalls.go`
- `consensus/types/systemcalls.go`
- `execution/systemcall/**`
- `420-indexer/src/abi-manifest.ts`
- `420-indexer/src/lifecycle-reducer.ts`
- `420-indexer/src/protocol-decoder.ts`
- `search/discovery/assets_validators.go`
- `analytics/metrics/validator.go`
- `wallet/web/core/genesis-app-catalog.js`
- `contracts/config/420wallet-genesis.json`
- PR #2 and current GitHub Actions evidence.

## Repository state at audit start

- repository: `abvhiael/420-integrated-v0.1`
- audited branch: `main`
- audited `main` HEAD: `cbff831984df5d57540a26c879663cf95bcf61c9`
- remediation branch: `feature/420stake-audit-remediation`
- historical Stake PR: #2, merged
- current Stake-specific open PR at audit start: none identified
- current-main Docs qualification at audit start: failing for unrelated 420Names front matter; not a Stake defect but prevents a global-current-head Docs PASS claim.

## File inventory and classification

### Core contracts

| Component | Path | Status | Audit note |
|---|---|---|---|
| Stake facade | `contracts/src/apps/Stake420.sol` | COMPLETE | Real read-only facade over canonical registry/reward state. |
| Validator registry/bond vault | `contracts/src/system/ValidatorRegistry.sol` | PARTIAL | Core lifecycle/custody exists; audit found missing duplicate slash-evidence rejection and missing resulting status in slash event, remediated on branch. Frozen shared interface-layer requirements remain unresolved. |
| Community validator reserve | `contracts/src/system/CommunityValidatorReserve.sol` | COMPLETE | Real value-backed matched-credit accounting and reserve invariant. |
| Reward receiver | `contracts/src/system/RewardController.sol` | PARTIAL | Core accounting exists; audit found missing semantic replay/block/participant-set guards, remediated on branch. Production consensus derivation remains missing. |
| Consensus access binding | `contracts/src/system/ConsensusSystemAccess420.sol` | COMPLETE | One-time canonical `0x043c` binding. |
| Consensus gateway | `contracts/src/system/ConsensusSystemCall420.sol` | COMPLETE | Context/domain/target/selector/sequence validation exists. |
| Validator ABI interface | `contracts/src/IValidatorRegistry.sol` | STALE at baseline / COMPLETE after remediation | Baseline enum/struct/function signatures contradicted live contract. |
| Reward ABI interface | `contracts/src/IRewardController.sol` | STALE at baseline / COMPLETE after remediation | Baseline named getters that do not exist and omitted canonical current reads. |

### Consensus/execution integration

| Component | Status | Audit note |
|---|---|---|
| canonical system-call batch representation/root | COMPLETE | `consensus/systemcall/batch.go` |
| consensus block commitment/body carrier | COMPLETE | `consensus/types/systemcalls.go` |
| P2P preservation tests | COMPLETE | tests preserve/validate committed batch |
| Engine staging transport | COMPLETE | `consensus/engine/systemcalls.go` |
| execution envelope validation | COMPLETE | block/parent/chain/action/target/sequence checks |
| patched EVM gateway route | COMPLETE | canonical `0x043c` path exists |
| production derivation of validator/reward/slash/rotation calls | MISSING | repository search found `csys.Call` construction only in tests; docs say fourtwentyd “derives and commits” the batch, but production builder/adjudication-to-call code was not found |
| production reward arithmetic feeding RewardController | MISSING | no executable fourtwentyd reward computation feeding `applyConsensusReward` found |
| production slash evidence adjudication feeding ValidatorRegistry | PARTIAL/MISSING | local slashing protection exists, but no production finalized-evidence → `applySlash` system-call builder path was found |

### Projection/application components

| Component | Status | Audit note |
|---|---|---|
| 420Indexer protocol classification | COMPLETE | Stake420 and ValidatorRegistry map to `420Stake`. |
| 420Indexer ABI artifact path | BLOCKED | required generated predeploy artifacts are absent. |
| Indexer lifecycle reducer | BROKEN at baseline / remediated | used nonexistent synthetic events `StakeCreated`, `StakeActivated`, `UnstakeRequested`, `StakeWithdrawn`, `StakeSlashed`; now aligned to canonical ValidatorRegistry events/status fields. |
| Search validator discovery | PARTIAL | real derived consumer exists; depends on qualified Stake Indexer projection. |
| Analytics validator metrics | PARTIAL | real derived metrics exist; depends on qualified Indexer projection. |
| Explorer staking/reward workflow | MISSING | existing Explorer audit explicitly records staking/reward workflow as not observed. |
| Wallet app catalogue entry | COMPLETE | canonical `420/service/stake/v1` entry exists and remains manifest-gated. |
| Dedicated Wallet Stake management/read UI | MISSING | no implemented Stake workflow/page/client found. Catalogue navigation is not the application. |
| Standalone Stake frontend | MISSING | no dedicated frontend source/build/deployment package found. |
| Dedicated Stake backend | NOT APPLICABLE unless future architecture requires one | canonical state can be served by contracts + shared Indexer; no authoritative backend should be invented. |
| Stake-specific API/SDK client | PARTIAL | generic ABI/interfaces and Indexer exist; no dedicated qualified client package found. |

### Deployment and Genesis

| Component | Status | Audit note |
|---|---|---|
| frozen addresses | COMPLETE | RewardController 0x0420; ValidatorRegistry 0x0423; CommunityValidatorReserve 0x0425; Stake420 0x043a; ConsensusSystemCall420 0x043c. |
| predeploy plan | PARTIAL | entries are `SOURCE_READY`, not artifact-ready. |
| compiled/pinned Stake artifacts | MISSING | no `contracts/artifacts/{RewardController,ValidatorRegistry,CommunityValidatorReserve,Stake420}.json` in audited tree. |
| runtime code hashes | MISSING | Stake suite entries lack pinned runtime hashes in deployment manifest. |
| materialized Genesis storage | MISSING | readiness says `generated-storage.json required`. |
| exact predeploy state records | MISSING | Stake suite lacks Registry/Names-style retained predeploy-state evidence. |
| Genesis-wide readiness | BLOCKED | `genesis_predeploy_ready=false`; compiled artifacts/storage blocked. |
| security suite status | BLOCKED | `Validator_Stake=PENDING_HARDENING`; `Rewards_Treasuries=PENDING_HARDENING`. |
| external audit gate | BLOCKED | security policy requires external audit for mainnet security-relevant Genesis suites. |
| live ProtocolRegistry publication | BLOCKED | no deployed/codehash-verified live Stake service publication evidence. |
| testnet deployment evidence | MISSING | no production-equivalent live Stake deployment/transaction/codehash/smoke evidence found. |

## Contract/security findings

### Remediated in this audit

1. **Slash evidence replay:** canonical slashing documentation requires execution-side evidence recording/replay rejection. Baseline `ValidatorRegistry.applySlash` checked only nonzero evidence and emitted it. Remediation adds global `slashEvidenceApplied` storage and rejects a second use before collateral mutation.
2. **Reward semantic replay:** reward documentation requires finalized block rewards to be applied once. Baseline `RewardController` relied only on gateway sequence ordering. Remediation binds reward accounting to the current execution block and rejects a second reward for the same block.
3. **Malformed reward participant sets:** baseline accepted zero, duplicate and proposer-as-participant entries and had no contract-side maximum committee bound. Remediation enforces proposer nonzero, maximum 30 total active validators and distinct nonzero non-proposer participants.
4. **Slash lifecycle event completeness:** baseline `SlashApplied` omitted `resultingStatus` even though slash changes validator status. Remediation includes it so derived consumers can reconstruct state.
5. **Stale public ABI interfaces:** baseline public interfaces contradicted canonical contracts. Remediation reconciles them.
6. **Broken Stake indexer lifecycle policy:** baseline reducer watched event names no current contract emits. Remediation watches canonical events and maps `newStatus` / `resultingStatus`.

### Verified/mitigated behaviors in source

- collateral is real native 420 custody, not accounting-only stake;
- matched credit is physically moved from CommunityValidatorReserve;
- reserve encumbrance cannot be treasury-spent;
- withdrawal sends owned collateral only to the registered withdrawal address and recycles protocol credit;
- effects precede value transfers in slash/withdraw/credit replacement paths; downstream failures revert atomically;
- consensus-owned lifecycle/slash/reward methods are restricted to the immutable one-time canonical system caller;
- governance cannot rebind the consensus caller after binding;
- gateway validates native system origin, chain, block, parent, strict sequence, action, target and selector;
- public delegation and stake-weighted governance are disabled.

### Unresolved security/integration risks

- production fourtwentyd system-call derivation is absent/not located, so documented reward/slash/lifecycle materialization is not end-to-end executable;
- frozen Genesis interface-layer dependencies for Stake are declared but not implemented/reconciled in runtime contracts;
- `SystemSafety` declares new activation NORMAL_ONLY and mature withdrawal WITHDRAWAL_ONLY, but Stake runtime contracts do not consume the shared system-safety layer;
- Genesis initialization/migration introspection required by the frozen interface layer is absent from the Stake suite;
- predeploy runtime/storage evidence is missing;
- the security suite remains explicitly `PENDING_HARDENING`;
- no external security audit evidence qualifies the current implementation.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Genesis protocol/user app | `genesis-applications.json` | contracts + docs exist | partial | yes | PARTIAL | implement actual user-facing app surface |
| no public delegation | Genesis decision; Stake docs | facade returns false | contract test | yes | COMPLETE | retain |
| no stake-weighted governance | Genesis decision | facade returns false | contract test | yes | COMPLETE | retain |
| 42,000 effective bond | lifecycle spec | registry constant/custody | tests | yes | COMPLETE | retain |
| 21k owned / up to 21k credit | lifecycle spec | enforced | tests | yes | COMPLETE | retain |
| physical protocol credit custody | lifecycle spec | reserve→registry value transfer | tests | yes | COMPLETE | retain |
| activation delay | lifecycle spec | enforced | tests | yes | COMPLETE | retain |
| exit notice | lifecycle spec | consensus-applied | tests | yes | COMPLETE | connect production consensus derivation |
| cooldown | lifecycle spec | enforced | tests | yes | COMPLETE | connect production consensus derivation |
| withdrawal hold | lifecycle spec | enforced | tests | yes | COMPLETE | retain |
| committee tiers/hysteresis | lifecycle/reward specs | registry calculation/snapshot | tests | yes | PARTIAL | production fourtwentyd lifecycle integration |
| slash ceilings/proportionality | slashing spec | enforced | tests | yes | COMPLETE | expand fuzz/property coverage |
| slash evidence nonzero | slashing spec | enforced | tests | yes | COMPLETE | retain |
| slash evidence replay rejection | slashing spec | remediated | added | updated | COMPLETE on branch | qualify exact head |
| reward only via consensus caller | reward spec | enforced | indirect | yes | COMPLETE | retain |
| one reward per finalized block | reward spec | remediated | added | updated | COMPLETE on branch | qualify exact head |
| distinct/bounded reward participants | reward spec/committee max | remediated | added | updated | COMPLETE on branch | qualify exact head |
| reward arithmetic in fourtwentyd | reward spec | no production implementation found | no direct suite found | specified | MISSING | implement deterministic integer reward engine |
| system-call batch commitment | syscall spec | implemented | Go tests | yes | COMPLETE | retain |
| system-call production derivation | syscall spec | no production builder found | only fixture calls found | specified | MISSING | implement deterministic builder from finalized outcomes |
| native system origin | syscall spec | enforced | tests | yes | COMPLETE | retain |
| frozen target/selector routing | syscall spec | enforced | tests | yes | COMPLETE | retain |
| canonical fixed addresses | address maps | consistent | validators/scripts | yes | COMPLETE | retain |
| predeploy runtime artifacts | predeploy plan | absent for Stake suite | readiness detects missing | plan | MISSING | compile/pin artifacts and hashes |
| predeploy storage materialization | storage-init/readiness | conceptual init only | readiness detects missing | plan | MISSING | generate retained exact storage/state |
| shared Genesis interface layer | frozen interface layer | dependency matrix only; runtime adoption absent | config verifier only | yes | PARTIAL | reconcile and implement required runtime dependencies or formally narrow matrix |
| SystemSafety semantics | safety matrix | not consumed by Stake contracts | none | defined | MISSING | enforce NORMAL_ONLY activation / safe mature withdrawal semantics |
| Genesis initialization introspection | frozen interface layer | absent | none | defined | MISSING | implement/materialize or formally reconcile |
| migration semantics | frozen interface layer | absent | none | defined | MISSING | define version/migration behavior |
| ProtocolRegistry discovery | dependency matrix/service IDs | service ID exists; no live publication evidence | catalogue tests | partial | PARTIAL | publish verified deployment after testnet |
| current ABI interfaces | contract integration | remediated | compile gate | docs | COMPLETE on branch | qualify |
| indexer ABI generation | predeploy/indexer | generator path exists; artifacts absent | fail-closed tests | partial | BLOCKED | generate pinned Stake artifacts/descriptors |
| indexer lifecycle state | indexer | remediated | added | updated | COMPLETE on branch | qualify |
| Search projection | Search/Stake docs | consumer exists | Search tests | yes | PARTIAL | live qualified Indexer evidence |
| Analytics projection | Analytics docs | consumer exists | analytics tests | yes | PARTIAL | live qualified Indexer evidence |
| Explorer staking/reward view | Explorer audit | not observed | no acceptance evidence | gap documented | MISSING | implement and qualify view/workflow |
| Wallet verified navigation | Wallet config | catalog entry exists | Wallet test | yes | COMPLETE | bind live manifest later |
| Stake user UI | Genesis user-app class | no concrete workflow/page found | none | user guide only | MISSING | implement Wallet-integrated or standalone UI from canonical architecture |
| build reproducibility | roadmap/release policy | source builds historically; final branch pending CI; required artifacts absent | CI | partial | PARTIAL | exact-head CI + retained artifacts |
| hardening suite | security registry | PENDING_HARDENING | generic Slither/invariants exist | policy | BLOCKED | Stake-specific hardening closeout |
| external audit | audit policy | none current | n/a | policy | BLOCKED | external audit after code freeze |
| testnet deployment | roadmap | no live evidence | none live | partial | BLOCKED | deploy production-equivalent testnet and smoke |
| Genesis readiness | predeploy/security policy | blocked | readiness=false | yes | BLOCKED | close artifacts/storage/interface/security/live gates |
| production readiness | release policy | not satisfied | not satisfied | not satisfied | BLOCKED | testnet + audit + Genesis closeout |

## Documentation audit

The Stake manual set is broad (`docs/apps/stake/**`) and correctly communicates the authority split, lifecycle, fees and user safety at a high level. Baseline event/error pages were too generic for integration work; they are expanded on the remediation branch.

Still missing or incomplete for release:

- concrete deployment/materialization runbook specific to the Stake suite;
- exact generated ABI/runtime-hash/predeploy-state references;
- operator procedure for system-call/reward/slash reconciliation;
- production/testnet service publication procedure and smoke checklist;
- user-facing UI operating guide tied to an implemented client;
- known-limitations/readiness record that explicitly tracks the production system-call builder gap;
- final security hardening and external-audit record.

## Application-layer audit

The repository proves that 420Stake has a canonical service ID and Wallet catalogue entry, but that catalogue is only verified navigation. It does not implement validator registration, collateral actions, validator status/reward views, exit/withdrawal guidance or transaction construction.

No dedicated Stake frontend, route/page, deployment package or focused Wallet client was found. Because `config/genesis-applications.json` classifies 420 Stake as `GENESIS_PROTOCOL_AND_USER_APP`, this is a real application-completeness gap. A new authoritative backend should not be invented: canonical state remains on-chain/consensus and shared Indexer projections are appropriate for presentation.

## Genesis/deployment determination

**Code-complete:** NO. The production consensus derivation path and user application surface are missing; frozen interface-layer adoption is unresolved.

**Testnet-ready:** NO. Required runtime artifacts/state, production system-call derivation, exact live deployment and service-publication evidence are absent.

**Genesis-ready:** NO. Predeploy readiness is false, Stake/Rewards security suites are pending hardening, interface-layer requirements are unresolved, and external audit remains required.

**Production-ready:** NO. Testnet qualification, Genesis closeout, live monitoring/recovery and external security gates are outstanding.

## Remediation roadmap

These IDs are additive audit-remediation IDs and must not replace or renumber canonical roadmap items.

1. **STAKE-AUDIT-1 — Canonical dependency/interface-layer reconciliation.** Resolve every 420Stake entry in the frozen Genesis interface dependency matrix against actual runtime need; implement required ProtocolRegistry/governance/pause/health/identity/capability/system-safety/genesis-init/migration/replay/chain-context/metadata behavior or record a governed narrowing decision with executable verifier updates.
2. **STAKE-AUDIT-2 — fourtwentyd validator/reward/slash system-call derivation.** Implement deterministic production construction of validator-state, exit, rotation, slash and reward calls from finalized consensus outcomes, including sequence persistence/recovery and exact ABI payload vectors. **COMPLETE on qualified implementation `cd6e19328e77e1bb19bc198c48fb5154b60a88a0`; retained evidence: `docs/audit/420STAKE-AUDIT-2-QUALIFICATION.md`.**
3. **STAKE-AUDIT-3 — Stake contract/indexer replay and ABI hardening.** Duplicate slash evidence, reward replay/block/participant guards, slash resulting-status event, current public interfaces and canonical Indexer lifecycle rules. **COMPLETE on qualified implementation `7ad103e9d4fab91ec1fac8572d53a0b35bc914e2`; retained evidence: `docs/audit/420STAKE-AUDIT-3-QUALIFICATION.md`.**
4. **STAKE-AUDIT-4 — Security/property/invariant expansion.** Add focused fuzz/property/invariant suites for custody conservation, reserve accounting, transition graph, slash evidence uniqueness, reward at-most-once, bounded participants, external-call rollback and system-call atomicity; close `Validator_Stake` and `Rewards_Treasuries` hardening gates.
5. **STAKE-AUDIT-5 — User-facing 420Stake application.** Implement the canonical Wallet-integrated or standalone client defined by architecture: registration/bond actions, readiness/lifecycle/reward views, exit/withdrawal guidance, network/chain validation, transaction simulation/states/errors, accessibility/responsiveness and fail-closed canonical-source behavior.
6. **STAKE-AUDIT-6 — Indexer/Explorer/SDK completeness.** Generate pinned ABI descriptors from retained artifacts, preserve canonical lifecycle/reward events, add Explorer staking/reward workflow and qualify reorg/finality behavior plus client integration.
7. **STAKE-AUDIT-7 — Frozen predeploy materialization.** Produce deterministic compiler artifacts, runtime code hashes, exact immutable/storage materialization and retained predeploy-state records for RewardController, ValidatorRegistry, CommunityValidatorReserve and Stake420; reconcile deployment manifest/readiness.
8. **STAKE-AUDIT-8 — Production-equivalent public testnet deployment.** Deploy exact qualified code/state, verify code hashes/storage/bindings/system origin/service publication, fund controlled validator scenarios and prove registration→activation→reward→exit/slash→withdraw paths.
9. **STAKE-AUDIT-9 — Operational recovery/observability qualification.** Prove restart/reorg/replay recovery, consensus/execution divergence handling, Indexer rebuild, reward/slash reconciliation, remote-signer separation, alarms and safe withdrawal behavior.
10. **STAKE-AUDIT-10 — External security review and final Genesis closeout.** External audit the frozen Stake/Rewards/native-system-call scope, remediate findings, rerun exact-head repository/security/Genesis qualifications, then update security suite status and release evidence without overstating live readiness.

## Current determination before CI

The application is **not genuinely complete** on the audited baseline. The strongest implemented portion is the core custody/lifecycle contract set and the consensus-to-execution transport/gateway. The missing production consensus derivation layer, frozen shared-interface adoption, generated predeploy state/artifacts, actual user-facing application, live deployment evidence and security/audit gates prevent a testnet/Genesis/production-ready claim even if unit tests are green.
