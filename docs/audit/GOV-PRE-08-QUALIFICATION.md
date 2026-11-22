# GOV-PRE-08 — Exact-source local Genesis qualification (partial; live V4 NO-GO)

**Scope:** founder/Treasury/sponsorship/compensation/retirement integration, funding allocation, V4 Genesis proposal, seven dependent consumers and cold-start/recovery. **This is not a completed GOV-PRE-08 release or a replacement of the signed Genesis authority.**

## Source and actual runs

- Authoritative repository: \`abvhiael/420-integrated-v0.1\`.
- Main baseline before work: \`462983be36157799b764f4040cdafec658c91e3a\` (merged GOV-PRE-07).
- **Qualified implementation source head:** \`a474a37bc3da03a52cc7b9011ec8e75abb05678b\`. Subsequent evidence-only commits do not alter these compiled/verified sources.
- Draft PR: [#1335](https://github.com/abvhiael/420-integrated-v0.1/pull/1335). **Unmerged by design.**
- Focused [GitHub Actions #45051459377](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45051459377): **SUCCESS** at exact above source HEAD; job \`137297276477\`.
- Retained Actions artifact \`gov-pre-08-unsigned-v4-a474a37bc3da03a52cc7b9011ec8e75abb05678b\`, artifact ID \`14765194731\`, 11,628 bytes. Contains source head, unsigned V4 artifact/ABI/storage identity manifest, two independent generated synthetic 42m funding inputs and provenance, Anvil RPC balance proof, and two independently materialized vesting constructor/runtime/storage records and logs. **No live chain receipts.**

The scoped job ran **18/18 adversarial/source-policy tests** plus **8/8 local Genesis-funding tests**; actual 42m supply and three-founder funds conserved; 14 actual Foundry Solidity source paths compiled with Solidity 0.8.24, Cancun/via-IR/optimizer 200 and \`storageLayout\` extra output. The source generator verified all fourteen ABI, creation/runtime-template and storage-layout digests with source Git blob identity. Relevant source-level Wallet/Registry/Indexer/Stake/Treasury/Explorer/Governance authority boundaries checked with no new canonical power. Existing GOV-PRE-07/Stake/founder contract regression evidence is preserved, not replaced with new passing claims.

## Source authority and approval boundary

Historical **FROZEN_V3** remains intact at \`contracts/config/genesis-config-commitment.json\` with source hash \`0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d\`. The working ledger/authority inputs have genuinely changed, so that V3 commitment **does not validate this new Genesis**; prior Token/Swap V3 drift failures remain meaningful. A deterministic **UNSIGNED V4 SOURCE CANDIDATE** is retained at \`contracts/config/candidates/genesis-config-commitment-v4-unsigned.json\` with proposed Keccak-256 source commitment \`0x4ff311153ce242a487cadd745b53c98172d73f1c188aad1176e9d99566f878f5\`. Eight named authority files and their exact Git blob identities are bound. Tests reject changed input hashes, forged approval flags and replay as an authorized release. **This candidate has no independent approval, no real founder signatures and no live runtime attestation**; do not overwrite the current frozen signed commitment with it.

## Verified synthetic local execution

\`scripts/gov-pre-08/materialize-local-funding.py\` uses an explicitly unowned three-founder fixture at **local chain ID 31337 only**, never real beneficiary addresses, and produces reproducible 42m genesis allocations. Unlike the legacy V3 fixture (1m at 0x0427), the local V4-shaped distribution has exactly **500,000 at the 0x0427 vesting predeploy** and **250,000/125,000/125,000** on three clearly synthetic separate wallets; ProtocolReserve remains 8.6m at 0x0424, with *non-additive* 4.2m Operations/840k Contingency earmarks, 3.56m unearmarked. CommunityValidatorReserve/CommunityRewardReserve remain at frozen 0x0425/0x0426. All eleven Genesis balances were read back from real Anvil \`eth_getBalance\`, not only a JSON sum; no founding Ops or Contingency Vault is falsely marked transferred.

\`scripts/gov-pre-08/materialize-local-vesting.py\` deployed the **real** \`FounderVestingRegistry\` constructor on a separate earlier-time disposable Anvil chain, captured actual compiler-bound runtime and storage, and used **Anvil-only** state-setup APIs to materialize that actual runtime/slot state at the already-funded synthetic 0x0427. Readbacks established immutable 0x0429 Timelock, 3 distinct beneficiaries, the synthetic Genesis start time, zero claimed amounts, 13 fortnightly releases, 50/25/25 allocations, and rejection of premature founder claims. A **second pair of independent fresh Anvil chains reproduced exactly the code hash, constructor address, ABI/layout digest, all materialized storage slots, all three recipients and 500k funding** in the same workflow. This is a legitimate local constructor/predeploy rehearsal, **not** a transaction authorized by a founder, a real Geth block-zero deployment, a live signature or a completed new V4 Genesis.

## Current GOV-PRE-08 acceptance: not met

The task is **not eligible for full qualification, roadmap closeout, or merge** because the following genuine release inputs/evidence are absent:

1. Real verified claimable founder wallet addresses and three independent EIP-191/EIP-1271 owner signatures, and independent approval of the exact chain-specific V4 Genesis commitment. The current file has null founder addresses; no key material or ownership may be invented.
2. Final source-bound V4 Geth/consensus predeploy runtime/constructor storage for the real signed founder addresses and timestamp, plus complete deployment and Registry publication of the remaining founder, Treasury, sponsorship, compensation and retirement modules using their approved permissions and contract identities.
3. Actual funded/registered Operations, Contingency and Community Vault IDs, authorized ProtocolReserve-to-Vault funding and route-specific grants, independently reconciled balance/asset inventory and finalized native/ERC20 transfer receipts.
4. Production-equivalent Wallet, Registry, Indexer, Stake, Treasury, Explorer and Governance on-chain discovery, reconstruction, signed approval and recovery verification, rather than the successful *source-level* compatibility checks only.

No synthetic address, local \`anvil_setCode\`, mock authority, proposed Keccak hash or passed source test is evidence of these conditions. **Original frozen V3 and all previous qualified evidence remain untouched.** The canonical roadmap is intentionally not marked complete; **GOV-AUDIT-9** is the next existing stage and was not started.

## Source files changed under this PR

- \`scripts/gov-pre-08/plan.py\`, \`test_plan.py\`, \`materialize-local-funding.py\`, \`test_funding.py\`, \`materialize-local-vesting.py\`.
- \`contracts/config/candidates/genesis-config-commitment-v4-unsigned.json\`; \`contracts/test/fixtures/gov-pre-08-local-wallets.json\`.
- \`.github/workflows/governance-pre-08-genesis.yml\`.
- \`docs/apps/governance/cold-start.md\`; \`docs/apps/governance/troubleshooting.md\`.
