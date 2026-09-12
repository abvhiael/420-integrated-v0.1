---
title: Generated reference source manifest
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated reference source manifest

> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.

Generator schema: `1.0.0`  
Source registry: `docs/reference/reference-sources.json`  
Source registry SHA-256: `62163571bc6613ae0205cdd6301280b4dacaa194903f0b56da3d83131c5b1c37`

This manifest records the checked-in source locations used by DOC-10 renderers. Presence is not authority: later family renderers must still enforce verification, environment and provenance rules before publishing distributable reference values.

| Family | Phase | Source | Kind |
| --- | --- | --- | --- |
| `contracts` | `DOC-10.2` | `contracts/src` | directory |
| `contracts` | `DOC-10.2` | `developer-hub/catalogue/local.example.json` | file |
| `contracts` | `DOC-10.2` | `developer-hub/src/contract-catalogue.mjs` | file |
| `deployments` | `DOC-10.8` | `developer-hub/catalogue` | directory |
| `deployments` | `DOC-10.8` | `developer-hub/deployment` | directory |
| `deployments` | `DOC-10.8` | `developer-hub/release` | directory |
| `events-errors` | `DOC-10.3` | `contracts/src` | directory |
| `events-errors` | `DOC-10.3` | `developer-hub/src/contract-catalogue.mjs` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/abi-manifest.ts` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/api-contract.ts` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/api-surface.ts` | file |
| `networks` | `DOC-10.7` | `developer-hub/manifests` | directory |
| `rpc` | `DOC-10.4` | `420-rpc/src/methods.ts` | file |
| `rpc` | `DOC-10.4` | `420-rpc/src/request-policy.ts` | file |
| `sdk-cli` | `DOC-10.6` | `packages/420-cli` | directory |
| `sdk-cli` | `DOC-10.6` | `packages/420-sdk/src/index.ts` | file |
| `sdk-cli` | `DOC-10.6` | `packages/420-sdk/src/wallet.ts` | file |

## Family notes

### contracts

Distributable ABI/NatSpec output requires verified artifact/catalogue provenance; the checked-in catalogue is local example scope only.

### deployments

Publish approved canonical/verified deployment records only; planned/predicted addresses are not deployment proof.

### events-errors

Generate contract events/custom errors only from verified ABI/artifact inputs.

### indexer-api

420Indexer projections remain derived, rebuildable and non-authoritative.

### networks

Environment-scoped only; do not promote local example values into testnet/mainnet reference.

### rpc

Public 420RPC compatibility and request-policy reference only; private Engine/admin/personal/debug/miner/txpool and node-managed account/signing surfaces remain excluded.

### sdk-cli

Generated SDK/CLI reference must preserve signer-secret isolation and non-authority boundaries.
