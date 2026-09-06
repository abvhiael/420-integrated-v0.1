# node420 go-ethereum patchset

Baseline: **go-ethereum v1.17.5**  
Pinned commit: **`9621c6ad10934a01b5514886fb6fbd87640b6c05`**

The files in this directory define the maintained protocol patch applied to the exact pinned upstream release before building the `node420` execution binary.

## Authoritative patch inputs

- `apply-420-systemcall.py` — exact-version, exact-commit, clean-tree, anchor-checked system-call transformation.
- `systemcall420.go.in` — bounded native system-call staging/encoding package inserted into Geth.
- `systemcall420_test.go.in` — generated Geth-side system-call unit tests executed by the release gate.
- `apply-420-p256.py` — exact-commit, anchor-checked activation of Geth's existing `p256Verify` implementation at `0x0100` for 420 Cancun/Prague rules.
- `p256_420_test.go.in` — generated Geth-side test proving the P-256 precompile is present with the upstream gas schedule before Osaka.

Do not replace consensus-visible behavior with an RPC-submitted transaction, a funded privileged key, or genesis `alloc.code` at a native precompile address.

## Frozen behavior

### Consensus system-call path

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

### P-256 / passkey execution boundary

- native P-256 verification address is `0x0000000000000000000000000000000000000100`;
- 420 launches with Cancun active at genesis, while Prague remains deliberately deferred;
- upstream Geth v1.17.5 already contains `p256Verify`, but normally activates it only with Osaka;
- the node420 patch adds that exact upstream implementation to the Cancun and Prague precompile sets;
- the patch does **not** activate Prague, Osaka, or any unrelated later-fork behavior;
- gas remains the upstream `params.P256VerifyGas` schedule;
- `0x0100` is a native protocol precompile and MUST NOT be represented as genesis `alloc.code`;
- contract-side passkey verification remains runtime-disabled until the wallet's complete passkey qualification gate passes.

## Release qualification

Run:

```sh
bash ./scripts/build-node420-upstream.sh
```

The gate:

1. resolves `v1.17.5` and requires the exact pinned commit;
2. resets/cleans the Geth checkout and refuses source drift;
3. applies both maintained patch generators;
4. installs and executes the generated `systemcall420` unit tests;
5. proves P-256 is active at `0x0100` in both Cancun and Prague precompile sets with the upstream gas schedule;
6. compiles every directly modified Geth package;
7. builds the patched Geth binary;
8. records a complete binary patch including newly added files;
9. records SHA-256 hashes for the patch and resulting binary;
10. writes the release evidence to `artifacts/node420-release-gate/`.

The dedicated `.github/workflows/node420-release-gate.yml` runs the same gate and uploads its evidence when GitHub Actions provides a runner.
