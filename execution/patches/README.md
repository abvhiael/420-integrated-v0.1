# node420 go-ethereum patchset

Baseline: **go-ethereum v1.17.5**

The files in this directory define the maintained protocol modifications applied to the exact pinned upstream release before building the `node420` execution binary.

## 420 consensus system-call patch

`apply-420-systemcall.py` is the authoritative patch generator for the native consensus-to-execution path defined by `docs/CONSENSUS-SYSTEM-CALL-v1.md`.

The generator:

- refuses to run unless the source tree is exactly tagged `v1.17.5`;
- checks every expected upstream source anchor exactly once before modifying it;
- creates `core/systemcall420` in the Geth tree;
- registers authenticated `engine420_submitSystemCallsV1` staging;
- fixes the SHA-256 system-call batch root into execution-header `extraData`;
- executes native EVM calls from `params.SystemAddress` to `0x043c`;
- inserts the hook after user transactions/existing post-execution queues and before consensus-engine finalization/state-root assembly;
- applies the same state transition in payload building and imported-block validation;
- runs `gofmt` on every modified Go source file.

This must remain an in-process block-state transition. Do not replace it with an RPC-submitted transaction or a funded privileged key.

Release qualification must apply the generator to the pinned upstream commit, run the upstream plus 420 execution tests, record the resulting Git tree/diff hash, and build the `node420` binary from that patched tree.
