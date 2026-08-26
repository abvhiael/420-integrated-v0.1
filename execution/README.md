# node420 execution client

`node420` currently wraps the pinned go-ethereum baseline for ordinary Engine API and EVM execution.

## Consensus system calls

420 Integrated genesis requires a protocol-level consensus-to-execution system-call hook that stock Geth does not provide.

Frozen identities:

- native system origin: `0xfffffffffffffffffffffffffffffffffffff420`
- gateway predeploy: `ConsensusSystemCall420` at `0x000000000000000000000000000000000000043c`

The normative mechanism is defined in `docs/CONSENSUS-SYSTEM-CALL-v1.md` and the execution validation/hook abstraction lives in `execution/systemcall`.

A production `node420` build MUST use a maintained Geth patch/fork that executes the ordered system-call batch after ordinary transactions and before the post-state root is finalized. The wrapper process cannot emulate this safely through JSON-RPC or ordinary transactions because those writes would not have the required native-origin execution context.

The patched block processor must reject ordinary transactions from the native system origin, execute gateway messages with protocol-owned gas accounting, include all resulting state in the block state root, and invalidate the candidate payload atomically if any system call fails.

Pinned upstream baseline information remains in `execution/upstream.json`.
