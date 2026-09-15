---
title: DOC-10 source inventory
audience:
  - developer
category: reference
status: current
version: current
---

# DOC-10 source inventory

DOC-10 inventories the machine-readable sources that drive generated 420Docs reference output. This inventory records what exists now and where generation must fail closed rather than invent unavailable production data.

## Source families

| Family | Primary sources | Current publication boundary |
| --- | --- | --- |
| contracts | `developer-hub/src/contract-catalogue.mjs`, `developer-hub/catalogue/local.example.json`, `contracts/src` | local/example catalogue only; distributable ABI fails closed until qualified artifact/hash/interface evidence exists |
| events/errors | catalogue-bounded Solidity source | publish canonical signatures/topics/selectors only when types normalize unambiguously |
| public RPC | `420-rpc/src/methods.ts`, `420-rpc/src/request-policy.ts` | explicit public compatibility surface only; Engine/admin/signer namespaces excluded |
| 420Indexer API | stable route/transport/query/operational sources under `420-indexer/src` | read-only rebuildable projection API; `authoritative: false` preserved |
| SDK/CLI | `packages/420-sdk` and primary `packages/420-cli/bin/420.mjs` | convenience/integration surface only; signer-secret isolation preserved |
| networks | `developer-hub/manifests/local.example.json`, manifest schema, network discovery implementation | only local example is checked in; devnet/testnet/mainnet remain unavailable/fail-closed |
| deployments | checked-in catalogue/deployment/release examples plus deployment/verification controls | zero canonical deployment rows until RPC-confirmed/qualified/approved evidence exists |

## Contract catalogue and ABI boundary

The checked-in catalogue is `developer-hub/catalogue/local.example.json`. It is local/example scope only. Its declared build artifact and interface are not checked in, and its ABI SHA-256 value is placeholder-grade, so DOC-10 does not publish a distributable ABI from that record.

## Events and errors

Contract events/custom errors are generated from catalogue-bounded Solidity source. Canonical signatures, indexed positions, event topics and custom-error selectors are published only when source types normalize unambiguously. Ambiguous/user-defined types fail closed rather than being guessed.

## Public RPC

Public 420RPC reference comes from `420-rpc/src/methods.ts` and `420-rpc/src/request-policy.ts`. Private Engine API, admin/debug/miner/txpool/personal namespaces and node-managed account/signing methods are excluded from public reference.

## 420Indexer/API sources

420Indexer reference comes from the stable route, transport, query and operational implementation sources. The generated reference preserves its rebuildable/non-authoritative projection boundary and `authoritative: false` status semantics.

## SDK and CLI sources

The shared SDK reference comes from `packages/420-sdk/package.json`, `src/index.ts` and `src/wallet.ts`. The primary CLI reference comes from `packages/420-cli/package.json` and `bin/420.mjs`. Generated reference preserves explicit network/catalogue binding and does not imply possession of private keys, seed phrases, mnemonics or autonomous signing authority.

## Network and environment sources

Only `developer-hub/manifests/local.example.json` is currently checked in. The schema/discovery implementation permits `local`, `devnet`, `testnet` and `mainnet`, but DOC-10 publishes only the available local example and reports the other environments unavailable instead of inferring them from chain ID `420` or localhost values.

Chain ID alone is not environment proof.

## Deployment sources

Deployment reference uses the checked-in local/example catalogue, example deployment request, example release candidate, deployment-control implementation and verification-control implementation. Plans remain `canonicalDeploymentProof: false`; recorded receipts still require canonical RPC confirmation; 420Verify remains reproducibility evidence rather than audit/registration/protocol authority. No canonical deployment row is currently publishable.

## Current limitations are explicit

The repository intentionally does **not** fabricate missing production/reference data:

- no official devnet/testnet/mainnet network manifests are checked in;
- no approved canonical deployment catalogue is checked in;
- the current contract catalogue is example scoped;
- its declared build artifact/interface are absent;
- its ABI SHA-256 is placeholder grade;
- deployment/release inputs currently checked in are examples, not canonical authority.

Those conditions are rendered as unavailable/fail-closed states rather than silently replaced with local/example values.

## Freshness and determinism

`scripts/qualify-generated-reference.py --check` recomputes all eight generated DOC-10 outputs from the listed sources and compares them byte-for-byte with the committed pages. A missing or stale page fails 420Docs Qualification. Successful qualification emits a deterministic SHA-256 identity for every expected output.

Use `python scripts/qualify-generated-reference.py --write` to regenerate the complete output set after a source change.

See the [DOC-10 coverage audit](coverage-audit.md) for the final family, authority, provenance, environment and DOC-8/DOC-9 handoff audit.
