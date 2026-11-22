# GOV-PRE-08 — Exact-source local Genesis qualification (partial; live V4 NO-GO)

**Scope:** founder/Treasury/sponsorship/compensation/retirement integration, funding allocation, V4 Genesis proposal, seven dependent consumers and cold-start/recovery. **This is not a completed GOV-PRE-08 release or a replacement of the signed Genesis authority.**

## Source and actual runs

- Authoritative repository: `abvhiael/420-integrated-v0.1`.
- Main baseline before work: `462983be36157799b764f4040cdafec658c91e3a` (merged GOV-PRE-07).
- **Qualified implementation source head:** `a474a37bc3da03a52cc7b9011ec8e75abb05678b`. Subsequent evidence-only commits do not alter these compiled/verified sources.
- Draft PR: [#1335](https://github.com/abvhiael/420-integrated-v0.1/pull/1335). **Unmerged by design.**
- Focused [GitHub Actions #45051459377](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45051459377): **SUCCESS** at exact above source HEAD; job `137297276477`.
- Retained Actions artifact `gov-pre-08-unsigned-v4-a474a37bc3da03a52cc7b9011ec8e75abb05678b`, artifact ID `14765194731`, 11,628 bytes. Contains source head, unsigned V4 artifact/ABI/storage identity manifest, two independent generated synthetic 42m funding inputs and provenance, Anvil RPC balance proof, and two independently materialized vesting constructor/runtime/storage records and logs. **No live chain receipts.**

The scoped job ran **18/18 adversarial/source-policy tests** plus **8/8 local Genesis-funding tests**; actual 42m supply and three-founder funds conserved; 14 actual Foundry Solidity source paths compiled with Solidity 0.8.24, Cancun/via-IR/optimizer 200 and `storageLayout` extra output. The source generator verified all fourteen ABI, creation/runtime-template and storage-layout digests with source Git blob identity. Relevant source-level Wallet/Registry/Indexer/Stake/Treasury/Explorer/Governance authority boundaries checked with no new canonical power. Existing GOV-PRE-07/Stake/founder contract regression evidence is preserved, not replaced with new passing claims.

## Source authority and approval boundary

Historical **FROZEN_V3** remains intact at `contracts/config/genesis-config-commitment.json` with source hash `0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d`. The working ledger/authority inputs have genuinely changed, so that V3 commitment **does not validate this new Genesis**; prior Token/Swap V3 drift failures remain meaningful. A deterministic **UNSIGNED V4 SOURCE CANDIDATE** is retained at `contracts/config/candidates/genesis-config-commitment-v4-unsigned.json` with proposed Keccak-256 source commitment `0x4ff311153ce242a487cadd745b53c98172d73f1c188aad1176e9d99566f878f5`. Eight named authority files and their exact Git blob identities are bound. Tests reject changed input hashes, forged approval flags and replay as an authorized release. **This candidate has no independent approval, no real founder signatures and no live runtime attestation**; do not overwrite the current frozen signed commitment with it.

## Verified synthetic local execution

`scripts/gov-pre-08/materialize-local-funding.py` uses an explicitly unowned three-founder fixture at **local chain ID 31337 only**, never real beneficiary addresses, and produces reproducible 42m genesis allocations. Unlike the legacy V3 fixture (1m at 0x0427), the local V4-shaped distribution has exactly **500,000 at the 0x0427 vesting predeploy** and **250,000/125,000/125,000** on three clearly synthetic separate wallets; ProtocolReserve remains 8.6m at 0x0424, with *non-additive* 4.2m Operations/840k Contingency earmarks, 3.56m unearmarked. CommunityValidatorReserve/CommunityRewardReserve remain at frozen 0x0425/0x0426. All eleven Genesis balances were read back from real Anvil `eth_getBalance`, not only a JSON sum; no founding Ops or Contingency Vault is falsely marked transferred.

`scripts/gov-pre-08/materialize-local-vesting.py` deployed the **real** `FounderVestingRegistry` constructor on a separate earlier-time disposable Anvil chain, captured actual compiler-bound runtime and storage, and used **Anvil-only** state-setup APIs to materialize that actual runtime/slot state at the already-funded synthetic 0x0427. Readbacks established immutable 0x0429 Timelock, 3 distinct beneficiaries, the synthetic Genesis start time, zero claimed amounts, 13 fortnightly releases, 50/25/25 allocations, and rejection of premature founder claims. A **second pair of independent fresh Anvil chains reproduced exactly the code hash, constructor address, ABI/layout digest, all materialized storage slots, all three recipients and 500k funding** in the same workflow. This is a legitimate local constructor/predeploy rehearsal, **not** a transaction authorized by a founder, a real Geth block-zero deployment, a live signature or a completed new V4 Genesis.

## GOV-PRE-08 pre-testnet Step 1 — complete local contract deployment qualified

**Step 1 locally complete; full GOV-PRE-08 remains OPEN.** This step was added on [draft PR #1335](https://github.com/abvhiael/420-integrated-v0.1/pull/1335) without modifying any of the frozen V3 release inputs, real founder identities, policy constants or prior passing evidence. The **exact qualified executable source and CI workflow HEAD** is `32729091d09cf055f05a242259e961b216a87c19`. The scoped [workflow #45062812203](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45062812203), job `137332282391`, completed **SUCCESS**; artifact `gov-pre-08-unsigned-v4-32729091d09cf055f05a242259e961b216a87c19` (ID `14770431526`, 15,860 bytes) contains exact-head and source import closure fingerprints, both actual Foundry deployment logs, matched graph hash, Genesis/vesting rehearsals and the existing source candidate. Earlier workflow [#45062589098](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45062589098) had **all eight actual Foundry test executions PASS** but failed on the log extraction parser; the final passing SHA corrects solely that parser.

**New committed executable file:** `contracts/test/GOVPRE08LocalDeployment420.t.sol`; **amended CI:** `.github/workflows/governance-pre-08-genesis.yml`.

The test's genuine Solidity 0.8.24/Cancun/via-IR import closure compiled **53 source files** (not unrelated vendored LayerZero test fixtures). On each independent fresh Foundry EVM it executed the real constructors for these **fourteen unmodified production contracts**:

1. `FoundingWalletClaims420`, `FoundingCommitteeMembership420`, `FoundingRetirementVerifier420`;
2. `FoundingTreasuryAuthority420`, `FoundingValidatorSponsorship420`, `FoundingCommunityRetirementSweep420`;
3. `FoundingDeveloperCompensationSplitter420`, `DevelopmentCompensationVault420`;
4. `TreasuryAuthorization420`, `TreasuryPolicyRegistry420`, `TreasuryBudgetRegistry420`, `TreasuryDisbursementRegistry420`, `TreasuryRouter420`, `TreasuryReleaseExecutor420`.

Real dependency contracts were also constructed: full Civic Governor/Proposal/Electorate/Voting/Constitution graph, `CapabilityRegistry420`, Vault authorization/policy/registry/accounting/router, and three registered `AssetVault420` instances (Operations, Contingency, Community). The local runtime from real constructors was placed at **existing frozen predeploy identities only**, Timelock `0x0429`, ProtocolRegistry `0x0434`, ValidatorRegistry `0x0423`, and CommunityValidatorReserve `0x0425`, with the Timelock scheduler constructor state locally materialized; no additional permanent address was reserved. Real Treasury/budget/disbursement one-shot handshakes, GovernanceTimelock controller, release executor hash/operator, retirement committee, ValidatorReserve/ValidatorRegistry/sponsor, and compensation Vault/splitter beneficiary handshakes all passed actual EVM readback. The three *synthetic* founders claimed *only on the disposable local fixture*, allowing actual bounded founding Treasury native policy and real 4.2m/840k budget-ceiling initialization.

All fourteen were registered through **the real ProtocolRegistry contract's codehash-verifying component registration**, using explicitly local-only `GOV-PRE-08/LOCAL-ONLY/COMPONENT` IDs rather than inventing unapproved production component IDs. The established canonical **Treasury, Vault and Development Compensation service IDs** were published with real deployed runtime hashes, registration profiles and resolution readbacks via authentic Timelock-only call-context simulation. These are local service registrations, not signed or network-finalized governance execution.

**Tests and reproducibility:** `4 passed / 0 failed / 0 skipped` in each of **two independent** Foundry EVM runs, for **8/8 actual test executions**, and the isolated exact-source graph digest matched in both:

`0xc337ffd4adc5d87f314979917db1b7c1eb5537e08c0bd0eee9dc9e1691c35dd4`

The tests require all fourteen deployed code addresses, exact component resolution/codehash, one-shot founder/Treasury/Vault/sponsor/splitter bindings, canonical service resolution, valid founder-split constants and budget ceilings, absence of unsolicited capability grants, failed pre-retirement sweep, and rejection of unauthorized re-binding or Registry publication.

**Scope boundary:** This qualifies Step 1's **local EVM deployment graph**, not an Anvil multi-process launch, live governance vote, owner-signed founder claims, approved canonical V4 component ID catalogue, paid vault balances, approved V4 Genesis, or any public testnet deployment. Local pseudo-Timelock calls and the synthetic founders are explicitly fixture operations; cannot be released. Actual Vault funding and authorized payment/settlement belongs to **pre-testnet Step 2** and remains OPEN.

## Current GOV-PRE-08 acceptance: not met

The task is **not eligible for full qualification, roadmap closeout, or merge** because the following genuine release inputs/evidence are absent:

1. Real verified claimable founder wallet addresses and three independent EIP-191/EIP-1271 owner signatures, and independent approval of the exact chain-specific V4 Genesis commitment. The current file has null founder addresses; no key material or ownership may be invented.
2. Final source-bound V4 Geth/consensus predeploy runtime/constructor storage for the real signed founder addresses and timestamp, plus complete deployment and Registry publication of the remaining founder, Treasury, sponsorship, compensation and retirement modules using their approved permissions and contract identities.
3. Actual funded/registered Operations, Contingency and Community Vault IDs, authorized ProtocolReserve-to-Vault funding and route-specific grants, independently reconciled balance/asset inventory and finalized native/ERC20 transfer receipts.
4. Production-equivalent Wallet, Registry, Indexer, Stake, Treasury, Explorer and Governance on-chain discovery, reconstruction, signed approval and recovery verification, rather than the successful *source-level* compatibility checks only.

No synthetic address, local `anvil_setCode`, mock authority, proposed Keccak hash or passed source test is evidence of these conditions. **Original frozen V3 and all previous qualified evidence remain untouched.** The canonical roadmap is intentionally not marked complete; **GOV-AUDIT-9** is the next existing stage and was not started.

## Source files changed under this PR

- `scripts/gov-pre-08/plan.py`, `test_plan.py`, `materialize-local-funding.py`, `test_funding.py`, `materialize-local-vesting.py`.
- `contracts/config/candidates/genesis-config-commitment-v4-unsigned.json`; `contracts/test/fixtures/gov-pre-08-local-wallets.json`.
- `.github/workflows/governance-pre-08-genesis.yml`, including local deployment graph replay and exact-source Solidity import closure.
- `contracts/test/GOVPRE08LocalDeployment420.t.sol` (four new deployment, binding, Registry, and fail-closed tests).
- `docs/audit/420GOVERNANCE-AUDIT-REMEDIATION-ROADMAP.md`, `docs/audit/420GOVERNANCE-TESTNET-WORK-ROADMAP.md`, `docs/STEP-5-TESTNET-LAUNCH.md` (pre-testnet/deferred-only scope boundaries).
- `docs/apps/governance/cold-start.md`; `docs/apps/governance/troubleshooting.md`.
