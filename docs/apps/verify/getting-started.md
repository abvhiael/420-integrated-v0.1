# Getting started

420 Verify checks whether published source/build inputs reproduce code deployed on the 420 network.

## Before you submit

Prepare the target chain ID and contract address, plus either Solidity Standard JSON Input or a complete multi-file source bundle. Record the exact compiler version, optimizer settings/runs, EVM version, via-IR setting, metadata hash mode, linked libraries, and constructor arguments when known.

Do not submit private keys, seed phrases, signing keys, keystore passwords, or wallet secrets. The API rejects secret-bearing fields.

## Submission

Use `POST /v1/verify/submissions` with the target chain/address and committed source/build submission. The service independently reads canonical deployed bytecode from its configured RPC, reproduces the build with an allowlisted compiler, compares the results, and persists reproducible evidence.

## Lookup

Use `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}` for the latest record bound to an exact deployed-code subject. Use the `/history` form for the full append-only history, or `GET /v1/verify/evidence/{recordHash}` for a specific evidence record.

## Interpret the result

`FULL_MATCH`, `PARTIAL_MATCH`, `MISMATCH`, and `UNVERIFIABLE` are distinct states. A successful verification proves correspondence between published build inputs and deployed code; it is not an audit, endorsement, safety guarantee, Registry registration, or Wallet permission.

Public testnet URLs remain deployment-specific and are tracked in `testnet/public-services/verify/readiness.json`.
