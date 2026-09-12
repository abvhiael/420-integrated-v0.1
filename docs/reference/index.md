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

The machine source registry is `docs/reference/reference-sources.json`; generation is performed by `python scripts/generate-reference-docs.py`, with `--check` reserved for deterministic stale-output verification.

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
- network/deployment reference must remain environment-specific and must not silently substitute local values for testnet/mainnet values.

## Generated-content rule

Generated files are not edited by hand. Human-authored explanation belongs in DOC-3 through DOC-9; DOC-10 output is regenerated from implementation sources. Each generated page carries a generated-file marker and source provenance.

## DOC-10 work order

1. **DOC-10.1 — Generation foundation and source inventory — COMPLETE** — generated-reference contract, source classes, output layout, provenance model, deterministic-generation rules, source registry, generator entry point and first generated source manifest.
2. **DOC-10.2 — Contract/NatSpec/ABI reference — COMPLETE** — generated contract catalogue/source reference with NatSpec extraction, public/external source surfaces, ABI provenance/status and fail-closed handling when artifact/hash/interface evidence is incomplete or only example-grade.
3. **DOC-10.3 — Events and custom errors** — per-contract and global event/error indexes with signatures/topics/selectors where derivable.
4. **DOC-10.4 — RPC reference** — public execution JSON-RPC and 420RPC ingress/gateway reference, excluding private Engine/admin/signer surfaces.
5. **DOC-10.5 — 420Indexer and service API reference** — stable API routes, parameters, envelopes, pagination/cursor and status/readiness surfaces.
6. **DOC-10.6 — SDK and CLI reference** — exported SDK types/functions plus stable CLI commands/options and authority boundaries.
7. **DOC-10.7 — Network and chain registry reference** — chain identity, manifests, service endpoints and environment-scoped registry data.
8. **DOC-10.8 — Canonical deployment reference** — deployment/catalogue records, versions, provenance, verified artifact identities and approved addresses.
9. **DOC-10.9 — Determinism and freshness qualification** — regeneration check, stale-output detection, source/output hashes and generator-specific CI qualification.
10. **DOC-10.10 — Reference coverage audit and closeout** — verify all required generated families, task-guide cross-links, provenance markers, environment boundaries and phase exit criteria.

DOC-10 is monolithic: DOC-10.1 through DOC-10.10 remain on one branch/PR and merge once after the final coverage audit, reconciliation with current `main`, exact-head 420Docs qualification and exact-head full 420 Integrated qualification.
