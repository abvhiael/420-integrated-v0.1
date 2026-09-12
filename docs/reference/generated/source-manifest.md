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
Source registry SHA-256: `86c44f4b520a6b501ac76fcfc89e3b2be396b9a8aa9fc09f6c0c0c17e6de8a6c`

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
| `indexer-api` | `DOC-10.5` | `420-indexer/src/api-contract.ts` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/api-surface.ts` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/http-transport.ts` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/operational-api.ts` | file |
| `indexer-api` | `DOC-10.5` | `420-indexer/src/query-layer.ts` | file |
| `networks` | `DOC-10.7` | `developer-hub/manifests` | directory |
| `rpc` | `DOC-10.4` | `420-rpc/src/methods.ts` | file |
| `rpc` | `DOC-10.4` | `420-rpc/src/request-policy.ts` | file |
| `sdk-cli` | `DOC-10.6` | `packages/420-cli/bin/420.mjs` | file |
| `sdk-cli` | `DOC-10.6` | `packages/420-cli/package.json` | file |
| `sdk-cli` | `DOC-10.6` | `packages/420-sdk/package.json` | file |
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

Stable public read API only. 420Indexer projections remain derived, rebuildable and non-authoritative; generated reference must preserve authoritative:false and readiness/finality provenance.

### networks

Environment-scoped only; do not promote local example values into testnet/mainnet reference.

### rpc

Public 420RPC compatibility and request-policy reference only; private Engine/admin/personal/debug/miner/txpool and node-managed account/signing surfaces remain excluded.

### sdk-cli

Generate SDK exports and the stable primary 420 CLI command surface from implementation source. Preserve network/catalogue binding, signer-secret isolation and the rule that SDK/CLI convenience layers do not gain protocol authority.
