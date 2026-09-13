---
title: Contextual-link registry schema
audience:
  - developer
  - operator
category: architecture
status: current
version: current
---

# DOC-14.2 — Contextual-link registry schema

The contextual-link registry is the machine-readable source of truth for stable runtime-to-documentation link identities. Runtime clients refer to a stable contextual-link ID and must not construct authoritative documentation routes independently.

## Stable identifiers

Canonical IDs use `CTX-<DOMAIN>-<NNN>` with an uppercase domain token and three-digit numeric suffix. Once published, an ID is never reassigned to a different semantic purpose.

Aliases may point to a canonical ID for compatibility, but aliases must be globally unique and may not collide with canonical IDs. Deprecation never changes the meaning of the original ID.

## Record fields

Each record contains:

- `status`: `active`, `deprecated` or `retired`;
- `source_surfaces`: one or more stable runtime/application surface identifiers;
- `target_type`: one of `task`, `concept`, `reference` or `troubleshooting`;
- `audience`: one or more of `user`, `developer` or `operator`;
- `environments`: the documentation environments in which the semantic target may be authoritative;
- `target.path`: repository-relative path under `docs/`;
- `target.anchor`: optional stable heading anchor within the target page;
- `aliases`: optional compatibility identifiers that resolve to the canonical record;
- `replacement`: optional canonical contextual-link ID used when a deprecated/retired record has an explicit successor.

## Status semantics

`active` records are eligible for normal resolution when DOC-13 publishes the requested environment/version.

`deprecated` records preserve their original meaning and may provide an explicit `replacement`. Clients may surface the replacement, but must not silently redefine the deprecated ID.

`retired` records are not authoritative targets. A retired record may name an explicit replacement. If no replacement is declared, resolution fails closed.

## Environment semantics

The record-level `environments` list describes where the target is semantically valid; it does not itself publish an environment. DOC-13 remains the publication authority.

Therefore a registry record that includes `testnet` or `mainnet` still resolves unavailable until the corresponding DOC-13 track/release is published. Resolver behavior must never infer publication from registry membership.

## Target paths and anchors

`target.path` is relative to the `docs/` root, must not be absolute, and must not escape the documentation tree.

Anchors are stored without a leading `#`. Troubleshooting records that target a specific DOC-11 entry should use the stable heading anchor containing the permanent `TRB-*` ID wherever possible.

Target existence and published-route/anchor enforcement are strengthened in DOC-14.8. DOC-14.2 validation guarantees deterministic registry structure, identifier stability, legal field values, local target-path validity and alias/replacement integrity.

## Resolver contract

A resolver receives a canonical or aliased contextual-link ID plus an active DOC-13 environment/version context. It first resolves the registry identity, then checks status, environment eligibility and version publication before constructing a URL.

The registry never authorizes cross-environment fallback, mutable historical release substitution or use of flat compatibility routes as environment authority.
