---
title: DOC-10 source inventory
audience:
  - developer
category: reference
status: development
version: current
---

# DOC-10 source inventory

DOC-10.1 inventories the machine-readable sources that can safely drive generated 420Docs reference output. This inventory records what exists now and where later DOC-10 subphases must avoid inventing unavailable production data.

## Contract catalogue and ABI boundary

Developer Hub already defines a contract-catalogue schema and validation path in `developer-hub/src/contract-catalogue.mjs`. Catalogue entries are chain-scoped and include canonical name/protocol identity, address, provenance source, semantic version, deployment block, artifact path, interface path, ABI SHA-256 identity and verification state.

The checked-in catalogue directory currently contains:

- `developer-hub/catalogue/local.example.json`

This is a **local example catalogue only**. DOC-10 must not fabricate or promote it into testnet/mainnet deployment reference.

The Developer Hub contract-catalogue contract requires distributable entries to be verified and ABI identities to be pinned by SHA-256. Duplicate names/addresses and unknown entries fail closed.

## Solidity/build-artifact sources

Primary contract reference sources are:

- Solidity implementation/interface sources under the repository contract trees;
- verified build artifacts referenced by approved catalogue/deployment metadata;
- NatSpec embedded in Solidity/artifact metadata where available.

DOC-10.2 will determine the exact supported artifact discovery/build path and must not publish an ABI solely because an arbitrary artifact file exists.

## 420Indexer/API sources

420Indexer exposes dedicated machine-readable implementation surfaces, including:

- `420-indexer/src/api-contract.ts`
- `420-indexer/src/api-surface.ts`
- `420-indexer/src/abi-manifest.ts`
- event/canonicality/subscription/transport source files under `420-indexer/src/`

These are appropriate sources for stable API route/envelope and projection/event-delivery reference. Generated Indexer reference must preserve the non-authoritative/rebuildable projection boundary.

## SDK sources

The shared SDK currently exposes source through:

- `packages/420-sdk/src/index.ts`
- `packages/420-sdk/src/wallet.ts`

DOC-10.6 will generate exported types/functions and Wallet integration surfaces from these source exports rather than copying prose from DOC-9.

## CLI sources

The canonical CLI package is `packages/420-cli`. DOC-10.6 will derive stable commands/options from its command definitions and package metadata. The generated CLI reference must preserve the existing non-custodial rule: CLI reference cannot imply possession of user private keys, seed phrases or autonomous signing authority.

## Network and environment sources

Developer Hub manifests under `developer-hub/manifests/` are the machine source for environment/service discovery reference. The repository previously established that only a local example manifest is checked in today; DOC-10.7 must therefore leave public testnet/mainnet values absent until approved manifests exist.

Network reference must retain:

- explicit environment;
- chain ID;
- native asset metadata;
- service/RPC endpoints when supplied by the approved manifest;
- manifest provenance/source identity.

Chain ID alone is not environment proof.

## Deployment sources

Deployment reference may be generated only from approved sources such as:

- canonical genesis/predeploy configuration;
- governed/Registry-derived deployment state or approved manifests;
- Developer Hub deployment/release records that preserve canonical provenance;
- verified contract-catalogue entries.

DOC-10.8 must distinguish predicted/planned addresses from canonically deployed/confirmed addresses and must not treat a Developer Hub record as deployment authority on its own.

## RPC sources

Public execution JSON-RPC reference is derived from the actually supported public method surface and qualification fixtures. Private Engine API, validator signing, admin/debug or other privileged methods are excluded from the public reference unless a separate operator-only reference explicitly requires them.

420RPC remains an ingress/gateway layer and does not create new protocol methods or consensus authority.

## Events and errors

Contract events/custom errors are generated from verified ABI/artifact inputs. Service/SDK/CLI errors are generated only where a stable machine-readable identifier or implementation contract exists.

DOC-10.3 will build both per-source pages and global searchable event/error indexes without inventing stable codes for free-form runtime strings.

## Current availability matrix

| Family | Machine source exists now | Environment/production caveat | DOC-10 phase |
| --- | --- | --- | --- |
| Contract catalogue schema | yes | checked-in catalogue is local example only | 10.2 / 10.8 |
| Verified contract ABI/NatSpec | source/build pipeline exists | distributable output must be tied to verified artifact metadata | 10.2 |
| Contract events/errors | yes through ABI/artifacts | same verified-artifact requirement | 10.3 |
| Public RPC | yes | public surface only; no Engine/admin leakage | 10.4 |
| 420Indexer API | yes | projections remain non-authoritative | 10.5 |
| SDK | yes | source exports are reference source | 10.6 |
| CLI | yes | no signer-secret/autonomous-signing implication | 10.6 |
| Network manifests | local example exists | no invented public testnet/mainnet values | 10.7 |
| Deployment/catalogue reference | local/example + deployment machinery exists | publish only approved canonical/verified records | 10.8 |

## Inventory rule

If a later DOC-10 generator cannot prove source provenance for an item, that item is omitted or generation fails. Missing data is preferable to plausible-looking invented reference data.
