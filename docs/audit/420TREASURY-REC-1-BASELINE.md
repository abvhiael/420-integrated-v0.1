# TREASURY-REC-1 — repository baseline and remediation ledger

Status: repository baseline reconciled; implementation/testnet qualification not inferred.  
Baseline main: `a6b6070833e0e0a5c96238b279528729ef257033` (merged PAY-APP-18 handoff, PR #1222).  
Last Treasury qualification implementation: `d830f464e46f7eeffaee462f3e813224e081f83c` (AUDIT-7).  
Date: 2026-11-19. This is the single reconciliation ledger for REC-1; subsequent REC steps own remediation and qualification. No frozen decisions or authority changes.

## Method and evidence limitations

Compared complete recursive Git trees (not search-index snapshots) at both immutable commits: 5913 and 16702 entries respectively; both `truncated=false`. The Git compare endpoint returned 300 file records despite 12,540 commits ahead and therefore cannot establish a comprehensive change inventory by itself. The tree comparison provides exact blob identity for paths below. Targeted source reads at the baseline and code searches for TreasuryRouter420, TreasuryDisbursementRegistry420, vaultReleaseHash, markExecuted, treasuryBudget, treasury/v1 and VAULT_TREASURY supplement path inventory; indexed search may lag current main, so absence of a search result is not proof of absence. Relevant production entrypoints found are listed below; remaining transitive/dynamic consumer and release orchestration verification is expressly assigned in the ledger rather than claimed complete. Full local repository execution was not performed. Exact historical job lookups for all six run IDs returned HTTP 404, including direct run lookup for AUDIT-7. Retained repository evidence remains historical; no new CI pass is claimed and no tests are invalidated by the documentation-only reconciliation.

## Branches and pull requests

- PR #25 Genesis Treasury implementation merged as `f1b2105de5f1423d529ff9b099fe4a697ad9798f`; PR #474 Treasury audit merged as `14d46231aa4350b2e84dee52f0f664bdd2e785f4`. Both corresponding branches are strictly behind main (0 ahead; 20,579 and 12,536 behind respectively); no unique Treasury commits to merge. Treasury branch search exhausted both pages.
- Grants PR #26 merged `90abe7776aaa3dbc73043975d6689859ec574f77`; audit PR #484 merged `821e565071381691a2dba554d21aeedd26477792`. Preserve both.
- Open PR inventory: 161 entries across two REST pages (100 + 61). No dedicated Treasury PR identified. Relevant adjacent PR file lists inspected: #622 organization permissions (one Treasury-related path), #627 HighCountry R04 (gateway, permissions, identity test), #734 Genesis catalog (docs/GENESIS-DAPPS.md); #623, #819, #500, #425, #1138, #888, #884, #672, #475 had no matching direct Treasury / shared-core paths under the selected review filter. These open PRs are not merged or adopted; their future changes require checking against the baseline. Do not revive legacy game PRs or alter unrelated branches as part of Treasury.
- Authoritative comparisons: [baseline commit](https://github.com/abvhiael/420-integrated-v0.1/commit/a6b6070833e0e0a5c96238b279528729ef257033), [prior qualification](https://github.com/abvhiael/420-integrated-v0.1/commit/d830f464e46f7eeffaee462f3e813224e081f83c), [comparison](https://github.com/abvhiael/420-integrated-v0.1/compare/d830f464e46f7eeffaee462f3e813224e081f83c...a6b6070833e0e0a5c96238b279528729ef257033).

## Canonical inventory and authority

- Five deployable Treasury contracts: `contracts/src/treasury/TreasuryAuthorization420.sol` (exact capability scope), `TreasuryPolicyRegistry420.sol` (asset policy, immutable epoch geometry), `TreasuryBudgetRegistry420.sol` (governed budget, controller-only reserve/settle/release), `TreasuryDisbursementRegistry420.sol` (canonical ID, scheduling, execution and cancellation), `TreasuryRouter420.sol` (read-only). `TreasuryIds420.sol` is a library, not a deployable authority. All six blob identities match AUDIT-7. Common interfaces I420System, ICapabilityRegistry420, ServiceIds420, SystemAccess; Grants declares its own ITreasuryDisbursementGrant420 interface in GrantMilestoneRegistry420. No empty implementation identified in these six Treasury files.
- `contracts/config/420treasury-genesis.json`, `contracts/config/treasury/treasury-audit-6-release-materialization.json`, canonical addresses, namespace and contract map; current namespace preserves GovernanceTimelock 0x0000000000000000000000000000000000000429 and ProtocolRegistry 0x0000000000000000000000000000000000000434; CapabilityRegistry420 0x0000000000000000000000000000000000000447 is CANDIDATE_NOT_DEPLOYED_NOT_FROZEN. TreasuryRouter is REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS; retired 0x0421 CapabilityRegistry and 0x0422 ProtocolRegistry must not be adopted.
- `docs/GENESIS-DAPPS.md` explicitly distinguishes the narrower active public V10 JSON from the broader implementation map (which includes Treasury). Treasury is a covered Genesis protocol, not a standalone public application. No standalone Treasury web app or fixed predeploy is missing. The contract map additionally associates four revenue contracts in `contracts/src/revenue/`: DevelopmentCompensationIds420, DevelopmentCompensationVault420, ApplicationRevenueIds420 and ApplicationRevenueRegistry420. They have their own revenue/compensation policy and qualification owners, not interchangeable public-budget custody. IDs and vault changed since AUDIT-7; reconcile relevant interactions without reopening unrelated revenue work. Legacy `contracts/src/system/{AttentionTreasury,DevelopmentTreasury,ProtocolTreasury}.sol` are distinct systems; names do not confer modern Treasury authority.
- Shared dependencies: `contracts/src/governance/` (all existing Governance/Civic source blobs unchanged), SystemAccess, CapabilityRegistry420, ICapabilityRegistry420, ProtocolRegistry, ServiceIds420 (unchanged). `contracts/src/vault/` (all eight source blobs unchanged): AssetVault420, VaultAccounting420, VaultAuthorization420, VaultFactory420, VaultIds420, VaultPolicyRegistry420, VaultRegistry420, VaultRouter420. Canonical custody remains VAULT_TREASURY.
- Grants consumer: GrantApplicationRegistry420, GrantAwardRegistry420, GrantMilestoneRegistry420, GrantProgramRegistry420 changed; GrantIds420, GrantAuthorization420, GrantRouter420 unchanged. Current milestone source adds ordinal protection, one-disbursement-to-one-milestone binding, cancellation protection requiring Treasury cancellation and retains EXECUTED plus nonzero release commitment. Its local mirrored ABI must be reconciled with compiled Treasury tuple; do not claim independent payment proof. GRANTS-AUDIT-1 through 8 are recorded complete in `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`, live GRANTS-AUDIT-9 remains separate.
- New direct runtime caller: `contracts/src/highcountry/organization/CanonicalOrganizationTreasuryGateway.sol` calls router.isExecutable, consumes organization permission and calls disbursement.markExecuted with caller-supplied nonzero releaseReceipt. No live Vault transfer/proof is performed by the gateway. `OrganizationTreasuryPermissions.sol` and `contracts/test/highcountry/integration/R04TreasuryIdentity.t.sol` are adjacent. Respect HighCountry ownership/decoupling and verify whether retained integration is active or legacy (REC-4/6). HighCountry cooperative GovernanceExecutor.markExecuted is a separate cooperative lifecycle, not Treasury settlement. TownAuthority420 stores reference-only Treasury identity/address; `contracts/test/TownAuthorityTreasury420.t.sol` is new, no custody. Check reference-only semantics, not a new spending authority.
- Indexer: `420-indexer/descriptors/treasury420-v1.json`, `src/treasury-descriptors.ts`, `src/treasury-read-model.ts`, `test/treasury420-integration.test.ts` unchanged. Shared exports/index, HTTP transport and API surface changed; canonical route strings remain `GET /v1/treasury/budgets/:id?chainId=...` and `GET /v1/treasury/disbursements/:id?chainId=...`; grants-read-model is adjacent. Analytics `analytics/indexerclient/client.go`, `metrics/economic.go`, `methodology/registry.go` unchanged; verify shared transport and Explorer current consumer behavior. Explorer is contract-free and reads Indexer; see `docs/audit/420EXPLORER-TESTNET-WORK-ROADMAP.md` for its own deployment placeholders. Wallet catalog and token runtime references are not evidence of Treasury transaction construction; no dedicated modern Treasury SDK/Wallet write path established by this inspection. Required integration only as canonically scoped.
- Tests and verification: `contracts/test/TreasuryGenesis420.t.sol`, `TreasurySecurityProperties420.t.sol`, `TreasuryDeploymentBinding420.t.sol`, `420-indexer/test/treasury420-integration.test.ts`, `.github/workflows/treasury-audit.yml`, scripts/verify-treasury-audit-5-descriptor.py and -6-release.py unchanged. AUDIT-7 docs verifier changed. Adjacent GrantsDeploymentBinding420, GrantsGenesis420, GovernanceAudit7Integration420, TownAuthorityTreasury420, R04TreasuryIdentity and Indexer HTTP/testnet consumer tests are targeted verification candidates. Existing test doubles are test fixtures, not evidence of production custody. No stale deployed ABI asserted without build; compiled descriptor/ABI and mirrored interface verification remain REC-6/7/8.

## Retained qualification evidence (not new execution)

| Stage | Implementation SHA | Run / job | Source |
| --- | --- | --- | --- |
| AUDIT-1 | original audit/classification, PR #25 and #474 | no separate run claimed | 420TREASURY-COMPLETE-AUDIT-20261001.md; canonical roadmap |
| AUDIT-2 | 56429210af5738114b47a1aa658509ee19a3b440 | 36967108988 / 110713142223 | 420TREASURY-AUDIT-2-QUALIFICATION.md |
| AUDIT-3 | 0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468 | 36970820536 / 110724220149 | 420TREASURY-AUDIT-3-QUALIFICATION.md |
| AUDIT-4 | afc1e8d7c6742b6568db9170decc70d7eadbc763 | 36972209878 / 110728359462 | 420TREASURY-AUDIT-4-QUALIFICATION.md |
| AUDIT-5 | 8f184754c2497dd5add35e9d5f3e97555a1d8883 | 37038055729 / 110941058630 | 420TREASURY-AUDIT-5-QUALIFICATION.md |
| AUDIT-6 | 5e37fd3f470a6c2dfd6102042ca7386f4b1c2e87 | 37040835840 / 110950258291 | 420TREASURY-AUDIT-6-QUALIFICATION.md |
| AUDIT-7 | d830f464e46f7eeffaee462f3e813224e081f83c | 37048836697 / 110976867842 | 420TREASURY-AUDIT-7-QUALIFICATION.md |

AUDIT-7 reports 9 lifecycle, 5 property, 4 Grants, 4 deployment binding, 18 Indexer tests passed; Analytics, build, verifiers and forbidden primitive scan passed and Slither reported zero high-severity findings. AUDIT-5 recorded 2,500 runs per fuzz property. Preserve original evidence commits and run IDs; do not rerun solely because unrelated code moved. Current main is not independently contract/build/security qualified by this ledger.

## Single remediation ledger

| ID | Classification | Evidence at baseline / disposition | Owner |
| --- | --- | --- | --- |
| R01 | Confirmed local defect | TreasuryRouter.isExecutable omits epochSpent + amount <= maxEpochDisbursement, while markExecuted reverts EpochLimit. Correct eligibility, preserve caller-specific authorization distinction. | REC-2 |
| R02 | Confirmed representation mismatch; support decision unresolved | TreasuryPolicyRegistry.setAssetPolicy and TreasuryBudgetRegistry.createBudget reject zero asset; AssetVault420._recordNativeDeposit and _sendExact use address(0) for native currency. Establish canonical native representation and bridge incompatibility without inventing a namespace. | REC-3 |
| R03 | Adopted trust boundary; local execution verification unresolved | markExecuted requires authorized principal and nonzero hash, not cryptographic proof. Locate and qualify actual release orchestrator, retries, provenance and consumer presentation; no architectural change without explicit approval. HighCountry gateway accepts nonzero receipt and forwards it; it is not evidence of a Vault release. | REC-4 |
| R04 | Local dependency verification | Governance, system access, capability, Registry, Vault blobs unchanged, but verify live-manifest-independent integration and current shared authority/capability behavior. | REC-5 |
| R05 | Local changed consumer | Four Grants registry blobs changed; new HighCountry gateway, Town reference test, Wallet and SDK scope need reconciliation. Preserve approved commitment-only model; qualify tuple and one-to-one milestone/cancellation. | REC-6 |
| R06 | Local changed read boundary | Shared Indexer HTTP/API/export changes; direct Treasury descriptor/read-model unchanged; verify current Explorer/Analytics projections, chain binding, replay and restart. | REC-7 |
| R07 | Local configuration/deployment verification | Namespace and contract map changed; exact Treasury genesis/release JSON unchanged. Verify deployment tooling and ABI/artifacts, no fixed Treasury address, candidate/live separation. Explorer's own REPLACE fields are not Treasury deployment addresses. | REC-8 |
| R08 | Confirmed documentation discrepancy | 420treasury-genesis.json TREASURY-INV-005 says committed plus executed <= ceiling but implementation and operator guide require executed <= committed <= ceiling (committed includes executed). Reconcile wording and affected verifier with invariant, not a change to arithmetic. | REC-8/9 |
| R09 | Local security/qualification | Refresh affected regression and release-consumer inventory only; prepare external review. Existing targeted Slither and tests are historical. | REC-9 |
| R10 | Local closeout | Exact release/head, docs and evidence reconciliation; merge qualified changes only when requested. | REC-10 |
| T01 | Genuine live dependency | Official chain ID/genesis identity, deployed addresses/runtime hashes, real publication, live governance/capability transactions, live disbursement lifecycle, actual Vault receipt correlation, live Indexer/Explorer/Analytics agreement, network restart/reorg/replay drills. | AUDIT-8 |
| E01 | External review / final production boundary | Independent Treasury/Vault review, findings remediation, final candidate exact-head qualification and readiness declarations; review preparation is local, not blocked by testnet. | AUDIT-9 |

No local finding is classified as testnet-only. Unverified interfaces, mocks and production placeholders are verification items, not invented defects. The frozen release model and no-standalone-site classification remain intact.

## Exact blob comparison — directly scoped files and adjacent dependencies

Compared 90 paths in the stated scope (26 changed/added/deleted, 64 identical); paths and blob IDs are generated from complete pinned Git trees. This filter includes Treasury-named artifacts, core governance/Vault/Grants/revenue sources and directly identified neighboring paths, not every transitive dependency in the monorepo.

| Path | AUDIT-7 blob | Baseline blob |
| --- | --- | --- |
| `420-indexer/src/api-surface.ts` | `dd0338cf52a39d80ed39f73294ba63753de5441c` | `fcd25fb2e1bfbe86a98924105e8748027d2be9ca` |
| `420-indexer/src/grants-read-model.ts` | `absent` | `63e02026b32d3c4e34113c081412946b6792b045` |
| `420-indexer/src/http-transport.ts` | `88b23047f657264219c6b07c2c0d7b06b71fd52f` | `d1eed1414ce0b1bd371b2486e576102af15b03c8` |
| `420-indexer/src/index.ts` | `42a36bb72e187a00a6023df15baa0ccf38198ca0` | `ae89ef34a08cd6e9c1ce89a20a544c2e0a34b6d4` |
| `contracts/config/genesis-address-namespace.json` | `e6461503fbf49de5ef296ab3b102c39981a29342` | `d9c40056db30513c0445f0c341d261b63dc6a1a5` |
| `contracts/config/genesis-dapp-contract-map.json` | `8e486835fe00aa4cc8f62783f2050d38eab45018` | `928cee9614bacb4f7e11ef3b0e82227e9ab3b90b` |
| `contracts/src/grants/GrantApplicationRegistry420.sol` | `18beadce58fda86326c91e4af229033adc191951` | `12f7803e21d8133cc31a39efe9019719fc51920c` |
| `contracts/src/grants/GrantAwardRegistry420.sol` | `87d1cd9ad26141a95c88d5c9d38460addb0eca40` | `5acff1eb76f16b0037d1fc8d0076e1d39f36c89e` |
| `contracts/src/grants/GrantMilestoneRegistry420.sol` | `c61f65568fb70189fab2bdec54f0c60de87ac3b6` | `c8072c62c04807c15d0069d4ac6d941e862ebe97` |
| `contracts/src/grants/GrantProgramRegistry420.sol` | `8013961fb3045e10235b55a70a38d6582d8174b4` | `816cbc4c204bf466e62381cdf7a37f0e9723ed9c` |
| `contracts/src/highcountry/cooperative/CooperativeGovernance.sol` | `absent` | `f6e8f7eea99ad4a48b65e84f12be967f9a146af1` |
| `contracts/src/highcountry/cooperative/GovernanceExecutor.sol` | `absent` | `892e265875b5700efca8f3e15a9bb3fe988433ac` |
| `contracts/src/highcountry/organization/CanonicalOrganizationTreasuryGateway.sol` | `absent` | `e2757db5a988d1b4c774b0dc4197cb0ca19fde3c` |
| `contracts/src/highcountry/organization/OrganizationTreasuryPermissions.sol` | `absent` | `ad2b8845f88b60996ce70f6d5a9657114b7bb804` |
| `contracts/src/revenue/DevelopmentCompensationIds420.sol` | `ca2d1edfd9022c109a1e00f1a1a09c235a468c13` | `90266268f64464dbe826ad4a2d7f067224992693` |
| `contracts/src/revenue/DevelopmentCompensationVault420.sol` | `59468533dda571c61886cff0f07c2672f8a103bd` | `46d156e901db13eca1ee6bebcb78ae4cecd67595` |
| `contracts/src/town/TownAuthority420.sol` | `absent` | `3d9c510dad04aea3af83d68e8582b4b2443d79e5` |
| `contracts/test/TownAuthorityTreasury420.t.sol` | `absent` | `a9a8ee1b4a2e81611238dce19fa647871c17db42` |
| `contracts/test/highcountry/integration/R04TreasuryIdentity.t.sol` | `absent` | `8532de84231be8d8165ad72554d4a8f8a0471423` |
| `docs/GENESIS-DAPPS.md` | `48f8aff61b81b8297b7a358a7c053265f636f4f9` | `6e32d186fb8601acca1aaab6e9fb773d7f730fb5` |
| `docs/apps/treasury/operator-guide.md` | `8fe08cad3faeff38b6f6dc8ec0e8ed0bc1bb7715` | `a0cc0b7bf5cc1962972dac4ea96e9ed1352239a1` |
| `docs/architecture/protocols/stake-governance-treasury-grants.md` | `ee3d9a14e43d7962b2425bfe1118a08d6faec891` | `dc5257a89b4afcd2ba9f947e9fc3c1024d18feab` |
| `docs/audit/420TREASURY-AUDIT-7-QUALIFICATION.md` | `absent` | `0751bc2fddb76ceaa96f68bf6d81d8f9b574db3f` |
| `docs/audit/420TREASURY-AUDIT-REMEDIATION-ROADMAP.md` | `fe9d7fae72b180c9472bae749e1ab5a27b4cc43c` | `149fc0f6ab2244c07d0977878cb139f39d8bda4e` |
| `scripts/verify-treasury-audit-7-docs.py` | `9d2198e21bfe6d0b1912cb346f42ccaedf2938ce` | `feb81985c1316fa94bf1eb79b3d06c6953321b69` |
| `wallet/web/core/token-runtime.js` | `absent` | `6c5106d5dd390836ea836a59521f55dd72473526` |

### Identical paths (both commits)

| Path | Git blob SHA |
| --- | --- |
| `.github/workflows/treasury-audit.yml` | `987cb14fa19d63fd384e43fa8cffeb54512dba7e` |
| `420-indexer/descriptors/treasury420-v1.json` | `5ed44cda1842b31253da30a3e15679795f42ed8f` |
| `420-indexer/src/treasury-descriptors.ts` | `32cc4bab8731e42a46ea89bb761c588e3df39b1c` |
| `420-indexer/src/treasury-read-model.ts` | `3d76e8894c53ea68b730098ea421eac8a3391c83` |
| `420-indexer/test/treasury420-integration.test.ts` | `da393e5a9ca5adbb8d1bae23f483be588a486445` |
| `analytics/indexerclient/client.go` | `4d89c90882d2dbc355d9a5a4c0f3ff4333d0f53b` |
| `analytics/methodology/registry.go` | `1f7be1220d7c6ebc2eb36b673bf960427bde777a` |
| `analytics/metrics/economic.go` | `215a59ab3570c0c099a82b67a3a4042164ab4eeb` |
| `contracts/config/420treasury-genesis.json` | `ba68374e9388a3ea8010cce4a9c4856d0817fe7e` |
| `contracts/config/genesis-canonical-addresses.json` | `6ea5ffd37bee347e51e8141bbea000d008a52781` |
| `contracts/config/treasury/treasury-audit-6-release-materialization.json` | `70dfbc2ca8616cdf8bab927dab2043e1c10c6ccc` |
| `contracts/src/apps/ProtocolRegistry.sol` | `9ab3d53a68b6533978f41e0202e5268f1d615c19` |
| `contracts/src/governance/CivicConstitution420.sol` | `198c88d8c3bf58e20daf6b9ed73aa89817cb0942` |
| `contracts/src/governance/CivicElectorateRegistry420.sol` | `3113d8cf485cac82e72a5cb564a848d6b67a8d69` |
| `contracts/src/governance/CivicGovernor420.sol` | `0412237da9aefe7238adc8333169bf09d347ae05` |
| `contracts/src/governance/CivicIds420.sol` | `c1007e4fdf0ec587660f645e2eefcd9c20edb263` |
| `contracts/src/governance/CivicMerkleElectorateSource420.sol` | `a16febddf53e305fbf54e25889904050eea73a1a` |
| `contracts/src/governance/CivicProposalRegistry420.sol` | `6d42bb3fc0b91f2eebc817d9d5fdb27b687ccf31` |
| `contracts/src/governance/CivicVoting420.sol` | `68e463fde4e4dff058f18e7435cdcf32cf6e1965` |
| `contracts/src/governance/Governance420.sol` | `886668e8efa97bd32734e32cde11148bcf98e5bd` |
| `contracts/src/governance/GovernanceTimelock.sol` | `30977a1e172763aa333eeb4b34b1bbaee025c235` |
| `contracts/src/governance/ICivicElectorateSource420.sol` | `e6676f965abab77fd5e8a4624b2cd96da25f1bb2` |
| `contracts/src/grants/GrantAuthorization420.sol` | `17a075a26e3efa28f8229fe0c3717577dbf4f92b` |
| `contracts/src/grants/GrantIds420.sol` | `ded62e2e8aee7e93f85b81bb47846fd9fc847131` |
| `contracts/src/grants/GrantRouter420.sol` | `306f51d77a80893dffb8c6d5dfab99405f5dde7f` |
| `contracts/src/interfaces/I420System.sol` | `5a2edcdc707a3736db47ae8207292bbc32798d48` |
| `contracts/src/interfaces/genesis/ICapabilityRegistry420.sol` | `266f4003c86fafb74e7bcbc869bed1df39f28cfb` |
| `contracts/src/libraries/ServiceIds420.sol` | `dd00c073fe17f7095a0bccb5db2678ff9cc8e8bd` |
| `contracts/src/revenue/ApplicationRevenueIds420.sol` | `cc614e5509fd71f5a8e90b031a729a4b317ce446` |
| `contracts/src/revenue/ApplicationRevenueRegistry420.sol` | `a98df7028809e9fff6a33ccd833ce3d843f9f77d` |
| `contracts/src/system/AttentionTreasury.sol` | `41958e2d670f1128c4d5dfc59d83a854d3ed0611` |
| `contracts/src/system/CapabilityRegistry420.sol` | `130b5cf5f94a96cd9646f6ab32d6fbe9c49333b1` |
| `contracts/src/system/DevelopmentTreasury.sol` | `74cada4c7c5ff5a8721b34f033b10ac22fd385c3` |
| `contracts/src/system/ProtocolTreasury.sol` | `b4b165cbca9509700289c510a15dfdbeef7f4477` |
| `contracts/src/system/SystemAccess.sol` | `7d9224b629d5d7049810966743eed43df675f64d` |
| `contracts/src/treasury/TreasuryAuthorization420.sol` | `68e6112f6134b39c55c929ade49afcf2fc30e65e` |
| `contracts/src/treasury/TreasuryBudgetRegistry420.sol` | `e2a36e32d4df74b70847c6fc115e34b9f3034438` |
| `contracts/src/treasury/TreasuryDisbursementRegistry420.sol` | `bb3012601fdb86106ccee79bf0b726b6154775e6` |
| `contracts/src/treasury/TreasuryIds420.sol` | `c5da6aef38bb6f9d5b78905c27896b1de0a79543` |
| `contracts/src/treasury/TreasuryPolicyRegistry420.sol` | `abf676b49087337bd43c44e585919eea64b9b142` |
| `contracts/src/treasury/TreasuryRouter420.sol` | `0983f74a96c178a8bbb6e926a8ad7d20bb7a5d09` |
| `contracts/src/vault/AssetVault420.sol` | `c4dbcc6c60588c8487de53c9203b887a04852f89` |
| `contracts/src/vault/VaultAccounting420.sol` | `a2ca1174ba2852a75e73d6fd0ffa343ffb0a3e12` |
| `contracts/src/vault/VaultAuthorization420.sol` | `51c0351202053e6116f6e7bd33242930fa0717d4` |
| `contracts/src/vault/VaultFactory420.sol` | `a9713120a89fac3cf034348dbb0e6870338ba5c8` |
| `contracts/src/vault/VaultIds420.sol` | `b84888c16088381002f4fc9e0014b97c5fbef2ce` |
| `contracts/src/vault/VaultPolicyRegistry420.sol` | `b3316826fbd09fcf1da37dc4c845e02ecdf4ad4d` |
| `contracts/src/vault/VaultRegistry420.sol` | `f483023a4876930a7dc3f5506809fcb3f6411ca8` |
| `contracts/src/vault/VaultRouter420.sol` | `a4603ea5effc49ad182ff0b3b8584b76729ee747` |
| `contracts/test/TreasuryDeploymentBinding420.t.sol` | `64a7682be769bbf88ea12b25118e4216522f25da` |
| `contracts/test/TreasuryGenesis420.t.sol` | `0061e1be7f5fea500eab3234fc0f08d904dd889e` |
| `contracts/test/TreasurySecurityProperties420.t.sol` | `ae035cb8bec28ea74ae5f316f316dcfb23eb6e21` |
| `docs/420ANALYTICS-3.4-TREASURY-ECONOMIC-METRICS.md` | `3e3ea7e3b8a5bbe8426cfeacd658247e131912a4` |
| `docs/apps/treasury/reference.md` | `26524e4b92d564ccf5f9e5f774e2fa437b610036` |
| `docs/architecture/decisions/TREASURY-AUDIT-4-VAULT-RELEASE-EVIDENCE-MODEL.md` | `c393267165fc6adeb2eaaed2886680f427ae7151` |
| `docs/audit/420TREASURY-AUDIT-2-QUALIFICATION.md` | `ab22dedd22274b65a24f41830eaa6688ad2a7f38` |
| `docs/audit/420TREASURY-AUDIT-3-QUALIFICATION.md` | `169028302d9b1404d654ecb437278fc543bda10c` |
| `docs/audit/420TREASURY-AUDIT-4-QUALIFICATION.md` | `b4f6d67a5e443cc5ef4406777cd59bc5de2d88dc` |
| `docs/audit/420TREASURY-AUDIT-5-QUALIFICATION.md` | `43865479133ae222735d699bdd0c091f91e83d0b` |
| `docs/audit/420TREASURY-AUDIT-6-QUALIFICATION.md` | `c7564d95c92f0b792914f3610b56ddabbdcfd471` |
| `docs/audit/420TREASURY-COMPLETE-AUDIT-20261001.md` | `2e4453d9b3a662e2f50dd62def225465d72f640c` |
| `scripts/verify-treasury-audit-5-descriptor.py` | `47a2f03a248d6504fb63843a5f13c4075cb1822c` |
| `scripts/verify-treasury-audit-6-release.py` | `7a170f5382a49f8ba0b13a4fbff46f40fa32bf7a` |
| `wallet/web/test/genesis-app-catalog.test.js` | `5b3e88fefc30b1e236c51be677281bac2e7f2ed5` |

## REC-1 evidence boundary and next step

Baseline pinned, prior evidence reconciled, repository inventory/delta and single issue ledger recorded. No production source or frozen decision modified; no contract test rerun required for this baseline artifact alone. Next REC-2 is router eligibility correction; do not begin implementation within REC-1. The baseline is not a readiness declaration.
