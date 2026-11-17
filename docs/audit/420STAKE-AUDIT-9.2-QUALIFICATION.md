# STAKE-AUDIT-9.2 — authoritative recovery qualification record

Status: **Production settlement/history implementation and local process qualification completed. Exact-head CI/merge provenance is retained in PR #1189 and its release-gate artifact.**

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

`core.Process420SystemCalls` may finalize successful earlier calls in its temporary per-block StateDB before a later call fails. The block processor returns before ValidateState/commit, and `BlockChain.ProcessBlock` starts from a fresh parent StateDB. The miner's `generateWork` returns an error with deferred work disposal and no assembled payload. Therefore failed block state must be discarded by those owners, not reused as a partially settled block. The real later-call rejection/restart test exercises the builder/canonical database boundary. That historical execution-only run did not include a forged invalid-payload import. The certified-runtime qualification below now separately exercises hash rejection and a correctly hashed block whose later native call reverts.

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

The production command is now `fourtwentyd --certified-settlement`, built with `-tags blst`, using an independently pinned trust file, paired JWT/Engine and persistent settlement directory. See [operator and architecture instructions](../../consensus/recovery/README.md). It consumes certified records rather than creating signatures; 9.1 remains separate.

## Production settlement/history integration and process qualification

The earlier absence of a production recovery caller is resolved by
`consensus/recovery/{history,settlement}.go` and the certified-settlement daemon
mode. This is a real BLS/QC/PoP-verifying settlement consumer, not the deterministic
devnet validator. It uses the existing consensus envelope, derivation constructor,
QC signing domain and one-certified-child finality rule. Unknown committee or
rotation authority fails closed; the pinned trust/committee must be independently
provisioned. Proposal signing, elections and the separate 9.1 signing-boundary
qualification are not claimed by this consumer.

A durable authenticated pending record precedes execution. Complete signed
header/body/outcome/payload history, the committed settlement checkpoint, a
separate finalized high-water and the V2 cursor have explicit crash-reconciliation
ordering. Missing/truncated history cannot be overridden with `--recover-sequence`.
The process owns its directory exclusively and persistence failure latches a halt.

The native authenticated replacement-staging method retains ordinary conflicting
staging rejection, verifies chain/canonical parent and rejects replacement at or
below finalized execution. A pinned-Geth builder correction permits a replacement
child of the exact finalized parent without rewinding the finalized head.

[Local working-tree process evidence](evidence/stake-audit-9.2/certified-settlement-local-working-tree.json) retains source/binary hashes and actual PIDs without relabeling it as an exact committed-head run.

The extended existing execution harness (`--consensus`) executed these scenarios
with real `fourtwentyd`/Geth PIDs, persistent state, authenticated Engine requests,
actual native gateway calls and 11-of-15 BLST quorum signatures/PoPs:

| Scenario | Local result |
|---|---|
| Consensus-only SIGKILL/restart; same execution remains running; next derivation | PASS |
| Simultaneous SIGKILL/restart; reconstruct independent persistent stores | PASS |
| Canonical execution acceptance followed by actual consensus kill before cursor persistence | PASS; execution sequence 4 with stale journal 3, then verified recovery to 4 without duplicate effects |
| Execution-only SIGKILL; consensus stays alive and cannot advance checkpoint while Engine unavailable | PASS |
| Lost execution state/staging reconstruction from authenticated consensus history | PASS |
| Certified replacement above finality with changed batch/sequence | PASS; canonical sequence/counter 6 replaced by 5 |
| Cross-finalized replacement, orphan checkpoint, duplicate commit and forged certificate | REJECTED as required |
| Stale/corrupted cursor and explicit verified repair | PASS; no silent reset |
| Truncated history beneath durable finalized high-water, even with repair | REJECTED as required |
| Certified payload rejected by actual Engine import | PASS; history settlement, checkpoint and cursor unchanged |
| Correctly hashed block import whose second native call reverts after the first writes temporary state | PASS; actual sequence-7 revert, no partial canonical effects or settlement |
| Actual wrong-chain execution database paired with unchanged consensus history | REJECTED; no checkpoint advance |
| Replayed sequence in the next actual execution block | REJECTED by native gateway |

The production binary uses `blst`; the separate fault-instrumented build uses
`blst recoveryfault` and SIGSTOP at the canonical-before-cursor boundary. The
external harness sends SIGKILL to its actual PID. Known private keys belong only
to the explicitly local fixture producer. Downstream native effects use the
identified counter fixture; retained Solidity Stake/gateway tests cover actual
contract semantics. This does not claim a completed validator signer or live
public testnet.

Local race-enabled tests additionally cover certificate/key/PoP validation,
finality ancestry, derivation/commitment mismatch, strict history JSON, single
state ownership, immutable queued authority, durable pending evidence, execution
unavailability and forged history with a recomputed checksum. A discovered
queued-input pointer alias was corrected by decoding into owned zero-value
records; its regression now passes. The verified Stake import wrapper also preserves rejected Engine status/batch evidence, allowing the production caller to latch deterministic rejection rather than mistake it for a retryable outage; that regression passes.

Preserve the historical run IDs/results above. The new release-gate artifact
contains exact candidate SHA, binary hashes/build tags, trust pin, actual PIDs,
certified records, stdout events, database logs and durable before/after evidence.
PR #1189 records the final exact-head workflow IDs/artifact URL and merge result;
no historical run is relabeled as evidence for later material changes.

STAKE-AUDIT-9.1 remains open and STAKE-AUDIT-9.3 has not started. No new economics,
frozen-address changes, signer authority or branch approval rules were introduced.
