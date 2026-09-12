---
title: Generated canonical deployment reference
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated canonical deployment reference

> GENERATED FILE - DO NOT EDIT. Current output fails closed unless deployment evidence satisfies the publication contract.

## Evidence sources

- `developer-hub/catalogue/local.example.json`
- `developer-hub/deployment/request.example.json`
- `developer-hub/release/release-candidate.example.json`
- `developer-hub/src/deployment-control.mjs`
- `developer-hub/src/verification-control.mjs`

## Canonical publication contract

A row is publishable here only when all of the following are available and mutually consistent:

1. environment/chain identity is selected explicitly;
2. a deployment receipt has been confirmed from canonical chain RPC;
3. contract address and runtime code hash are bound to that confirmed receipt/state;
4. build/source evidence is qualified and the relevant artifact/ABI identity is verified;
5. verification evidence reaches the required reproducibility class where verification is claimed;
6. Registry/governance/deployment provenance is approved for the published version;
7. the record is not merely an example, plan, predicted address, manifest hint, or unconfirmed receipt.

Deployment-control plans explicitly set `canonicalDeploymentProof: false`; recording a receipt still sets `requiresRpcConfirmation: true`. 420Verify results remain evidence only: they are not audits, official registration, Wallet authority, or canonical protocol state.

## Publishable canonical deployments

**None currently available from checked-in evidence.**

The repository currently contains example-scoped deployment, release and catalogue inputs only. DOC-10 therefore refuses to publish any address as a canonical devnet/testnet/mainnet deployment.

## Example catalogue records withheld from canonical publication

| Contract | Chain | Address | Version | Deployment block | Declared source | Why withheld |
| --- | --- | --- | --- | ---: | --- | --- |
| `ProtocolRegistry` | `420` | `0x0000000000000000000000000000000000000420` | `1.0.0` | 0 | `genesis` | catalogue file is `local.example.json`; declared artifact/interface are not checked in and ABI hash is example-grade, so this is not distributable canonical deployment evidence |

## Status by environment

| Environment | Canonical deployment reference |
| --- | --- |
| local | unavailable as canonical publication; only example-scoped records are checked in |
| devnet | unavailable — no approved canonical deployment records checked in |
| testnet | unavailable — no approved canonical deployment records checked in |
| mainnet | unavailable — no approved canonical deployment records checked in |
