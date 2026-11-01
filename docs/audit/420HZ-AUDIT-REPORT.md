# 420Hz repository-grounded audit record

Audit date: 2026-10-06  
Repository: `abvhiael/420-integrated-v0.1`  
Base main observed at audit start: `f0f64ecfe28c4390b524baaf7382ef82808aaa17`  
Remediation PR: #555  
Remediation branch: `feature/420hz-reconciliation-20261006`

## Authoritative sources reviewed

- root `README.md`;
- `config/genesis-applications.json` and `docs/GENESIS-DAPPS.md`;
- `contracts/src/creative/README.md`;
- all `contracts/src/creative/**` contracts;
- all matching Creative/HZ Solidity tests;
- `creative-indexer/**`;
- Decision #10 fixture/deployment harness and CI workflows;
- PR #4 (HZ-1), #90 (HZ-2), #100 (HZ-3), #105 (HZ-4);
- current main tree, current branch divergence and exact-head workflow evidence.

## Scope determination

The repository defines 420Hz as a first-year music-focused ecosystem for publishing, streaming, discovery, artist identity, rights, fan relationships and native creator/audience economics. The implemented repository scope is presently the underlying Creative Protocol plus catalog, media/playback and settlement projections.

420Hz is not a frozen public Genesis application. Genesis readiness therefore means compatibility with required Genesis services, not a reserved 420Hz Genesis application address.

## Findings

### Verified complete or substantially complete repository components

- HZ-1 Creative Protocol kernel and deterministic Decision #10 acceptance fixture.
- HZ-2 catalog lifecycle/presentation contracts and PostgreSQL projections.
- HZ-3 media-manifest, storage-source, playback resolution and playback accounting contracts.
- HZ-4 contract/projection implementation after current-main reconciliation in PR #555.
- replay protection for royalty settlement IDs and playback batch IDs;
- explicit governance/submitter boundaries for playback and streaming settlement;
- exact 10,000-bp rights/schedule conservation paths;
- one-hop source royalty routing;
- pull-based RoyaltyVault claims with state updated before value transfer;
- immutable media revisions and content-hash validation during playback resolution.

### Defects repaired by this audit

1. HZ-4 was stranded on PR #105, 9,720 commits behind current main at audit time. Its historical CI could not qualify current main. The nine HZ-4 contract/indexer/test files were reconciled onto a fresh current-main branch.
2. The HZ-4 Solidity allocator permits deterministic zero-value allocations when integer division rounds a recording's share to zero, while the SQL projection rejected those canonical events. The SQL constraint now accepts non-negative recording revenue and regression coverage proves conservation remains intact.
3. HZ-3 `StorageSourceRegistry420.bestAvailableSource` scanned an unbounded creator-controlled current/history array. The current source set is now bounded by the existing Creative Protocol `MAX_SOURCES` constant; retired source records remain queryable and their current slots can be reused.

### Remaining repository/application gaps

- no production 420Hz web/mobile frontend;
- no live RPC/reorg-capable indexer daemon;
- no public 420Hz API/runtime;
- no dedicated SDK/client package for 420Hz;
- no production/testnet deployment manifest for the complete HZ stack;
- no frozen production 420Hz addresses (not required at Genesis, but required for deployment);
- no direct application bindings to Wallet/Names/Identity/Registry/Search/Analytics/Notifications/Verify/Explorer;
- no live storage-provider adapter/runtime despite provider-neutral on-chain storage-source records;
- no public-testnet E2E, restart/reorg, monitoring, backup/recovery or operator evidence;
- no independent production security review.

## Security disposition

### Verified/mitigated
- governance-only module/schedule/submitter controls where specified;
- creator ownership checks for controlled creative actions;
- replay protection on settlement/batch IDs;
- rights/schedule basis-point conservation;
- pull-payment state ordering in RoyaltyVault;
- HZ-4 exact-value routing and atomic rollback on downstream revert;
- storage-resolution iteration now bounded.

### Accepted design risks
- authorized playback and settlement submitters are trusted to commit truthful off-chain aggregate roots; on-chain code enforces authorization, replay and conservation but does not independently prove raw listener events;
- governance can replace/configure several protocol dependencies and therefore remains a high-trust authority;
- native 420 is the current settlement asset; broader asset support is explicitly deferred.

### Unresolved release risks
- no live reorg-capable ingestion/recovery service;
- no production operational security, secrets, monitoring or incident evidence;
- no user-facing integration/security testing because the user application does not yet exist.

## File and component inventory

| Component | Repository evidence | Classification | Notes |
|---|---|---|---|
| Creative shared types/errors/events | `contracts/src/creative/shared/**` | COMPLETE | Typed IDs, protocol enums, permission masks, common errors/events and bounded constants. |
| Creative protocol registry | `core/CreativeProtocolRegistry420.sol` | COMPLETE | Governance-controlled module/version/lifecycle references. |
| Creator profiles | `core/CreatorProfileRegistry420.sol` | COMPLETE | Account-controlled creator profiles with governance status control. |
| Work/Recording identity | `music/WorkRegistry420.sol`, `RecordingRegistry420.sol` | COMPLETE | Stable IDs, activation gates, derivative authorization hooks. |
| Contributor/Rights | `rights/ContributorRegistry420.sol`, `RightsRegistry420.sol` | COMPLETE | Versioned 10,000-bp ownership, acceptance, transfers and historical snapshots. |
| Authorization/Licensing | `rights/AuthorizationRegistry420.sol`, `LicenseRegistry420.sol` | COMPLETE | Versioned policies, expiry/effective-time checks and paid recording licenses. |
| Royalty economics | `economics/RoyaltyScheduleRegistry420.sol`, `RoyaltyVault420.sol`, `RoyaltyRouter420.sol` | COMPLETE | Schedule conservation, replay protection, one-hop source routing and pull claims. |
| HZ-2 catalog | `catalog/CatalogRegistry420.sol`, `CatalogMetadataRegistry420.sol` | COMPLETE | Release lifecycle and versioned presentation metadata commitments. |
| HZ-2 projections/discovery | `creative-indexer/sql/002_catalog.sql`, catalog/discovery stores/tests | COMPLETE | Reference PostgreSQL projections and deterministic queries. |
| HZ-3 media manifests | `media/MediaManifestRegistry420.sol` | COMPLETE | Creator-authorized immutable revisions. |
| HZ-3 storage sources | `media/StorageSourceRegistry420.sol` | COMPLETE | Provider-neutral sources; current set bounded to canonical max after audit repair. |
| HZ-3 playback resolver | `media/PlaybackResolver420.sol` | COMPLETE | Requires matching canonical master content hash and playable source state. |
| HZ-3 playback accounting | `media/PlaybackAccounting420.sol` | COMPLETE | Authorized bounded aggregate submissions and replay protection. |
| Raw playback collection/attestation runtime | no 420Hz service implementation found | MISSING | Raw events are intentionally off-chain, but no production collector/attestor runtime is present. |
| HZ-4 settlement epochs | `StreamingSettlementEpoch420.sol` | COMPLETE | Reconciled from stale PR #105 in PR #555. |
| HZ-4 allocation | `StreamingRevenueAllocator420.sol` | COMPLETE | Deterministic QLT allocation, conservation and dust handling. |
| HZ-4 royalty adapter | `StreamingRoyaltySettlement420.sol` | COMPLETE | STREAM-only exact-value adapter into existing canonical royalty stack. |
| HZ-4 projection | SQL 003 + streaming settlement store/test | COMPLETE | Includes zero-revenue rounding compatibility repair. |
| Decision #10 deployment/seed harness | `contracts/script/Decision10DeploySeed420.s.sol` | COMPLETE | Deterministic development/reference fixture; explicitly test/dev only. |
| Production HZ deployment scripts/manifests | no complete HZ production manifest found | MISSING | Constructor args/order are inferable/documented, but no exact deployed release artifact exists. |
| Production/frozen HZ addresses | no HZ entry in frozen Genesis app/address inventory | NOT APPLICABLE | 420Hz is a first-year flagship, not a frozen Genesis public application; eventual deployment still requires exact addresses/code hashes. |
| Reference indexer | `creative-indexer/**` | PARTIAL | Rebuildable fixture/event projection is implemented; live RPC/reorg/cursor runtime is absent. |
| Public API/backend | no dedicated 420Hz API/service package found | MISSING | Required for complete user application. |
| 420Hz SDK/client | no dedicated package found | MISSING | Typed public client surface remains. |
| 420Hz web/mobile frontend | no dedicated 420Hz UI package found | MISSING | Product workflows cannot yet be user-qualified. |
| Environment template/runtime config | no production 420Hz runtime config found | MISSING | Reference indexer documents DATABASE_URL/fixture vars only. |
| Docker/container deployment | no app-specific 420Hz container definition found | MISSING | Needed only once live services exist. |
| Static assets/logo/icon package | no dedicated 420Hz UI asset package found | MISSING | Relevant when the user-facing application is implemented. |
| CI — Solidity | `.github/workflows/contracts-foundry.yml` | COMPLETE | Exact-head PR sharding; main has full build/test + Decision #10 fixture. |
| CI — reference indexer | `.github/workflows/creative-indexer.yml` | COMPLETE | PostgreSQL 16, Node 22, fixture generation, TypeScript build and tests. |
| Dedicated Solidity static analyzer | no 420Hz Slither/Mythril workflow found | MISSING | Manual security review and behavioral/fuzz/invariant evidence do not equal an independent static-analysis gate. |
| App architecture/status docs | `docs/apps/420hz/index.md` | COMPLETE | Added/reconciled by this audit. |
| Protocol README | `contracts/src/creative/README.md` | COMPLETE | Updated through HZ-4; stale “streaming deferred” statement removed. |
| Indexer README | `creative-indexer/README.md` | COMPLETE | Now distinguishes reference projection from production live indexer. |
| User guide | no complete user-facing 420Hz application/user guide | MISSING | Cannot be finalized before UI/runtime exists. |
| Operator guide | no live 420Hz service/operator guide | MISSING | Cannot be finalized before deployment/runtime design exists. |
| API reference | no public 420Hz API | MISSING | Follows API implementation. |
| Deployment/runbook | no production HZ deployment | MISSING | Required before testnet/public release. |
| Qualification record | this audit + PR #555 exact-head CI | PARTIAL | Becomes current repository evidence only after final SHA CI is green. |

No duplicated competing Creative Protocol implementation was identified in the audited scope. PR #105 is **STALE** as delivery evidence and is superseded operationally by PR #555; its design requirements remain useful canonical evidence.

## Requirement-by-requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Stable creator/work/recording identities | Decision #10 / PR #4 | CreatorProfile, Work, Recording registries | Creative kernel/acceptance | Creative README | COMPLETE | None repository-side. |
| Rights total exactly 10,000 bps | PR #4 | RightsRegistry420 | acceptance/fuzz coverage | Creative README | COMPLETE | None. |
| Rights changes preserve accrued royalties | PR #4 | checkpoint/sync around transfers | Creative kernel acceptance | Creative README | COMPLETE | None. |
| Immutable/versioned creative authorization | PR #4 | AuthorizationRegistry420 | Creative kernel tests | Creative README | COMPLETE | None. |
| Derivative/license gating | PR #4 | Authorization + License registries | acceptance tests | Creative README | COMPLETE | None. |
| Royalty schedules conserve 10,000 bps and protocol cap | PR #4 | RoyaltyScheduleRegistry420 | kernel/acceptance | Creative README | COMPLETE | None. |
| Replay-safe one-hop royalty routing | PR #4 | RoyaltyRouter420 | kernel/acceptance/fuzz | Creative README | COMPLETE | None. |
| Pull-based holder royalty accounting | PR #4 | RoyaltyVault420 | kernel/acceptance/fuzz | Creative README | COMPLETE | None. |
| Catalog release lifecycle | PR #90 HZ-2.1 | CatalogRegistry420 | CatalogRegistry tests | app/contract docs | COMPLETE | None. |
| Creator/release presentation revisions | PR #90 HZ-2.2 | CatalogMetadataRegistry420 | metadata tests | app docs | COMPLETE | None. |
| Rebuildable catalog public projections | PR #90 HZ-2.3 | SQL/catalog store | projection tests | indexer README | COMPLETE | Live ingestion remains separate requirement. |
| Deterministic discovery/filtering | PR #90 HZ-2.4 | discovery store | discovery tests | app docs | COMPLETE | Materialized tag/genre text search remains explicitly deferred. |
| Canonical media manifests | PR #100 HZ-3.1 | MediaManifestRegistry420 | focused Foundry | app docs | COMPLETE | None. |
| Provider-neutral replicas/fallbacks | PR #100 HZ-3.2 | StorageSourceRegistry420 | focused Foundry + bound regression | app docs | COMPLETE | Production provider runtime still required. |
| Playback resolves canonical content identity | PR #100 HZ-3.3 | PlaybackResolver420 | focused Foundry | app docs | COMPLETE | None. |
| Bounded replay-safe playback aggregates | PR #100 HZ-3.4 | PlaybackAccounting420 | focused Foundry | app docs | COMPLETE | Production raw-event collector/attestor missing. |
| One settlement per playback epoch | PR #105 HZ-4.1 | StreamingSettlementEpoch420 | focused Foundry | audit/app docs | COMPLETE | Exact-head CI required. |
| Governance finalization / submitter allowlist | PR #105 HZ-4.1 | StreamingSettlementEpoch420 | focused Foundry | audit/app docs | COMPLETE | Operational key/role handoff needed at deployment. |
| Deterministic proportional streaming allocation | PR #105 HZ-4.2 | StreamingRevenueAllocator420 | focused Foundry | audit/app docs | COMPLETE | Exact-head CI required. |
| Allocation conserves plays, QLT and gross revenue | PR #105 HZ-4.2 | allocator conservation gates | focused Foundry + projection tests | audit/app docs | COMPLETE | None after qualification. |
| Rounding/dust deterministic | PR #105 HZ-4.2 | final canonical recording receives dust | Foundry + new zero-revenue projection test | audit docs | COMPLETE | None. |
| STREAM-only exact-value royalty routing | PR #105 HZ-4.3 | StreamingRoyaltySettlement420 | focused Foundry | audit/app docs | COMPLETE | Must allowlist deployed adapter in canonical RoyaltyRouter. |
| HZ-4 projection replay/conservation | PR #105 HZ-4.4 implementation | SQL/store | TypeScript/PostgreSQL tests | indexer/audit docs | COMPLETE | Live ingestion/reorg handling still missing. |
| Live canonical RPC ingestion | creative-indexer README | fixture/caller event ingestion only | no live reorg suite | limitation documented | MISSING | Implement AUDIT-4. |
| Reorg rollback/replay and durable cursor | creative-indexer README | absent | absent | limitation documented | MISSING | Implement AUDIT-4. |
| Creator/listener user application | root README 420Hz scope | absent | absent | scope only | MISSING | Implement AUDIT-6. |
| Wallet/network transaction UX | ecosystem architecture principle | absent | absent | integration gap documented | MISSING | Implement AUDIT-6/7. |
| Shared Registry/service discovery | root README interoperability principle | internal CreativeProtocolRegistry only; no ecosystem service binding | absent app integration | gap documented | PARTIAL | Bind canonical 420Registry/service IDs in AUDIT-7. |
| Names/optional Identity presentation | root README | no app binding | absent | gap documented | MISSING | AUDIT-7. |
| Search/Analytics integration | root README | HZ-local reference projection only | absent cross-app | gap documented | PARTIAL | AUDIT-7. |
| Notifications integration | root README | absent | absent | gap documented | MISSING | AUDIT-7. |
| Provider/storage service integration | PR #100 + root provider-neutral principle | on-chain provider references only | contract tests | gap documented | PARTIAL | Runtime/provider adapters + testnet evidence. |
| Native 420 settlement | Creative README / PR #4 | implemented | economic tests | documented | COMPLETE | Multi-asset settlement remains deliberately deferred. |
| Production deployment addresses/config | release requirements | absent | absent | deployment order documented only | MISSING | AUDIT-8. |
| Public-testnet smoke/E2E/recovery | release requirements | absent | absent | roadmap documented | BLOCKED | Requires live services, UI, API and testnet. |
| Independent release security qualification | release requirements | not performed | repo behavioral tests only | risk documented | BLOCKED | Exact release + independent review after testnet. |
| Frozen Genesis public-app slot | Genesis Application Decision #1 | 420Hz not in frozen catalog | n/a | Genesis docs | NOT APPLICABLE | Do not invent a Genesis slot/address. |

## Build and dependency audit

- Solidity compiler: **0.8.24**, EVM target **Cancun**, optimizer enabled with 200 runs, `via_ir=true`.
- Foundry default fuzz: **10,000** runs; PR profile: **2,500**; CI: **50,000**; hardening: **100,000**. Invariant profiles are also defined.
- Creative indexer: `@420/creative-indexer` 0.1.0, Node **>=22**, TypeScript **^5.7.2**, `pg` **^8.13.1**.
- Reference-indexer CI uses **PostgreSQL 16**, generates the Decision #10 fixture, runs `npm install`, TypeScript build, then serial test execution.
- No separate 420Hz frontend/backend dependency graph exists because those components are absent.
- Generated Decision #10 fixture is produced in CI rather than treated as an unreproducible committed artifact.
- No 420Hz-specific Docker/production runtime packaging or environment template was found.

## Security review detail

| Area | Disposition | Evidence / remaining risk |
|---|---|---|
| Access control | verified safe behavior within audited contract paths | creator ownership and governance/submitter checks are explicit; deployment role handoff remains operational. |
| Privilege escalation | no bypass identified in reviewed paths | governance remains intentionally powerful; compromise is an accepted trust risk. |
| Settlement replay | verified safe behavior | batch/settlement/route IDs are replay guarded. |
| Signature/domain replay | NOT APPLICABLE to current HZ paths | audited HZ contracts do not implement signature-authorized settlement paths; licence settlement IDs include chain ID. |
| Reentrancy/value calls | mitigated | RoyaltyVault zeroes claim state before calls; router/streaming adapter set state before calls and revert atomically. |
| Accounting/rounding | verified after remediation | exact schedule/split conservation; HZ-4 gross conservation; projection now accepts valid zero-value rounded rows. |
| Unbounded iteration | mitigated | storage-source current set now bounded to canonical max; playback/allocation batches capped at 100; rights holders capped at 64. |
| Front-running/MEV | accepted design risk | creator/governance state transactions are public; no auction/price execution in audited HZ streaming path. |
| Oracle/stale data | NOT APPLICABLE to implemented HZ pricing path | no oracle price dependency in native-420 V1. Off-chain playback roots are submitter-trusted instead. |
| Cross-chain/bridge replay | NOT APPLICABLE | no HZ bridge path implemented. |
| Upgrade/storage collision | NOT APPLICABLE to audited contracts | constructor/immutable model; no proxy upgrade storage layout discovered. |
| Raw playback truth | accepted design risk | chain verifies submitter authority/replay/conservation, not individual listener-event truth. |
| Live indexer reorg safety | unresolved vulnerability for release operations | production live ingestion/rollback is absent; reference fixture projection must not be used as production authority. |
| Static analyzer | unresolved qualification gap | no HZ Slither/Mythril CI gate found. |
| Secrets/ops | unresolved release risk | production service/secrets model does not yet exist. |

## Readiness

- CODE COMPLETE: **NO** — HZ-1 through HZ-4 protocol code is present on PR #555, but the canonical product scope also requires a user application and live service/API layer that do not exist.
- BUILD COMPLETE: **NO** — existing contract/indexer components are buildable and are being exact-head qualified, but there is no complete application build because required API/frontend/runtime components are absent.
- CONTRACT COMPLETE: **PENDING EXACT-HEAD QUALIFICATION** — required HZ-1..HZ-4 contract implementation is present; this line may become YES only after final PR-head Solidity qualification is green.
- TEST COMPLETE: **NO** — contract/reference-indexer tests exist, but live RPC/reorg, API, frontend, cross-app and public-testnet E2E/recovery coverage is absent.
- DOCUMENTATION COMPLETE: **NO** — protocol architecture/audit limitations are documented; user, API, operator and production deployment manuals require the missing runtime/application.
- INTEGRATION COMPLETE: **NO** — no complete application bindings to Wallet/Registry/Names/Identity/Search/Analytics/Notifications/Verify/Explorer/storage runtime.
- SECURITY QUALIFIED: **NO** — repository hardening is improved, but no production runtime review, dedicated static-analysis gate, public-testnet adversarial evidence or independent exact-release review exists.
- TESTNET READY: **NO** — missing live indexer/API/UI/deployment and ecosystem binding.
- GENESIS READY: **NO** — 420Hz is not intended to be a frozen public Genesis application; no Genesis slot should be invented. Its later deployment compatibility with Genesis services is not yet end-to-end qualified.
- PRODUCTION READY: **NO** — depends on completion of AUDIT-4 through AUDIT-8 and exact deployed-release qualification.

Final exact SHA and workflow run IDs must be appended only after all applicable PR #555 qualification jobs complete successfully against the final documentation/code head.
