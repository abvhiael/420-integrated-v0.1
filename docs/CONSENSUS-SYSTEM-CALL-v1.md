# 420 Consensus-to-Execution System Call — v1

Status: **FROZEN FOR TESTNET**

This specification defines the privileged deterministic state-transition path used by `fourtwentyd` consensus to apply finalized validator, reward, rotation, bond and slashing outcomes inside `node420` execution.

## 1. Security model

Consensus state MUST NOT be applied through an ordinary user transaction, governance transaction, privileged private key, JSON-RPC impersonation feature, or mempool-visible synthetic transaction.

The protocol uses:

- `NATIVE_SYSTEM_ORIGIN = 0xfffffffffffffffffffffffffffffffffffffffe`, the existing go-ethereum `params.SystemAddress` used by native EVM system-call machinery;
- `ConsensusSystemCall420 = 0x000000000000000000000000000000000000043c`, the 420 gateway predeploy.

420 deliberately reuses Geth's established native system-call origin instead of defining another pseudo-address. The address is execution-client context, not validator/governance authority and not a key that the protocol distributes. `node420` MUST expose no public RPC path that lets a remote user synthesize the 420 gateway call with this context.

`ValidatorRegistry` and `RewardController` accept consensus writes only from `ConsensusSystemCall420`; they do not trust the native origin directly.

## 2. Execution placement

For block N, ordinary EVM transactions execute first in canonical transaction order. After the final ordinary transaction and before the block post-state root is committed, `node420` executes the ordered consensus-system-call list for block N.

Each 420 call is executed using the same class of native zero-fee EVM system-call plumbing that pinned Geth uses for protocol system calls:

- caller = go-ethereum `params.SystemAddress`;
- destination = `ConsensusSystemCall420`;
- value = 0;
- no user gas purchase or priority fee;
- deterministic protocol gas ceiling;
- state changes included in the block state root.

System calls are not inserted into the user transaction trie and do not have user transaction hashes.

A system-call failure invalidates the candidate execution payload. It MUST NOT be skipped, retried with changed parameters, reordered, or converted into an ordinary transaction.

## 3. Ordered envelope

Every instruction contains:

- `sequence`: strictly monotonic global system-call sequence beginning at 1;
- `executionBlock`: block in which the instruction executes;
- `parentHash`: canonical execution parent hash;
- `chainId`: EVM chain ID;
- `action`: domain-separated action ID;
- `target`: frozen downstream system-contract address;
- `payload`: exact ABI calldata for the allowed downstream selector.

The gateway validates `executionBlock == block.number`, `parentHash == blockhash(block.number - 1)`, `chainId == block.chainid`, and `sequence == lastSequence + 1`.

This makes replay on another block, fork ancestry or chain fail closed.

## 4. Frozen action routes

V1 exposes only these routes:

| Action domain | Target | Function |
|---|---|---|
| `420/SYSCALL/VALIDATOR_STATE/V1` | ValidatorRegistry `0x0423` | `applyConsensusState` |
| `420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1` | ValidatorRegistry `0x0423` | `applyExitNotice` |
| `420/SYSCALL/VALIDATOR_BOND/V1` | ValidatorRegistry `0x0423` | `applyBondComposition` |
| `420/SYSCALL/VALIDATOR_SLASH/V1` | ValidatorRegistry `0x0423` | `applySlash` |
| `420/SYSCALL/ROTATION_SNAPSHOT/V1` | ValidatorRegistry `0x0423` | `applyRotationSnapshot` |
| `420/SYSCALL/REWARD/V1` | RewardController `0x0420` | `applyConsensusReward` |

The gateway checks both target and function selector. A valid action cannot be redirected to another system contract or another method on the same contract.

Adding an action requires a versioned protocol upgrade and corresponding execution/consensus compatibility rule.

## 5. Call commitment

`ConsensusSystemCall420` commits each applied instruction as:

`keccak256(abi.encode(DOMAIN, chainId, sequence, executionBlock, parentHash, action, target, keccak256(payload)))`

where:

`DOMAIN = keccak256("420/CONSENSUS_SYSTEM_CALL/V1")`.

The resulting call hash is emitted and the most recent hash/sequence are retained in gateway state. `fourtwentyd` and `node420` expose/reconstruct the same commitment so cross-layer divergence is deterministic.

## 6. Consensus commitment and transport

The ordered system-call list for an execution block is consensus data. It is derived solely from committed/finalized 420 consensus state under protocol rules. The execution payload builder MUST NOT invent validator or reward calls.

`fourtwentyd` stores the ordered list, or a canonical representation from which the list is exactly reconstructable, in the consensus block. It commits a deterministic 32-byte batch root over the ordered instruction commitments. The paired execution client receives the exact list over the authenticated consensus/execution boundary and verifies that root before applying it.

The execution block carries the agreed 32-byte batch commitment through the 420 execution-header commitment mechanism defined by the node420 patch. This commitment is not a user transaction and is independent of the transaction trie.

A mismatch in count, ordering, envelope fields, action route, payload, batch root or execution result rejects the payload.

## 7. Replay and duplication

V1 uses a single global monotonically increasing sequence rather than one nonce per action. This gives a total ordering across reward, validator and slashing operations.

- duplicate sequence: invalid;
- skipped sequence: invalid;
- sequence reordering: invalid;
- valid call replayed on another block: invalid;
- valid call replayed on another chain: invalid;
- same payload with a new sequence is a distinct instruction and must still be valid under downstream protocol rules.

Consensus is additionally responsible for ensuring slash evidence is not charged twice.

## 8. Reorg behavior

System-call effects are ordinary EVM state changes for state-root purposes. If an unfinalized execution block is reorged, its system-call state changes disappear with that block. The replacement branch starts from the parent gateway sequence and applies the replacement branch's committed system-call list.

A finalized consensus instruction must not be rewritten except under the protocol's catastrophic recovery/finality rules.

## 9. node420 implementation requirement

The repository currently wraps pinned go-ethereum v1.17.5. Production 420 execution therefore uses that pinned baseline plus a maintained node420 patchset. The patch extends Geth's existing native system-call machinery rather than simulating consensus through JSON-RPC.

The hook MUST:

1. receive/reconstruct the consensus system-call list through the authenticated consensus boundary;
2. verify the committed batch root and envelope context before execution;
3. execute the gateway after ordinary transactions and before post-state finalization;
4. use `params.SystemAddress`, zero value and protocol-owned gas accounting;
5. fail the execution payload atomically if any system call fails;
6. expose deterministic call/batch commitments for diagnostics and test vectors;
7. never expose a public RPC method that lets an ordinary remote caller invoke this native 420 path.

The `execution/systemcall` package contains the envelope validation and batch hook abstraction used by the patch.

## 10. Genesis initialization

Genesis places `ConsensusSystemCall420` runtime bytecode at `0x043c`. `ValidatorRegistry` and `RewardController` genesis storage binds their consensus-system caller to exactly `0x043c`; the binding API rejects any other address.

The gateway itself accepts its top-level call only from go-ethereum `params.SystemAddress`.

No validator key, governance key, deployer key, smart-account key, session key, or recovery key receives this authority.
