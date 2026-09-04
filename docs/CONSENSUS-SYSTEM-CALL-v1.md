# 420 Consensus-to-Execution System Call — v1

Status: **FROZEN FOR TESTNET**

This specification defines the privileged deterministic state-transition path used by `fourtwentyd` consensus to apply finalized validator, reward, rotation and slashing outcomes inside `node420` execution.

## 1. Security model

Consensus state MUST NOT be applied through an ordinary user transaction, governance transaction, privileged private key, JSON-RPC impersonation feature, or mempool-visible synthetic transaction.

The protocol uses:

- `NATIVE_SYSTEM_ORIGIN = 0xfffffffffffffffffffffffffffffffffffffffe`, go-ethereum `params.SystemAddress`;
- `ConsensusSystemCall420 = 0x000000000000000000000000000000000000043c`, the 420 gateway predeploy.

420 reuses Geth's established native system-call origin instead of defining another pseudo-address. `node420` exposes no public RPC path that lets a remote user synthesize the 420 gateway call with this context.

`ValidatorRegistry` and `RewardController` accept consensus writes only from `ConsensusSystemCall420`; they do not trust the native origin directly.

## 2. Execution placement

For block N, ordinary EVM transactions execute first in canonical transaction order. Geth's existing post-execution protocol queues run next. The ordered 420 consensus-system-call batch then executes **before consensus-engine finalization and before the post-state root is assembled**.

Each 420 call uses the same class of native zero-fee EVM system-call plumbing used by pinned Geth v1.17.5 protocol calls:

- caller = `params.SystemAddress`;
- destination = `ConsensusSystemCall420`;
- value = 0;
- no user gas purchase or priority fee;
- deterministic protocol gas ceiling;
- resulting state included in the block state root.

System calls are not inserted into the user transaction trie and do not have user transaction hashes.

A system-call failure invalidates the candidate execution payload. It MUST NOT be skipped, reordered, retried with changed parameters, or converted into an ordinary transaction.

## 3. Ordered envelope

Every instruction contains:

- `sequence`: strictly monotonic chain-global system-call sequence beginning at 1;
- `executionBlock`: block in which the instruction executes;
- `parentHash`: canonical execution parent hash;
- `chainId`: EVM chain ID;
- `action`: domain-separated action ID;
- `target`: frozen downstream system-contract address;
- `payload`: exact ABI calldata for the allowed downstream selector.

The gateway validates `executionBlock == block.number`, `parentHash == blockhash(block.number - 1)`, `chainId == block.chainid`, and `sequence == lastSequence + 1`.

## 4. Frozen action routes

| Action domain | Target | Function |
|---|---|---|
| `420/SYSCALL/VALIDATOR_STATE/V1` | ValidatorRegistry `0x0423` | `applyConsensusState` |
| `420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1` | ValidatorRegistry `0x0423` | `applyExitNotice` |
| `420/SYSCALL/VALIDATOR_SLASH/V1` | ValidatorRegistry `0x0423` | `applySlash` |
| `420/SYSCALL/ROTATION_SNAPSHOT/V1` | ValidatorRegistry `0x0423` | `applyRotationSnapshot` |
| `420/SYSCALL/REWARD/V1` | RewardController `0x0420` | `applyConsensusReward` |

Bond composition is deliberately **not** a consensus-system-call action. Native 420 collateral composition changes only through real-value execution paths (`register`, `topUpOwnedBond`, `replaceProtocolCredit`, slashing value movement, and withdrawal/recycling). Consensus may determine validator lifecycle and slash outcomes, but it cannot fabricate an accounting-only bond balance.

The gateway checks both target and function selector. A valid action cannot be redirected to another system contract or another method on the same contract.

## 5. Individual EVM-call commitment

`ConsensusSystemCall420` commits each applied instruction as:

`keccak256(abi.encode(DOMAIN, chainId, sequence, executionBlock, parentHash, action, target, keccak256(payload)))`

with `DOMAIN = keccak256("420/CONSENSUS_SYSTEM_CALL/V1")`.

The resulting call hash is emitted and the most recent hash/sequence are retained in gateway state.

## 6. Consensus batch commitment and limits

The ordered system-call list is consensus data and is committed separately using the canonical implementation in `consensus/systemcall`.

Batch root:

- hash: SHA-256;
- domain: `420/CONSENSUS_SYSTEM_CALL_BATCH/V1`;
- encoding: length-prefixed, big-endian canonical fields;
- committed fields: chain ID, execution block, parent hash, call count and every ordered call field/payload.

Order is consensus-critical. Reordering two otherwise valid calls changes the batch root.

The testnet protocol applies identical pre-EVM limits in `fourtwentyd` and patched Geth:

- maximum 64 system calls per execution block;
- maximum 262,144 aggregate payload bytes per batch;
- maximum 96 bytes for an action-domain string;
- minimum 4 payload bytes per call, sufficient for an ABI selector;
- node420 staging retention of 4,096 execution blocks.

An oversized or malformed batch is invalid before privileged EVM execution. These limits prevent protocol-owned gas and authenticated staging memory from becoming an unbounded block-processing resource.

## 7. Execution-header commitment

During the bonded-validator protocol, the complete 32-byte execution-header `extraData` field is reserved for the 420 system-call batch root.

Before payload construction, `fourtwentyd` stages the canonical batch at `node420`. The patched Geth builder sets:

`header.extraData = systemCallBatchRoot`

and rejects a conflicting override.

During block import/`NewPayload`, `node420` recomputes the staged batch root and requires exact equality with `header.extraData` before applying the batch. The root therefore participates in the execution block hash and cannot be changed without changing the block itself.

Even an empty call batch has its canonical non-zero SHA-256 root and MUST be staged. This removes ambiguity between “no calls” and “consensus batch unavailable.”

## 8. Authenticated Engine transport

The paired clients use:

`engine420_submitSystemCallsV1`

on the same JWT-authenticated private Engine endpoint used by the standard Engine API.

The call stages consensus data only. The RPC handler MUST NOT execute EVM state directly.

Required order for block building:

1. `fourtwentyd` derives and commits the batch;
2. `fourtwentyd` calls `engine420_submitSystemCallsV1`;
3. `node420` validates and echoes the batch root;
4. `fourtwentyd` requests payload construction through `engine_forkchoiceUpdatedV3`;
5. `node420` fixes `extraData` to that root and executes the staged calls during payload construction;
6. `fourtwentyd` verifies the returned payload `extraData` before accepting it.

Required order for received payload validation:

1. `fourtwentyd` reconstructs the canonical batch for the received block;
2. it verifies the payload parent/root expectation;
3. it stages the batch through `engine420_submitSystemCallsV1`;
4. it calls `engine_newPayloadV3`;
5. patched `node420` recomputes the root and executes the identical batch during block processing.

## 9. Replay and reorg rules

V1 uses one chain-global monotonically increasing sequence.

- duplicate sequence: invalid;
- skipped sequence: invalid;
- sequence reordering: invalid;
- valid call replayed on another block: invalid;
- valid call replayed on another chain: invalid.

If an unfinalized block is reorged, its gateway state disappears with that branch. The replacement branch begins from the parent gateway sequence and its own parent-bound batch root.

Consensus is additionally responsible for preventing a slash evidence object from being charged twice.

## 10. node420 implementation

The repository pins go-ethereum v1.17.5 at immutable commit `9621c6ad10934a01b5514886fb6fbd87640b6c05` plus a maintained 420 patchset. `execution/patches/apply-420-systemcall.py` is the authoritative anchor-checked patch generator.

It modifies the exact pinned Geth tree to:

1. add an authenticated `engine420` batch-staging service;
2. maintain bounded staged batches keyed by execution block + parent hash;
3. set builder `extraData` to the staged batch root;
4. verify `extraData` on imported blocks;
5. execute each gateway call using `params.SystemAddress` and Geth's native system-call gas machinery;
6. run the hook after existing post-execution queues and before consensus-engine finalization/state-root assembly;
7. reject the payload atomically if any call fails;
8. apply the same transition in builder and validator/import paths.

The release gate `scripts/build-node420-upstream.sh` verifies the immutable upstream commit, resets to a clean tree, applies the patcher, installs generated `systemcall420` unit tests, records a complete patch including new files, compiles every directly modified Geth package, builds the patched `geth` binary, and emits SHA-256 evidence for the patch and resulting binary under `artifacts/node420-release-gate/`.

## 11. Genesis initialization

Genesis places `ConsensusSystemCall420` runtime bytecode at `0x043c`.

Genesis storage materializes:

- `RewardController.consensusSystemCaller = 0x043c` and bound=true;
- `ValidatorRegistry.consensusSystemCaller = 0x043c` and bound=true;
- `ValidatorRegistry` ↔ `CommunityValidatorReserve` canonical binding.

The binding API itself rejects any consensus caller other than `0x043c`.

No validator key, governance key, deployer key, smart-account key, session key, recovery key, or RPC credential receives EVM authority equivalent to the native system-call path.
