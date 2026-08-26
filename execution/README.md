# node420 execution client

`node420` uses the pinned go-ethereum v1.17.5 baseline at immutable commit `9621c6ad10934a01b5514886fb6fbd87640b6c05` plus the maintained 420 protocol patchset.

## Consensus system calls

420 Integrated genesis requires a protocol-level consensus-to-execution system-call hook that stock Geth does not provide.

Frozen identities:

- native system origin: go-ethereum `params.SystemAddress` (`0xfffffffffffffffffffffffffffffffffffffffe`)
- gateway predeploy: `ConsensusSystemCall420` at `0x000000000000000000000000000000000000043c`

The normative mechanism is defined in `docs/CONSENSUS-SYSTEM-CALL-v1.md`. Consensus batch construction lives in `consensus/systemcall`; execution-side validation helpers live in `execution/systemcall`.

A production `node420` build MUST use the pinned Geth baseline with `execution/patches/apply-420-systemcall.py`. The wrapper process cannot emulate this safely through JSON-RPC or ordinary transactions because those writes would not have the required native-origin block-processing context.

The patched block processor:

- receives the canonical batch through authenticated `engine420_submitSystemCallsV1` staging;
- requires the execution header `extraData` to equal the canonical SHA-256 batch root;
- enforces the same 64-call / 256 KiB batch limits as `fourtwentyd`;
- executes gateway messages after ordinary transactions and Geth post-execution queues, before consensus-engine finalization and state-root assembly;
- uses protocol-owned gas accounting and `params.SystemAddress`;
- includes all resulting state in the execution state root;
- invalidates the candidate payload atomically if any system call fails.

## Release gate

Run:

```sh
bash ./scripts/build-node420-upstream.sh
```

The release gate verifies the exact upstream commit, applies the patch to a clean source tree, executes generated `systemcall420` tests, compiles every modified Geth package, builds the patched Geth binary, and records SHA-256 evidence for the complete source patch and binary under `artifacts/node420-release-gate/`.

`.github/workflows/node420-release-gate.yml` performs the same qualification in GitHub Actions. A release is not qualified until that workflow actually receives a runner, completes successfully, and its evidence artifact is retained with the release manifest.
