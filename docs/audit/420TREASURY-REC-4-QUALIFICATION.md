# TREASURY-REC-4 — Vault release evidence and executor qualification

Status: **COMPLETE — targeted local executable qualification passed**.

- Exact qualified implementation SHA: `6c627ce4ebb1bb9dcb384a388124687bc50a077e`.
- Main baseline: `fe737a05df9404e0a2ada17f6544d1ecf12220c4`.
- [PR #1226](https://github.com/abvhiael/420-integrated-v0.1/pull/1226).
- [Workflow 44580443875](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44580443875), job `135759328597`, completed successfully.
- Original attempt [44580231204](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44580231204), job `135758576027`, compiled Solidity successfully but stopped at npm ci due to unrelated missing pg dependencies in the pre-existing Indexer lockfile. The corrected candidate isolates the exact integrity-pinned ethers 6.17.0 dependency closure; no Indexer package or code changes.

## Executor and authority reconciliation

Pinned source/search review found the retained HighCountry organization gateway forwarding a caller-supplied nonzero release commitment, but no general production-designated Treasury-to-Vault release orchestrator. It remains an application-specific adapter, not independent receipt verification. REC-4 adds `TreasuryReleaseExecutor420` as the general production-designated candidate, with immutable trusted ProtocolRegistry and reviewed operator, both independent capability scopes, and no custody, arbitrary transfer authority, new service ID or frozen predeploy. Its manifest is `contracts/config/treasury/treasury-release-executor.json`; no production addresses, grants or deployment are claimed.

The executor loads the real Treasury/Vault graph through the REC-3 release binding helper, commits the exact canonical release tuple and deterministic per-disbursement Vault operation, requires reviewed commitment equality, checks both independent capabilities, performs the actual Vault withdrawal, validates the exact recorded accounting delta and consumed operation, rechecks service and Vault bindings, and calls unchanged `markExecuted` in one atomic transaction. Any subsequent failure reverts the asset transfer, release marker, accounting and callback changes. The existing Treasury/Vault/Grants and Indexer source blobs are unchanged.

The domain remains `420/TREASURY/VAULT_RELEASE_COMMITMENT/V1` and the adopted `AUTHORIZED_EXECUTOR_COMMITMENT_ONLY` model is unchanged. The transaction hash cannot be known inside that transaction. The post-inclusion read-only utility correlates reviewed tuple, historical state and deployment identity, actual transaction/block identity and ordered Vault, accounting, Treasury and executor logs. It is not a consensus proof, finality authority or automatic financial retry. See [operator procedure](../apps/treasury/release-executor.md).

## Exact-head local results

Solidity 0.8.24 compilation and existing AUDIT-6 release and AUDIT-7 documentation verifiers passed. Node test runner: **9 passed, 0 failed, 0 cancelled, 0 skipped** (one parent suite and eight executable scenarios on an actual local Anvil chain):

| Scenario | Result |
| --- | --- |
| Native exact transfer, commitment, receipt linkage, interrupted-result recovery, replay | PASS |
| Six-decimal token transfer and exact receipt | PASS |
| Unauthorized operator, absent independent grants, false/unrelated review commitment | PASS |
| Failed Vault release, underfunded preflight and unchanged state | PASS |
| Treasury capability rejection after real withdrawal; transfer/revocation/operation rollback and retry | PASS |
| Actual budget accounting rejection after withdrawal, injected using compiled storage layout; rollback and retry after restoration | PASS |
| Historic split release detected; neither repeated nor automatically settled; stable operation across executor rotation | PASS |
| False/unrelated/mismatched/duplicate/removed or orphaned receipt evidence rejected; direct authorized registry caller can still submit arbitrary nonzero commitment | PASS |

The failure injection modifies only the local test chain's budget committed storage field using the actual compiler layout; asserts the real BudgetExceeded selector and restores the field before retry. Test fixtures are limited to token and recipient contracts and the controlled local fault. All primary contracts are real implementations. Actual receipt/transaction hashes were checked by the tests; no public-chain receipt or finality is claimed.

- Executor artifact SHA-256: `e72fad2d970bba17bab5023d06566455a4e1e4b6d082a5c98d0132e354ff40d8`.
- Executor compiled runtime template SHA-256: `a9e951b9f465218ec29054941a3925a199d171b5cd2ad569df578ad74b676ff7`.

These are compiled identities, not deployed runtime identities. Prior Solidity/fuzz evidence is preserved, not represented as a new run. The automatically triggered Town qualification 44580443585 passed. Automatically triggered Grants qualification 44580443708 passed its documentation, configuration, build and artifact checks, but its two broad Foundry jobs (135759327815, 135759328298) failed at compiler discovery of unrelated Bridge fixture imports (@openzeppelin and @layerzerolabs). No Grants test assertion failed; Grants source is unchanged and its 17/17 REC-3 lifecycle qualification is retained. Do not treat this incidental broad Grants run as passing or rerun unrelated suites within REC-4. The auto-triggered Indexer run 44580443663 was still active at evidence capture; Indexer source is unchanged and REC-7 owns its new local read-boundary qualification.

## Recovery and residual risk

Atomic execution eliminates the persistent release/settlement gap for the candidate, and recovery searches canonical logs within an explicit range and validates the actual receipt. No matching log is not proof that an earlier or pending transaction is absent. For a pre-existing split withdrawal that consumed the canonical operation, the executor fail-closes and the utility reports manual reconciliation; legacy withdrawals with unrelated operation IDs cannot be inferred, and their original receipts must be independently reconciled before migration. No bypass, automatic re-release, rewrite or clawback is introduced. The approved residual trust assumption remains: a separately authorized direct caller may submit arbitrary nonzero evidence, and a spoofed custody identity or compromised operator/authority must not be approved. Grants PAID and derived EXECUTED are Treasury completion evidence, not independent payment proof.

REC-8 owns deployment materialization; AUDIT-8 owns actual public-chain identities, governed grants/activation, live receipt and finality/reorg/provider correlation and funded operational drills. No local REC-4 implementation deficiency is reclassified as testnet work.

Next: **TREASURY-REC-5 — Governance and Capability Authorization Qualification**.
