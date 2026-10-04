# 420Verify deployment and operations

420Verify is a non-canonical verification service. This document describes the repository-supported deployment contract for the current audited implementation. It does not claim that a public testnet or production endpoint exists.

## Current deployment state

The service implementation is under the VERIFY-AUDIT remediation phase in PR #503. Public backend and frontend URLs remain unassigned in `testnet/public-services/verify/readiness.json`. Do not advertise a public endpoint until the readiness manifest contains real URLs and the live smoke checks below have passed.

The Go service serves both the API and the embedded same-origin frontend.

## Build

Build the service from the repository root:

```sh
go build -o ./bin/verify420 ./verify/cmd/verify420
```

The deployment host must provide a trusted RPC endpoint, a compiler cache, a compiler catalogue, and durable evidence storage.

## Required configuration

420Verify reads configuration from environment variables.

| Variable | Required | Meaning |
| --- | --- | --- |
| `VERIFY_CHAIN_ID` | optional | Expected non-zero chain ID. Defaults to `420`. |
| `VERIFY_RPC_URL` | yes | Absolute `http://` or `https://` URL for canonical chain reads. |
| `VERIFY_READINESS_ADDRESS` | yes | 20-byte hex contract address used to prove canonical bytecode is readable before startup becomes ready. |
| `VERIFY_COMPILER_CACHE` | yes | Local root containing allowlisted compiler binaries. |
| `VERIFY_COMPILER_CATALOG` | yes | JSON catalogue describing exact compiler versions, SHA-256 digests, and cache-relative binary paths. |
| `VERIFY_EVIDENCE_STORE` | yes | Durable directory for append-only verification records. |
| `VERIFY_LISTEN_ADDR` | optional | HTTP listen address. Defaults to `:8425`. |

Example values are intentionally local placeholders, not public deployment claims:

```sh
export VERIFY_CHAIN_ID=420
export VERIFY_RPC_URL=http://127.0.0.1:8545
export VERIFY_READINESS_ADDRESS=0x0000000000000000000000000000000000000420
export VERIFY_COMPILER_CACHE=/srv/420verify/compilers
export VERIFY_COMPILER_CATALOG=/etc/420verify/compiler-catalog.json
export VERIFY_EVIDENCE_STORE=/srv/420verify/evidence
export VERIFY_LISTEN_ADDR=127.0.0.1:8425
./bin/verify420
```

## Compiler catalogue

The catalogue is a JSON object with a non-empty `releases` array:

```json
{
  "releases": [
    {
      "version": "0.8.24+commit.e11b9ed9",
      "sha256": "<64 lowercase hex characters>",
      "binary": "solc-0.8.24"
    }
  ]
}
```

Each binary path must be relative to `VERIFY_COMPILER_CACHE` and may not escape that root. SHA-256 must decode to exactly 32 bytes. The runtime verifies the selected compiler file before execution and rejects symlinks and non-regular files. Operators must obtain compiler binaries through a trusted supply path and independently calculate the digest before adding a release.

Changing the catalogue, compiler cache contents, or a compiler digest changes the deployment trust input and requires deployment-specific requalification.

## Startup and readiness

Startup fails closed unless all configuration validates and the service can:

1. read the canonical chain ID from `VERIFY_RPC_URL`;
2. confirm it equals `VERIFY_CHAIN_ID`;
3. read canonical bytecode for `VERIFY_READINESS_ADDRESS`;
4. open and validate the evidence store;
5. load a valid non-empty compiler catalogue.

`GET /healthz` reports process health and explicitly reports `canonical: false`.

`GET /readyz` returns HTTP 200 only after the startup chain qualification succeeds. A process that is alive but unable to prove the configured canonical chain remains not-ready.

## Public HTTP surface

The same process serves:

- `/` — embedded 420Verify frontend;
- `GET /healthz`;
- `GET /readyz`;
- `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}`;
- `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}/history`;
- `GET /v1/verify/evidence/{recordHash}`;
- `POST /v1/verify/submissions`.

Public verification submissions publish source evidence and therefore require explicit `publishSource: true`. Operators must not add a compatibility path that silently publishes source without this consent.

Terminate public TLS in front of the service and preserve the frontend's same-origin API model. Do not broaden its Content-Security-Policy or enable framing merely to simplify deployment.

## Evidence storage

The evidence store is non-canonical but integrity checked. Records are append-only and are validated during restart reconstruction. Atomic writes are synced before rename and the containing directory is synced after rename.

Operational rules:

- place `VERIFY_EVIDENCE_STORE` on durable storage;
- back it up as an immutable directory snapshot;
- do not hand-edit evidence JSON;
- do not renumber, delete, or rewrite history entries;
- alert on disk exhaustion or filesystem errors;
- after restore, restart the service and require a clean evidence-store reconstruction before returning it to traffic.

If an evidence store is corrupted, fail closed. Restore an intact backup or rebuild non-canonical verification evidence by independently resubmitting/reproducing it; never fabricate replacement hashes.

## Proxy-currentness limitation

Persisted proxy relationship evidence is historical evidence at its recorded canonical block. The current production entrypoint does not run a continuous proxy-upgrade tracker. A UI or downstream consumer must not present a persisted implementation relationship as current without revalidating canonical proxy state. Historical verification of an old implementation remains valid historical evidence but does not transfer to a new implementation.

Continuous proxy monitoring is deployment/testnet follow-on work, not a source-verification authority claim.

## Monitoring

At minimum monitor:

- process availability;
- `/healthz` and `/readyz` status;
- configured RPC reachability and chain-ID mismatch;
- evidence-store open/rebuild/write failures;
- free disk space and filesystem health;
- compiler catalogue load failures;
- compiler checksum mismatches, timeouts, output-limit failures, and unexpected execution errors;
- HTTP 429 submission-capacity responses;
- HTTP 5xx responses;
- restart frequency.

A readiness failure should remove the instance from traffic. Verification-service unavailability must not block canonical chain, Registry, Wallet, or Smart Account operation.

## Recovery

**Wrong chain / RPC unavailable:** remove the instance from traffic, correct the RPC or chain configuration, restart, and require `/readyz` to return 200.

**Compiler checksum mismatch:** do not replace or bypass the digest. Quarantine the binary, verify provenance, install the intended binary through the trusted supply path, update the catalogue only when the exact digest is known, then restart.

**Evidence corruption:** keep the service fail-closed, restore a known-good immutable snapshot or rebuild non-canonical evidence through normal verification. Do not disable restart validation.

**Disk exhaustion:** stop submissions, restore writable capacity, verify the evidence directory, restart and require clean reconstruction.

## Testnet/public activation checklist

A deployment is not public-ready until all of the following are true:

1. a real backend/frontend URL is assigned;
2. TLS is valid;
3. `/healthz` returns 200 without claiming canonical authority;
4. `/readyz` returns 200 against the intended testnet chain;
5. a known contract can be looked up or submitted and its result is bound to the expected chain/address/runtime code hash;
6. explicit source-publication consent is enforced;
7. restart preserves and revalidates stored evidence;
8. wrong-chain configuration fails closed;
9. compiler checksum mismatch fails closed;
10. proxy-currentness is not overstated;
11. monitoring and durable storage are active;
12. `testnet/public-services/verify/readiness.json` is updated with real URLs and deployment evidence.

Until those conditions are satisfied, the repository must continue to report public deployment as pending.
