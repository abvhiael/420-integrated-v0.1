# STAKE-AUDIT-9.2 — authoritative recovery qualification record

Status: **OPEN — production consensus recovery is not qualified; do not merge as complete.**

Repository: `abvhiael/420-integrated-v0.1`. Existing PR: [1189](https://github.com/abvhiael/420-integrated-v0.1/pull/1189). Continuation baseline candidate: `6185ea0eacacd336556aa15ee7de98ec3f16e3e7`; main observed: `263dad07462cae1fef5c474d4c4c1a7dc731dfd3`. No competing branch was created. STAKE-AUDIT-9.1 is not closed and 9.3 has not begun.

## Preserved CI evidence

The following completed results were retrieved from GitHub for the baseline candidate. These are historical results, not evidence for subsequent material changes.

| Workflow | Run | Result |
|---|---|---|
| STAKE-AUDIT-9.2 recovery | [44114633945](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114633945) | PASS; packages and authenticated RPC fixtures only |
| STAKE-AUDIT-2 | [44114634185](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114634185) | FAIL; actual job logs retrieved for 134149226318 and 134149225390 |
| node420 Release Gate | [44114634601](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114634601) | PASS |
| EXP-1.6 | [44114634070](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114634070) | PASS |
| EXP-1.7 | [44114634189](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114634189) | PASS |
| EXP-1.8 | [44114633716](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114633716) | PASS |
| 420Indexer | [44114633796](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44114633796) | SKIPPED |

New exact-head results belong to the existing workflows on the PR head. `node420-geth-v1.17.5-release-gate` now retains real execution recovery evidence, binary hashes, actual process IDs, canonical block hashes, batch roots, sequences and downstream fixture counters. The artifact's `candidate_sha` identifies the tested commit. Do not substitute a newer SHA for historical evidence.

## Implemented corrections

- STAKE-AUDIT-2 now explicitly asserts V2 schema/integrity, strict decoding, durable synchronization, verified construction and verified commit/recovery. It does not accept V1 as an alternative schema.
- Its Solidity jobs use the existing isolated import-closure compiler with the unmodified full original owners: ABI vectors, ConsensusSystemCall420 and StakeValidatorGenesis420. No original test filter was narrowed. The complete closure has 31 files. Missing unrelated Bridge npm dependencies no longer block these Stake owners.
- Duplicate, omitted and null journal fields fail closed, including malformed encodings that previously decoded to a valid zero-sequence checksum. Legacy journal derivation cannot silently migrate or reset a file.
- Verified sequence commit now checks canonical child header `extraData` against the exact batch root and checks its parent hash, in addition to canonical block identity, VALID status and gateway sequence continuity.
- Pinned Geth recovery distinguishes a forward canonical-state reconstruction from a backward reorganization. Previously a rewound stateful head beneath retained canonical headers caused unsigned reorg-depth underflow (`18446744073709551615`).
- Full-sync restart no longer switches into snap mode solely because canonical headers survived an unflushed-state crash. A recorded snap pivot is required for that startup snap-recovery condition. Genuine recorded snap-pivot recovery remains on the original path.
- The existing live Engine smoke script supports configurable local ports, disables unused IPC/discovery and reports early child failure instead of waiting blindly.

## Actual local execution evidence

[Working-tree process evidence](evidence/stake-audit-9.2/execution-local-working-tree.json) retains the first passing real execution run. It explicitly identifies working-tree provenance; it is not represented as an exact committed-head run.

Built binaries: Go 1.25.3, patched Geth v1.17.5 at upstream commit `9621c6ad10934a01b5514886fb6fbd87640b6c05`, node420 wrapper and fourtwentyd probe. Process evidence records Geth binary SHA-256 `34feb67503fe88a5b6bf959c9588cd4ce33751c8150e28371a74dd857b3757d6` and wrapper SHA-256 `3c8e7b98c90f5b5bcdf51adc9724e298c0acee9e91140f4e12d0a4f332d633b8`.

The integration genesis contains the compiled real Solidity gateway at frozen 0x043c and an explicitly declared counter test double at 0x0423. It is NOT a deployed production Stake genesis. The repository execution genesis is not modified.

| Executed scenario | Observed result |
|---|---|
| Actual authenticated Engine staging/build/import/canonicalization | PASS; two native calls produced sequence=2 and counter=2 |
| Actual Geth SIGKILL, same persistent database, restarted binary | PASS with canonical reconstruction; immediate stateful head rewound to genesis, retained fixture batch/payload reconstructed sequence=2/counter=2 |
| Lost staged next batch after process death | PASS; restaging rebuilt the identical block hash and advanced to sequence=3/counter=3 |
| Later downstream call reverts after earlier call succeeds | PASS; payload construction rejected and canonical block, sequence and counter stayed unchanged |
| Second SIGKILL and deterministic reconstruction/rejected retry | PASS; rejected partial effects did not appear after restart |
| Real block-hash-pinned `lastSequence()` ABI read | PASS; canonical EIP-1898 reads returned 32-byte words containing 0, 2 and 3 as expected |
| Existing live Engine payload smoke | PASS against actual built Geth |

The independently executed `cast sig 'lastSequence()'` returned `0x3bc684e9`. Solc 0.8.24 method identifiers independently returned `3bc684e9`; the harness uses that compiler-derived selector for actual pinned RPC reads. Compiler SHA-256: `fb03a29a517452b9f12bcf459ef37d0a543765bb3bbc911e70a87d6a37c30d5f`.

Local retained Solidity owners: **30 passed, 0 failed** (1 ABI, 7 gateway, 22 lifecycle/settlement). Consensus package and execution/systemcall tests passed; changed sequence/Engine tests also passed with the race detector. The initial new wrong-batch negative test accidentally reused identical payload bytes; it was corrected to distinct payload bytes and then passed.

Exploratory upstream catalyst reorg-depth and downloader synchronization tests failed because their generated blocks do not stage the mandatory 420 system-call batches (`420 system-call batch not staged`). They are not reported as passing. The production package build and native recovery harness are separate evidence; no native staging checks were disabled to run upstream fixtures.

## Execution-side atomicity review

`core.Process420SystemCalls` may finalize successful earlier calls in its temporary per-block StateDB before a later call fails. The block processor returns before ValidateState/commit, and `BlockChain.ProcessBlock` starts from a fresh parent StateDB. The miner's `generateWork` returns an error with deferred work disposal and no assembled payload. Therefore failed block state must be discarded by those owners, not reused as a partially settled block. The real later-call rejection/restart test exercises the builder/canonical database boundary. It does not claim a separately forged invalid-payload import test.

Staging is in memory and is not an execution checkpoint. Default Geth path-state buffering can lose the latest stateful head on SIGKILL even after Engine VALID/canonicalization. Production recovery must retain every required canonical batch and payload in verified consensus history and restage them before requesting state reconstruction. Treating execution VALID as proof of crash-durable state is incorrect.

## Required persistent state and operator recovery

Preserve the execution data directory (including `geth/chaindata`, `geth/triedb`, ancient state/history), the consensus checkpoint/history directory, the V2 sequence journal and the paired JWT secret. Keep these together with chain identity and the independently authenticated genesis/committee configuration. Never delete a journal or initialize an empty execution directory to make a cursor mismatch disappear.

The consensus-selected canonical execution hash and committed batch history must be independently authenticated consensus evidence. RPC chain ID, canonical block identity and gateway sequence reconcile execution with that evidence; they cannot select consensus authority. Recovery must validate ancestry and the existing finalized boundary before calling `RecoverVerifiedSequence`.

- Consensus-only failure: load verified durable consensus history, independently reconcile canonical execution/gateway state and the V2 cursor, and only then derive the next batch.
- Execution-only failure: halt settlement while execution is unavailable. Restart the same database, reconstruct any lost state/staged batches from verified history, recheck the canonical checkpoint and then resume.
- Simultaneous failure: independently reconstruct both stores before reconciliation; neither side's latest RPC answer may replace verified consensus history.
- Execution acceptance before journal persistence: a stale journal requires explicit reconciliation against the already selected canonical history and gateway state. Do not repeat a settled call. Execution state rewind instead requires re-execution of the retained canonical block, not a duplicate call on an already applied state.
- Reorganization: only a consensus-permitted replacement descending from the existing finalized checkpoint may replace a cursor. Orphan/stale checkpoints and cross-finalized recovery must halt.
- Any malformed/missing/corrupt journal, conflicting sequence/root/hash, unavailable Engine, rejected transition or persistence/synchronization failure requires a fail-closed halt until independently verified reconciliation succeeds.

**No production operator command implementing this full flow exists yet.** These are required recovery conditions, not a claim that operators can currently resume production safely using the deterministic devnet simulator.

## Remaining local blockers — no testnet dependency

`consensus/cmd/fourtwentyd/main.go` has no production proposal/import/settlement loop. Its devnet node creates synthetic roots and unsigned signer counts; it must not supply production recovery authority. Neither `RecoverVerifiedSequence` nor `CommitVerifiedSequence` has an actual production daemon caller. `consensus/recovery` is a README stub. There is no integrated durable authenticated consensus batch/payload history source enforcing finality/ancestry across restart.

Consequently consensus-only/simultaneous production restarts, abrupt consensus death between execution acceptance and journal persistence, production canonical replacement/finalized-boundary protection and imported-invalid-block settlement qualification remain **NOT EXECUTED / NOT QUALIFIED**. The execution driver and downstream test double do not satisfy those requirements. The library recovery method's caller-side finality condition remains unfinished production integration.

These are repository implementation gaps, not external provider or testnet blockers. Full STAKE-AUDIT-9.2 closeout and PR merge remain prohibited until they are implemented and qualified. STAKE-AUDIT-9.1 signing-boundary evidence and scope are preserved. No claim is made that 9.2 is complete or merged.
