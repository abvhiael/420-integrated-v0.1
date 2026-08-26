# node420 go-ethereum patchset

Baseline: **go-ethereum v1.17.5**  
Pinned commit: **`9621c6ad10934a01b5514886fb6fbd87640b6c05`**

The files in this directory define the maintained protocol patch applied to the exact pinned upstream release before building the `node420` execution binary.

## Authoritative patch inputs

- `apply-420-systemcall.py` — exact-version, exact-commit, clean-tree, anchor-checked source transformation.
- `systemcall420.go.in` — bounded native system-call staging/encoding package inserted into Geth.
- `systemcall420_test.go.in` — generated Geth-side unit tests executed by the release gate.

Do not replace this mechanism with an RPC-submitted transaction or a funded privileged key.

## Frozen behavior

- authenticated `engine420_submitSystemCallsV1` staging endpoint;
- canonical SHA-256 batch-root verification;
- batch root fixed into the execution header `extraData` field;
- native EVM execution from go-ethereum `params.SystemAddress` to `0x043c`;
- execution after user transactions and Geth post-execution queues, before consensus-engine finalization/state-root assembly;
- atomic block rejection on any 420 system-call failure;
- same hook in payload building and imported-block execution;
- 64-call maximum per batch;
- 256 KiB aggregate payload maximum;
- 96-byte action-domain maximum;
- 4,096-block staging retention.

## Release qualification

Run:

```sh
bash ./scripts/build-node420-upstream.sh
```

The gate:

1. resolves `v1.17.5` and requires the exact pinned commit;
2. resets/cleans the Geth checkout and refuses source drift;
3. applies the patch generator;
4. installs and executes the generated `systemcall420` unit tests;
5. compiles every directly modified Geth package;
6. builds the patched Geth binary;
7. records a complete binary patch including newly added files;
8. records SHA-256 hashes for the patch and resulting binary;
9. writes the release evidence to `artifacts/node420-release-gate/`.

The dedicated `.github/workflows/node420-release-gate.yml` runs the same gate and uploads its evidence when GitHub Actions provides a runner.
