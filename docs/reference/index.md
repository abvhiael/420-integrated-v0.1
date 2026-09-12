---
title: Generated reference
audience:
  - developer
category: reference
status: current
version: current
---

# Generated reference

DOC-10 publishes machine-derived reference material for 420 Integrated. These pages are generated from implementation sources such as verified contract catalogues/build artifacts, Solidity interfaces/NatSpec, SDK and CLI source, 420Indexer API definitions, network manifests, deployment records and chain configuration.

Generated reference is **descriptive, not authoritative**. It must never replace the canonical source that owns the underlying state or behavior. If a generated page disagrees with chain state, an owning protocol contract, an approved manifest/deployment record, or verified build evidence, the canonical source wins and the reference must be regenerated or fixed at its source.

## DOC-10 reference

- [DOC-10 roadmap](DOC-10-ROADMAP.md)
- [DOC-10 coverage audit](coverage-audit.md)
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

The machine source registry is `docs/reference/reference-sources.json`. Core contract/event/source-manifest generation starts from `python scripts/generate-reference-docs.py`; all DOC-10 generated outputs are qualified together by `python scripts/qualify-generated-reference.py --check`. Use `--write` on that unified qualifier to regenerate the complete generated set.

## Task-documentation handoff

Use DOC-8 and DOC-9 for procedures, sequencing, security guidance and authority boundaries. Use DOC-10 when those task guides need exact machine-derived implementation reference.

- [Genesis application manuals and DOC-8 coverage](../apps/coverage-audit.md)
- [Developer documentation and DOC-9 coverage](../developers/coverage-audit.md)

## Reference families

DOC-10 covers:

- contracts — NatSpec, ABI status, interfaces and public/external source surfaces;
- event/error indexes — canonical signatures, indexed fields, event topics and custom-error selectors;
- RPC — public execution JSON-RPC and 420RPC-facing method reference;
- APIs — stable 420Indexer service API surfaces;
- SDK/CLI — exported SDK types/functions and stable CLI commands/options;
- network registry — chain identity, manifests and service discovery metadata;
- deployments — canonical-publication evidence rules and approved deployment status.

## Source rules

A generated page must identify its source class and provenance. The generator fails closed when required source data is missing, malformed, ambiguous, unverified or inconsistent.

Examples:

- a contract ABI is distributable only when tied to a verified build artifact/catalogue entry;
- an address is never invented from a documentation example;
- an API route is generated from the stable implementation contract, not copied by hand from prose;
- SDK/CLI reference is generated from exported source/command definitions;
- network/deployment reference remains environment-specific and never silently substitutes local values for testnet/mainnet values;
- deployment plans, predicted addresses, manifest hints, unconfirmed receipts and example catalogues never become canonical deployment records merely by appearing in generated docs.

## Generated-content rule

Generated files are not edited by hand. Human-authored explanation belongs in DOC-3 through DOC-9; DOC-10 output is regenerated from implementation sources. Each generated page carries a generated-file marker and source provenance.

420Docs Qualification recomputes all expected DOC-10 output in memory and compares committed pages byte-for-byte before the strict site build. Missing or stale generated reference fails CI, and successful qualification prints SHA-256 identities for each expected output.

## DOC-10 work order

1. **DOC-10.1 — Generation foundation and source inventory — COMPLETE**
2. **DOC-10.2 — Contract/NatSpec/ABI reference — COMPLETE**
3. **DOC-10.3 — Events and custom errors — COMPLETE**
4. **DOC-10.4 — RPC reference — COMPLETE**
5. **DOC-10.5 — 420Indexer and service API reference — COMPLETE**
6. **DOC-10.6 — SDK and CLI reference — COMPLETE**
7. **DOC-10.7 — Network and chain registry reference — COMPLETE**
8. **DOC-10.8 — Canonical deployment reference — COMPLETE**
9. **DOC-10.9 — Determinism and freshness qualification — COMPLETE**
10. **DOC-10.10 — Reference coverage audit and closeout — COMPLETE**

DOC-10 is monolithic: DOC-10.1 through DOC-10.10 merge once after the final coverage audit, reconciliation with current `main`, exact-head 420Docs qualification and exact-head full 420 Integrated qualification.
