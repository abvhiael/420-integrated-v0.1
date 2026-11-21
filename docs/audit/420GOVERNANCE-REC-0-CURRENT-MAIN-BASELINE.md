# GOV-REC-0 — 420Governance current-main baseline and dependency reconciliation

> **Scope:** exact-head, audit-only inventory. No contract or Genesis configuration changes. This is not a declaration that GOV-REC-1, GOV-AUDIT-9, or production release is complete.

- **Repository:** `abvhiael/420-integrated-v0.1`
- **Authoritative main at baseline:** `53e1c45cd050709617cfb5e9ad5d258cb1bedb2e`
- **Audit branch:** `audit/420governance-rec-0-baseline-20261120` (created from the exact main SHA above).
- **Existing qualified reference:** GOV-AUDIT-8 implementation SHA `330388bbd0c819e2ac331f060da856de5bf12e80`. Historical qualified SHA is not current-head qualification.
- **Tracked unresolved defects:** [#1282](https://github.com/abvhiael/420-integrated-v0.1/issues/1282).

## Frozen addresses and authority

| Contract | Address | Role |
| --- | --- | --- |
| GovernanceTimelock | `0x0000000000000000000000000000000000000429` | sole canonical Civic execution/governed-mutation identity |
| ProtocolRegistry | `0x0000000000000000000000000000000000000434` | discovery/publication only; cannot determine ballots or execute proposals |
| Governance420 | `0x0000000000000000000000000000000000000437` | compatibility and one-shot bootstrap only; legacy proposal/vote/result paths retired |

At the baseline SHA all three match `contracts/config/system-addresses.json`, `contracts/config/genesis-address-namespace.json`, and `contracts/config/deployment-manifest.json`. The canonical address manifest separately anchors Registry and Governance420. GovernanceTimelock predeploy state starts with bootstrap governor and scheduler `0x0437`; Governance420 predeploy state binds to Timelock `0x0429`. Civic Constitution, Proposal Registry, Electorate Registry, Voting, Governor, and two source instances remain **Registry-resolved** deployment outputs, not fixed invented addresses.

The constitutional/authority model remains: immutable GovernanceTimelock executes Civic-approved actions and owns governed mutations; a one-way bootstrap handoff retires Governance420; Constitution, Proposal Registry and Electorate Registry share the exact Timelock; Governor and Voting use the committed internal module graph. A proposal uses frozen rules and electorates, with equal-weight community and validator eligibility rather than stake-proportional voting. Registry, Wallet, Indexer, Search, Explorer and Notifications cannot manufacture proposal outcomes or execution authority. Neither Treasury nor Vault is an alternate Civic authority.

## Eight canonical contracts: source, runtime artifacts and ABI inventory

At baseline main, every source Git blob SHA matches the `sourceBlobSha1` recorded in both its runtime artifact and `contracts/config/governance-deployment-v1.json`. Every artifact `runtimeCodeHash` matches that manifest's corresponding `runtimeCodeHash`. Every artifact's contract name and Solidity compiler settings match. ABI counts were inspected from the actual artifact JSON (function/event/error counts shown).

| Contract | Source blob SHA-1 | Artifact JSON blob SHA-1 | ABI entries (functions/events/errors) | Declared runtime hash |
| --- | --- | --- | --- | --- |
| GovernanceTimelock | `823d82240bda175099e1e5d61f713e3332717234` | `0c4b111b7f43ad8f7d639d132963ecdac7107db3` | 22 (16/4/0) | `0xa7e3f9407735669c1ea106fcf0cdc078a2de80c6f87a24537ef98d2aced12285` |
| Governance420 | `886668e8efa97bd32734e32cde11148bcf98e5bd` | `540e52c0e19abf37c69ae8a2997b582cfd21919c` | 40 (28/3/8) | `0xe4e5fcbce3f66e0e53143ee47d7ed9a5fa74437540cd24cf70ea30744e70bf27` |
| CivicConstitution420 | `198c88d8c3bf58e20daf6b9ed73aa89817cb0942` | `ccbfffdac629d4fdc85fd1db463515f5c2ddd771` | 14 (7/1/5) | `0xde4aa983478579bcec69b9524f34ff725fb33012bb7cff1e7dd79af139f07ed7` |
| CivicProposalRegistry420 | `6d42bb3fc0b91f2eebc817d9d5fdb27b687ccf31` | `68242e77cb67932f0312b5cc1d0ff626edf0ab9b` | 21 (8/3/9) | `0xded34b7b9b043601f4288d16b098b99918abacc2d1b97e3f802861d20294a8dd` |
| CivicElectorateRegistry420 | `3113d8cf485cac82e72a5cb564a848d6b67a8d69` | `ab6c5ad70f92e469c368dbeff2665d6a63d99eac` | 25 (10/3/11) | `0xce3bff5e78fbdc9567c866433365445b5983e51395685ad181fdc6c0e063a35f` |
| CivicVoting420 | `68e463fde4e4dff058f18e7435cdcf32cf6e1965` | `a562fb87f2cf70ca920f70ddf672b1218da1ed92` | 19 (8/1/9) | `0xb58b55abf576243062604e9ea3b823cb1f2d6c8c1ebde32a6aaa738efc8d72a0` |
| CivicGovernor420 | `049d35562bbd74980976a7a25772634c40edd50a` | `53949108646a243abfad086045162c8f431afcd6` | 39 (16/4/17) | `0x46ecd1c5fab033778fde23b48c926e06c0e9d12b2256a8f4874d62d41a074611` |
| CivicMerkleElectorateSource420 | `a16febddf53e305fbf54e25889904050eea73a1a` | `1144f2f897dd700bb4691a32b5675c805a9a1733` | 17 (9/1/6) | `0x84c65e5558ee8f797192b8d8edf8d6a17553ed78a7c97b424f9d967a1a44e878` |

Compiler pinned consistently in `contracts/foundry.toml`, deployment manifest and all eight retained artifacts: Solidity **0.8.24**, EVM **cancun**, optimizer enabled, **200 runs**, `viaIR=true`. Foundry config blob SHA-1: `9fa5356e6595a751033cbacd83eef541d3c7d4ff`. `CivicIds420.sol` and `ICivicElectorateSource420.sol` are additional supporting sources; the electorate source deploys twice with separate COMMUNITY/VALIDATOR bindings.

**Scope of verification:** Git object/source provenance, artifact/manifest hash-field identity, compiler/ABI metadata. A successful Foundry rebuild and exact-head tests remain separately required; metadata equality alone is not a cryptographic recompilation.

## Current-head configuration and dependency SHAs

Each value below is the actual Git blob identity read at the exact baseline main SHA; a historical successful test on a different commit must not silently substitute for a current-head result.

| File | Git blob SHA-1 |
| --- | --- |
| `contracts/foundry.toml` | `9fa5356e6595a751033cbacd83eef541d3c7d4ff` |
| `contracts/config/governance-deployment-v1.json` | `8f1b253218e62d61a26f1e13fa74a16a8012b75c` |
| `contracts/config/interfaces/governance-dependency-model.json` | `94b35c9a4100202bcb6fecc8d286e61888003bc9` |
| `contracts/config/interfaces/governance-cross-protocol-integration.json` | `f0d36e4c39c409b1b099601c6ee703a69d9ed0bf` |
| `contracts/config/system-addresses.json` | `50c8d7c860ff48d52f41874bc55ee092cc9c5b6d` |
| `contracts/config/genesis-canonical-addresses.json` | `6ea5ffd37bee347e51e8141bbea000d008a52781` |
| `contracts/config/genesis-address-namespace.json` | `d9c40056db30513c0445f0c341d261b63dc6a1a5` |
| `contracts/config/deployment-manifest.json` | `88a3bcda3a81c28c6ad7d2b9422a99cab41562e3` |
| `contracts/config/predeploy/GovernanceTimelock-predeploy-state.json` | `d4de372d2053589eed61b82b5dd024d03a13b448` |
| `contracts/config/predeploy/Governance420-predeploy-state.json` | `c5ab865ebeb3a4fc97b9c2d3fea6286959ecc860` |
| `contracts/config/predeploy/predeploy-plan.json` | `451e32261395fc1fe11ba71c47b73f778b810c7e` |
| `contracts/config/predeploy/storage-init.json` | `86f2b3ac8a4c305df2595029e1abb494808c3c4e` |
| `contracts/src/apps/ProtocolRegistry.sol` | `9ab3d53a68b6533978f41e0202e5268f1d615c19` |
| `contracts/config/420registry-genesis.json` | `f9668b23a243fd2dbe2351a41e39de2072ac2649` |
| `contracts/config/420treasury-genesis.json` | `d09041578c5b53684e161ab214e06e72dbd95300` |
| `contracts/src/treasury/TreasuryAuthorization420.sol` | `68e6112f6134b39c55c929ade49afcf2fc30e65e` |
| `contracts/src/treasury/TreasuryBudgetRegistry420.sol` | `de622a2f38dcb07960cdca42714171653213f0ea` |
| `contracts/src/treasury/TreasuryDisbursementRegistry420.sol` | `bb3012601fdb86106ccee79bf0b726b6154775e6` |
| `contracts/src/treasury/TreasuryReleaseExecutor420.sol` | `011d07f4ccafaa2099d92441a3a9858468384eb3` |
| `contracts/src/treasury/TreasuryRouter420.sol` | `55dd5dba2cab87749d504fee0c5f6a364919ac26` |
| `contracts/src/vault/VaultAuthorization420.sol` | `51c0351202053e6116f6e7bd33242930fa0717d4` |
| `contracts/src/vault/VaultPolicyRegistry420.sol` | `b3316826fbd09fcf1da37dc4c845e02ecdf4ad4d` |
| `contracts/src/vault/VaultRouter420.sol` | `a4603ea5effc49ad182ff0b3b8584b76729ee747` |
| `contracts/src/governance/CivicIds420.sol` | `c1007e4fdf0ec587660f645e2eefcd9c20edb263` |
| `contracts/src/governance/ICivicElectorateSource420.sol` | `e6676f965abab77fd5e8a4624b2cd96da25f1bb2` |

**Dependency interpretation:** GovernanceTimelock is the only Civic mutation/execution identity. Treasury budget authorization and action commitments derive from Civic proposals, but Treasury disbursement execution remains capability-scoped; Treasury does not vote. Vault policy is governable, but Vault custody, routing and release are independently capability-constrained. ProtocolRegistry stores identity/discovery metadata only. Wallet and Indexer are non-authoritative consumers. Source and Genesis configuration SHAs above reflect changes since the October Governance qualification; previous qualification runs cannot prove the changed integrated head.

## GOV-AUDIT-1 through GOV-AUDIT-8 — retained qualification identities

| Historic step | Evidence file Git blob SHA-1 at baseline main |
| --- | --- |
| GOV-AUDIT-1 | `ee643751807cedbba392aef052a8399270017b74` |
| GOV-AUDIT-2 | `241a49a042bc89ea259707422be13ae56be53580` |
| GOV-AUDIT-3 | `b8c923fc414937524b01273b67222aed52ffbe61` |
| GOV-AUDIT-4 | `8aecc2cfd07e6b8d56bc3b08c7beaa6dbbbaa97f` |
| GOV-AUDIT-5 | `a87b7b1338704fd0bd30266427532496321744cc` |
| GOV-AUDIT-6 | `0c2bbb34176832bfcd5a6b3a9e419a9f3f873c41` |
| GOV-AUDIT-7 | `6cf6d279e3a27bc65ca2849117b2eff77d5f54ec` |
| GOV-AUDIT-8 | `746cfd692ca27626fccaf932c9d9b108a34b2679` |

These files are located at `docs/audit/GOV-AUDIT-N-QUALIFICATION.md`. The retained GOV-AUDIT-8 report ties original comprehensive qualification to implementation SHA `330388bbd0c819e2ac331f060da856de5bf12e80`, PR #449 and historic successful runs: Governance `36956142193`, cross-protocol `36956142312`, Wallet `36956142260`, Genesis `36956150066`, Indexer `36956150046`, Solidity Contracts `36956150006`. They are **historical evidence**, not new current-head passing results.

Governance-related branches inspected: `audit/420governance-complete-20261001`, `governance-level3-closeout-20261001`, `governance/genesis-decision-2-cross-app-catalog-20261018`, and separate Treasury/High Country governance branches. A scoped search found no open `GOV-AUDIT` PR targeting canonical Civic core; other applications' governance work does not replace canonical Civic authority.

## Pre-existing findings and cross-phase boundary

1. **Critical, GOV-REC-1:** `Governance420.scheduleCanonicalCivicBootstrap()` is a first-caller, one-shot plan using caller-supplied Civic graph addresses. Current checks do not independently authenticate the exact approved Genesis component addresses/runtime identities before accepting the first bootstrap schedule.
2. **Critical, GOV-REC-2:** the bootstrap schedules source registration but not the first checkpoint publication. `CivicMerkleElectorateSource420.publishCheckpoint()` requires Timelock authorization; proposals require a usable electorate snapshot. The first-proposal cold-start must be fixed before the irreversible authority handoff.
3. **Medium, GOV-REC-3:** Constitution permits `votingPeriodBlocks=1`; Governor constructs an inclusive one-block window; Proposal Registry rejects `voteEnd <= voteStart`. Those accepted rules cannot currently register a one-block proposal.

These are **existing source-level defects**, not claims of presently failing tests, and are tracked in GitHub issue #1282. Baseline capture is not authorization to change frozen constitutional policy, addresses or execution authority.

## Reproduction and acceptance

The existing `.github/workflows/governance-audit.yml` executes on a push to `audit/420governance-*` affecting `docs/audit/420GOVERNANCE-*`, and checks its exact commit SHA. Its focused checks include Governance verifiers (GOV-AUDIT-1/2/3/6/7/8), Genesis authority/collision verifiers, Foundry formatting/build and retained artifact drift check, deterministic deployment simulation, cross-protocol integration, Civic/Governance regressions, forbidden primitive scan, and Governance Indexer build/tests. This new audit-only document deliberately triggers that existing workflow; no test assertions have been weakened or disabled.

**Qualification rule:** GOV-REC-0 is not fully signed off until the current audit commit obtains a **successful** Governance workflow run, including relevant jobs; historical/skipped/cancelled/in-progress checks do not qualify the new head. Record actual run ID and logs independently after verification rather than inventing results or making an evidence-only commit recursively invalidate its own test SHA.

**Next canonical step after GOV-REC-0 qualification:** GOV-REC-1 — Canonical Bootstrap Authorization and Protection. Do not begin GOV-REC-1 as part of this baseline step.
