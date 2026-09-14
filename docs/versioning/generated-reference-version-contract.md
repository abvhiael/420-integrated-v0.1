---
title: Generated Reference Version Coupling
category: contributing
status: active
version: current
---

# Generated Reference Version Coupling

DOC-13.7 binds DOC-10 generated reference to the documentation release and environment that produced it. Generated output is never environment-neutral: a file may be byte-current for its source tree and still be unsafe to publish as another environment's reference.

## Core rule

Every published documentation release manifest declares a `generated_reference` state.

- `live` means the release consumes the checked-in `docs/reference/generated/` outputs directly. This mode is allowed only for the mutable `development` release.
- `snapshot` means an immutable release owns a frozen copy of generated reference plus recorded SHA-256 identities for every governed generated output.
- `unavailable` means no generated reference has been approved for that release. Renderers and selectors must fail closed rather than borrowing another release's generated files.

The checked-in DOC-10 generated outputs are currently **development-scoped**. They may describe unavailable testnet/mainnet state, but their presence does not create testnet/mainnet authority.

## Development coupling

`development` is mutable and may regenerate DOC-10 outputs whenever governed source inputs change. DOC-10 freshness remains authoritative for byte-for-byte regeneration. DOC-13 adds the release/environment label and prevents those outputs from being advertised as another release.

The development manifest must identify:

- environment `development`;
- mode `live`;
- source registry `docs/reference/reference-sources.json`;
- generated root `docs/reference/generated`;
- all eight governed DOC-10 outputs;
- `network_authority: false` and `deployment_authority: false` unless separately approved evidence changes the release contract.

## Immutable release coupling

An immutable release may not point at the mutable live generated directory as its historical reference. It must either:

1. publish a release-owned snapshot with a provenance manifest containing SHA-256 identities for every governed output; or
2. declare generated reference `unavailable`.

Once a snapshot is published, its output bytes and hashes are part of the immutable historical record. A later generator change creates a new release snapshot; it does not rewrite the old one.

## Environment safety

Generated development/example/local data must not be promoted into `genesis`, `testnet`, or `mainnet` reference by aliases, route fallback, renderer fallback, or metadata alone.

A release requesting `snapshot` mode must have:

- `immutable: true`;
- a snapshot root owned by that release;
- a provenance JSON file;
- exact SHA-256 identities for all governed generated outputs;
- matching release/environment metadata.

Unknown or missing provenance fails closed.

## Current state

- `development`: live generated reference, sourced from the checked-in DOC-10 outputs.
- `genesis`: generated reference unavailable until a frozen Genesis snapshot is materialized and hashed.
- `testnet`: unpublished; no generated reference may be advertised.
- `mainnet`: unpublished; no generated reference may be advertised.

This does not change DOC-10 ownership of generation and freshness. DOC-10 proves that generated files match current source inputs; DOC-13 proves that publication uses those files only in the release/environment context they are approved for.
