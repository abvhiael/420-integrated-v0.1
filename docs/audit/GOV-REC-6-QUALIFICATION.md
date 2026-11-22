# GOV-REC-6 — pre-testnet software qualification evidence

## Disposition

**Implementation and focused repository qualification performed; final GOV-REC-6 Level 3 closeout NOT YET QUALIFIED. Do not merge.** This record is a conservative evidence ledger, not a declaration of `PRE_TESTNET_SOFTWARE_QUALIFIED` or approval of a live Genesis.

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `audit/420governance-rec-6-pretestnet-20261121`
- [PR #1299](https://github.com/abvhiael/420-integrated-v0.1/pull/1299) — draft, unmerged
- Base main at start: `b3ff6bc3a00bab5d057318a039a2abd5a6eab7f0` (GOV-REC-3/4/5 already merged)
- Later main change: `9acf65c95e74e6418de9a774d810342ab24e6098` (BongGoggles-only, no overlapping Governance file)
- Independently verified candidate prior to shard-harness fix: `33a888c2d48c2633ec96ec601d818e595b3e5f36`.
- Initial protected-guard correction: `1f5e210f684d629acb469a5be374398aab5293a9`; shared Foundry script now resolves retained audited CADC import sources without excluding primary Solidity units.
- Read-only verifier `scripts/verify-governance-rec-6.py`, negative tests `scripts/test-governance-rec-6.py`, runbook `docs/apps/governance/cold-start.md`, threat/security/operator/troubleshooting reconciliation, canonical Governance CI bindings and focused workflow `.github/workflows/governance-rec-6.yml` are committed on this branch.

## Reproduced and verified on executable predecessor

All four required GOV-REC-6-specific jobs succeeded at **`6512552e0c312f436e58dc5bbdf7ca38feb26591`**:

| Job | Run | Job ID | Result |
| --- | --- | --- | --- |
| Clean pinned rebuild, independent artifact/ABI/storage and canonical Genesis verification, 19-operation cold-start + 118 Governance Foundry regressions | [#44934202911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934202911) | `136937244645` | **SUCCESS**; 118 passed, 0 failed, 0 skipped, 14 suites, stateful invariant 128 runs / 8192 calls / 0 reverts |
| Wallet/Indexer | [#44934202911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934202911) | `136937245055` | **SUCCESS**; retained Wallet test inventory and Indexer event reconstruction |
| Treasury/Vault and Governance integration | [#44934202911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934202911) | `136937244861` | **SUCCESS** |
| Documentation repository qualification | [#44934202911](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934202911) | `136937244935` | **SUCCESS** |

On subsequent **`33a888c2d48c2633ec96ec601d818e595b3e5f36`**, all four GOV-REC-6 jobs also returned **SUCCESS** in [run #44934392169](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934392169), jobs `136937821969`, `136937822177`, `136937822357`, `136937822443`. Separate [Genesis Address Authority #44934392205](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934392205), [GOV-AUDIT-6 #44934392204](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934392204), and [GOV-AUDIT-7 #44934392324](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934392324) succeeded at that head.

No canonical Governance Solidity, constitutional rule, initial electorate decision, runtime bytecode artifact, immutable layout, ABI, Registry component ID, fixed predeploy address or Genesis artifact was modified. A clean Solidity 0.8.24/Cancun/optimizer-200/via-IR rebuild and retained artifact generator `--check` **passed without drift**; independent verifier checked eight runtime identities, actual predeploy storage words and all five fail-closed materialization fields.

## Exact-head gating failures and remediation

### Repository-wide Solidity Level 3

[Solidity Contracts #44934392298](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934392298) **FAILED** at `33a888c2...`: the canonical full-inventory test shards encountered unresolved imports such as `@openzeppelin/contracts/utils/introspection/IERC165.sol`, `@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol` and `solidity-bytes-utils/contracts/BytesLib.sol`. These are **real retained, audited source files** under `contracts/test/fixtures/cadc/upstream/`. The full Foundry shard harness lacked canonical remappings.

The remedy is committed in `contracts/scripts/qualify-foundry-shard.sh`: it explicitly requires the three representative retained source paths, appends newline-delimited Foundry remappings to the existing configuration, and preserves the full primary `src/test/script` inventory and every assertion. No package downloads, skipped test paths, synthetic approvals or weaker coverage thresholds were introduced. Its syntax/pinned-path preflight is included in the GOV-REC-6 workflow. **A later complete Level 3 success has not been established by this ledger.**

### Protected workflow trigger policy

An intermediate candidate incorrectly enabled implicit PR triggers in protected `Solidity Contracts`, `Genesis Address Authority` and `420 Integrated Qualification` workflows. [CI-GUARD-02 run #44934683426](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44934683426) correctly **FAILED** at the intermediate SHA. The branch now restores those central workflows from main **byte-for-byte**, preserving manual-only `workflow_dispatch` and original job inventories. The user-mandated protected Level 3 full suite must be dispatched through an **authorized workflow dispatcher**; the currently available GitHub connector has no workflow-dispatch operation. Skipped or pending tests are **not** PASS. Do not bypass CI-GUARD-02 merely to get green badges.

### Authentic Genesis source approval

The committed `genesisBootstrapCommitment` contains approvedPlanHash and both Community/Validator roots and totals set to zero. The corresponding five storage slots in `Governance420@0x0437` are zero. Neither an authenticated real initial electorate roster nor an authorized final chain-specific seven-address graph and approved plan hash is available. Synthetic GOV-REC-2 fixtures are test-only; an operator cannot create, replace or authorize Genesis data from them. Both strict `--require-activation-ready` verifiers **must reject** this release state. This is an externally authorized Genesis-input boundary, not an unresolved test failure or reason to invent permission.

## Merge and subsequent stage

**PR #1299 remains unmerged.** The software closeout status `PRE_TESTNET_SOFTWARE_QUALIFIED` is **NOT ASSERTED** until all required exact-head checks, including protected full Level 3, pass and security findings are closed. Do not change the canonical roadmap to COMPLETE yet. After GOV-REC-6 actually qualifies, the next canonical step is GOV-AUDIT-9 (production-equivalent live testnet deployment qualification); it has not been started here.

## Subsequent branch corrections (2026-11-21)

- The first shard-harness remapping insertion in `1f5e210f684d629acb469a5be374398aab5293a9` was malformed by a shell quoting/insertion error. The dedicated cold-start job [#44935089728](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44935089728), job `136939867534`, **FAILED** during the newly added `bash -n` preflight. This was not a Solidity contract failure.
- The shared shard script was rebuilt from the unmodified original inventory and compilation loop. **Correction commit `d57c744c18f5df8ae11ed0dbcc6c1726221a07f6`** retains the exact three audited dependency remappings, preserves caller-supplied remappings, and repairs the shell syntax. The isolated replacement fragment passed local `bash -n`; the complete committed script's new exact-head preflight and subsequent CI are being checked under [GOV-REC-6 run #44935259871](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44935259871). Do **not** treat a pending or skipped job as passing.
- The two original protected-workflow defects have **not** been concealed. The branch restores their manual-only files byte-for-byte. The dedicated focused qualification is not a replacement for the protected full Level 3 dispatch.
- After the correction, new Governance Solidity, ABI, bytecode, Genesis materialization and constitutional source changes remain **zero**. The live approved Genesis commitment is still absent and the strict release activation gate must fail closed.
