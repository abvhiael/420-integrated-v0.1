# node420 go-ethereum patchset

Baseline: **go-ethereum v1.17.5**

The files in this directory are maintained protocol patches applied to the exact pinned upstream release before building the `node420` execution binary.

## 420 consensus system-call patch

`geth-v1.17.5-420-systemcall.patch` adds the native consensus-to-execution path defined by `docs/CONSENSUS-SYSTEM-CALL-v1.md`.

It is intentionally implemented inside Geth block processing. Do not replace it with an RPC-submitted transaction or a funded privileged key.

Key behavior:

- authenticated `engine420_submitSystemCallsV1` staging endpoint;
- canonical SHA-256 batch-root verification;
- batch root fixed into the execution header `extraData` field;
- native EVM execution from `params.SystemAddress` to `0x043c`;
- execution after user transactions / existing post-execution queues and before engine finalization/state-root assembly;
- atomic block rejection on any 420 system-call failure;
- same hook in payload building and imported-block execution.

The patch must be applied cleanly to the recorded upstream commit and its resulting tree hash must be recorded in the release manifest before testnet/mainnet qualification.
