---
title: Generated network and chain registry reference
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated network and chain registry reference

> GENERATED FILE - DO NOT EDIT. Regenerate from Developer Hub network manifests.

Sources:

- `developer-hub/manifests/*.json`
- `developer-hub/schema/network-manifest.schema.json`
- `developer-hub/src/network-discovery.mjs`

Network manifests are environment-scoped discovery records. A chain ID alone is not sufficient proof that two environments are the same network, and this page never promotes local example values into devnet, testnet or mainnet.

## Environment availability

| Environment | Checked-in manifest | Publication status |
| --- | --- | --- |
| `local` | `developer-hub/manifests/local.example.json` | available, environment-scoped |
| `devnet` | none | unavailable — fail closed |
| `testnet` | none | unavailable — fail closed |
| `mainnet` | none | unavailable — fail closed |

## local

### 420 Local Devnet

- Manifest: `developer-hub/manifests/local.example.json`
- Schema version: `1.0.0`
- Environment: `local`
- Chain ID: `420`
- Native currency: `420` / `420` / `18` decimals
- `canRequestFaucet`: **true**
- `isProduction`: **false**

#### RPC discovery

- HTTP: `http://127.0.0.1:8545`
- WebSocket: `ws://127.0.0.1:8545`

#### Service discovery

- `explorer` → `http://127.0.0.1:4201`
- `faucet` → `http://127.0.0.1:4205`
- `indexer` → `http://127.0.0.1:4202`
- `status` → `http://127.0.0.1:4204`
- `verify` → `http://127.0.0.1:4203`

#### Manifest contract hints

- `Registry420` → `0x0000000000000000000000000000000000000420`; source `deployment-manifest`, version `local-example`

Manifest contract entries are discovery hints scoped to this manifest. Canonical deployment publication remains DOC-10.8 and requires approved/verified deployment evidence.

## devnet

No checked-in `devnet` manifest exists. DOC-10 does not infer one from another environment.

## testnet

No checked-in `testnet` manifest exists. DOC-10 does not infer one from another environment.

## mainnet

No checked-in `mainnet` manifest exists. DOC-10 does not infer one from another environment.

## Manifest contract

The v1 schema permits environments `local`, `devnet`, `testnet`, and `mainnet`; requires a positive decimal chain ID and at least one HTTP RPC endpoint; fixes native symbol `420`; constrains known service names; and forbids a Faucet service in mainnet manifests.

Developer Hub discovery derives `canRequestFaucet` from a non-mainnet environment plus a declared Faucet service, and derives `isProduction` only from `environment === mainnet`.

## Authority boundary

A manifest selects an environment and discovery endpoints. It does not establish consensus, finality, balances, ownership, contract execution, or deployment truth by itself. Security-sensitive clients must bind the selected manifest to canonical chain/deployment evidence and fail closed on mismatches.
