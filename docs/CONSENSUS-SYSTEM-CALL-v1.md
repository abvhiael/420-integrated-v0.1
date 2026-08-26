# 420 Consensus-to-Execution System Call — v1

Status: **FROZEN FOR TESTNET**

This specification defines the privileged deterministic state-transition path used by `fourtwentyd` consensus to apply finalized validator, reward, rotation, bond and slashing outcomes inside `node420` execution.

## 1. Security model

Consensus state MUST NOT be applied through an ordinary user transaction, governance transaction, privileged private key, JSON-RPC impersonation feature, or mempool-visible synthetic transaction.

The protocol uses two separate identities:

- `NATIVE_SYSTEM_ORIGIN = 0xfffffffffffffffffffffffffffffffffffff420`
- `ConsensusSystemCall420 = 0x000000000000000000000000000000000000043c`

`NATIVE_SYSTEM_ORIGIN` is an execution-client context identity. It has no private key, balance requirement, nonce, or transaction-signing capability. `node420` MUST reject any ordinary transaction whose recovered sender is this address.

`ConsensusSystemCall420` is a genesis predeploy. `ValidatorRegistry` and `RewardController` accept consensus writes only from this predeploy.

## 2. Execution placement

For block N, ordinary EVM transactions execute first in canonical transaction order. After the final ordinary transaction and before the block post-state root is committed, `node420` executes the ordered consensus-system-call list for block N.

Each call is executed as an EVM message with:

- caller = `NATIVE_SYSTEM_ORIGIN`;
- destination = `ConsensusSystemCall420`;
- value = 0;
- gas accounting excluded from user block gas purchasing and fee markets;
- deterministic protocol gas ceiling defined by the execution implementation;
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

The resulting call hash is emitted and the most recent hash/sequence are retained in gateway state. `fourtwentyd` and `node420` SHOULD expose the same commitment in diagnostics so cross-layer divergence can be identified deterministically.

## 6. Consensus commitment

The ordered system-call list for an execution block MUST be derived solely from finalized/committed consensus state under the protocol rules. The execution payload builder MUST NOT invent validator or reward calls.

Before requesting or accepting the execution payload as canonical, `fourtwentyd` computes the expected ordered call list. `node420` applies exactly that list during execution. A mismatch in count, ordering, envelope fields, action route, payload or resulting execution validity rejects the payload.

A future Engine API extension MAY carry an explicit system-call-list root. Until that extension is implemented, the integration boundary MUST use an authenticated local consensus/execution channel and deterministic reconstruction rules; the user transaction list is never the transport.

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

System-call effects are ordinary EVM state changes for state-root purposes. If an unfinalized execution block is reorged, its system-call state changes disappear with that block. The replacement branch starts from the parent gateway sequence and applies the replacement branch's deterministic system-call list.

A finalized consensus instruction must not be rewritten except under the protocol's catastrophic recovery/finality rules.

## 9. node420 implementation requirement

The current repository wrapper launches pinned upstream Geth. A production 420 execution client therefore requires a maintained Geth patch or fork that adds the system-call hook directly to block processing.

The hook MUST:

1. reserve `NATIVE_SYSTEM_ORIGIN` from ordinary signed transactions;
2. receive/reconstruct the consensus system-call list through an authenticated consensus boundary;
3. validate envelope context before execution;
4. execute the gateway after ordinary transactions and before post-state finalization;
5. use zero economic value and protocol-owned gas accounting;
6. fail the execution payload atomically if any system call fails;
7. expose deterministic call commitments for diagnostics/test vectors;
8. never expose an RPC method that lets an ordinary remote caller invoke the native-origin path.

The `execution/systemcall` package contains the chain-side envelope/context validation shared by that patch.

## 10. Genesis initialization

Genesis places `ConsensusSystemCall420` runtime bytecode at `0x043c`. `ValidatorRegistry` and `RewardController` genesis storage binds their consensus-system caller to exactly `0x043c`; the binding API rejects any other address.

The gateway itself trusts only `NATIVE_SYSTEM_ORIGIN`.

No validator key, governance key, deployer key, smart-account key, session key, or recovery key receives this authority.
