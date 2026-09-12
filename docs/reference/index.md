---
title: Generated reference
audience:
  - developer
category: reference
status: development
version: current
---

# Generated reference

DOC-10 publishes machine-derived reference material for 420 Integrated. These pages are generated from implementation sources such as verified contract catalogues/build artifacts, Solidity interfaces/NatSpec, SDK and CLI source, 420Indexer API definitions, network manifests, deployment records and chain configuration.

Generated reference is **descriptive, not authoritative**. It must never replace the canonical source that owns the underlying state or behavior. If a generated page disagrees with chain state, an owning protocol contract, an approved manifest/deployment record, or verified build evidence, the canonical source wins and the reference must be regenerated or fixed at its source.

## DOC-10 foundation

- [DOC-10 roadmap](DOC-10-ROADMAP.md)
- [Generated reference model](generation-model.md)
- [Source inventory](source-inventory.md)
- [Generated source manifest](generated/source-manifest.md)
- [Generated contract, NatSpec and ABI reference](generated/contracts.md)
- [Generated events and custom errors](generated/events-errors.md)
- [Generated public RPC reference](generated/rpc.md)
- [Generated 420Indexer API reference](generated/indexer-api.md)
- [Generated SDK and CLI reference](generated/sdk-cli.md)
- [Generated network and chain registry reference](generated/networks.md)
- [Generated canonical deployment reference](generated/deployments.md)

The machine source registry is `docs/reference/reference-sources.json`; generation starts from `python scripts/generate-reference-docs.py`. Family renderers are being consolidated into unified `--check` freshness qualification in DOC-10.9.

## Reference families

DOC-10 is organized into these generated families:

- contracts — NatSpec, ABI, interfaces, functions, events and custom errors;
- RPC — public execution JSON-RPC and 420RPC-facing method reference;
- APIs — 420Indexer and other stable service API surfaces;
- SDK/CLI — exported SDK types/functions and stable CLI commands/options;
- network registry — chain identity, manifests and service discovery metadata;
- deployments — canonical/approved deployment records and contract catalogue metadata;
- event/error indexes — cross-contract and cross-service searchable indexes;
- application/protocol links — generated deep links from DOC-8/DOC-9 task guides into the relevant reference entries.

## Source rules

A generated page must identify its source class and provenance. The generator must fail closed when required source data is missing, malformed, ambiguous, unverified or inconsistent.

Examples:

- a contract ABI is distributable only when tied to a verified build artifact/catalogue entry;
- an address is never invented from a documentation example;
- an API route is generated from the stable implementation contract, not copied by hand from prose;
- SDK/CLI reference is generated from exported source/command definitions;
- network/deployment reference must remain environment-specific and must not silently substitute local values for testnet/mainnet values;
- deployment plans, predicted addresses, manifest hints, unconfirmed receipts and example catalogues never become canonical deployment records merely by appearing in generated docs.

## Generated-content rule

Generated files are not edited by hand. Human-authored explanation belongs in DOC-3 through DOC-9; DOC-10 output is regenerated from implementation sources. Each generated page carries a generated-file marker and source provenance.

## DOC-10 work order

1. **DOC-10.1 — Generation foundation and source inventory — COMPLETE**
2. **DOC-10.2 — Contract/NatSpec/ABI reference — COMPLETE**
3. **DOC-10.3 — Events and custom errors — COMPLETE**
4. **DOC-10.4 — RPC reference — COMPLETE**
5. **DOC-10.5 — 420Indexer and service API reference — COMPLETE**
6. **DOC-10.6 — SDK and CLI reference — COMPLETE**
7. **DOC-10.7 — Network and chain registry reference — COMPLETE**
8. **DOC-10.8 — Canonical deployment reference — COMPLETE**
9. **DOC-10.9 — Determinism and freshness qualification**
10. **DOC-10.10 — Reference coverage audit and closeout**

DOC-10 is monolithic: DOC-10.1 through DOC-10.10 remain on one branch/PR and merge once after the final coverage audit, reconciliation with current `main`, exact-head 420Docs qualification and exact-head full 420 Integrated qualification.
