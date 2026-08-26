# node420 execution client

`node420` is based on the pinned go-ethereum v1.17.5 execution baseline.

## Consensus system calls

420 Integrated genesis requires a protocol-level consensus-to-execution system-call hook. The implementation reuses Geth's existing native EVM system-call machinery rather than simulating privileged writes through JSON-RPC or ordinary transactions.

Frozen identities:

- native system origin: go-ethereum `params.SystemAddress` = `0xfffffffffffffffffffffffffffffffffffffffe`
- gateway predeploy: `ConsensusSystemCall420` at `0x000000000000000000000000000000000000043c`

The normative mechanism is defined in `docs/CONSENSUS-SYSTEM-CALL-v1.md`; execution envelope validation and the hook abstraction live in `execution/systemcall`.

A production `node420` build MUST use the pinned Geth baseline plus the maintained 420 patchset. The patch executes the ordered system-call batch after ordinary transactions and before post-state finalization using the same class of zero-fee native EVM call path already used by Geth protocol system calls.

The wrapper process cannot emulate this safely through JSON-RPC because those writes would not be part of the deterministic block state-transition path.

The patched block processor must verify the consensus batch commitment, execute only the frozen gateway routes, include all resulting state in the block state root, and invalidate the candidate payload atomically if any system call fails. No public RPC endpoint may synthesize the privileged 420 gateway path.

Pinned upstream and patchset information is recorded in `execution/upstream.json`.
