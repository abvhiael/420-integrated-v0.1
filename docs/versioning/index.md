---
title: Documentation Versioning
category: contributing
status: active
version: current
---

# Documentation Versioning

DOC-13 defines how 420Docs distinguishes development, Genesis, testnet and mainnet documentation, how historical versions remain addressable, and how generated reference and rendered navigation stay bound to the correct release/environment authority.

## Goals

- make the documentation context visible and machine-checkable;
- prevent local/example/development material from being mistaken for canonical testnet or mainnet documentation;
- preserve stable historical release documentation rather than silently rewriting it;
- provide predictable version/environment URL and navigation behavior;
- couple generated reference to the source/release context that produced it;
- extend DOC-12 CI so versioning rules fail closed when they drift.

## Authority model

[Documentation version authority contract](version-authority-contract.md) defines release/lifecycle version, environment and publication status and the fail-closed rules that prevent one context from masquerading as another.

## Version metadata

[Documentation version metadata schema](version-metadata-schema.md) defines the atomic `doc_release`, `doc_environment`, `publication_status` tuple. Existing `version: current` pages remain compatible during migration without gaining implied environment or immutable-release authority.

## Version registry

[Documentation version registry contract](version-registry-contract.md) and `version-registry.json` define publication tracks, current aliases and immutable release manifests. Development and Genesis are published documentation tracks; testnet and mainnet remain unavailable until approved evidence exists.

## URL, renderer and navigation

[Documentation URL and renderer version model](url-renderer-contract.md) defines version-qualified routes. [Navigation and version selector contract](navigation-selector-contract.md) defines visible context and same-page switching.

- immutable releases use `/versions/<environment>/<release>/<path>`;
- moving aliases use `/versions/<environment>/current/<path>`;
- unknown, unpublished or missing version/page combinations fail closed;
- selector targets are enabled only when the target context proves the same page exists;
- existing audience navigation remains intact.

The Pages build generates `version-context.json` and injects the version selector after the strict MkDocs build.

## Historical retention

[Historical documentation retention and archival contract](historical-retention-contract.md) defines when documentation becomes an immutable snapshot, how `current` may move, and how superseded releases remain available without silently inheriting newer behavior.

`historical-retention-policy.json` and `scripts/validate-doc-historical-retention.py` enforce the machine-checkable rules. Historical/deprecated banner text is renderer metadata so support notices can change without rewriting the technical snapshot itself. Stable troubleshooting identifiers remain attributable to the historical release in which they appeared.

## Generated reference coupling

[Generated reference version coupling](generated-reference-version-contract.md) binds DOC-10 generated outputs to the release/environment that produced them.

The checked-in `docs/reference/generated/` set is explicitly **development-scoped live reference**. Immutable releases must either own a frozen generated-reference snapshot with exact SHA-256 provenance for every governed output or declare generated reference unavailable.

Current state:

- development — live DOC-10 generated reference;
- Genesis — generated reference unavailable until a frozen Genesis snapshot with hashes is materialized;
- testnet — unpublished;
- mainnet — unpublished.

## Migration compatibility

[Documentation migration contract](redirect-migration-contract.md) and `migration-policy.json` govern compatibility between flat legacy routes and version-qualified routes.

There are currently no automatic mappings. Legacy flat URLs remain compatibility-only; missing pages do not fall through to `current`; cross-environment and cross-release mappings are disabled; and routes without a materially equivalent target remain unresolved or explicitly retired. Stable deep-link anchors and troubleshooting identifiers retain their semantic identity.

## Phase roadmap

See [DOC-13 documentation versioning roadmap](DOC-13-ROADMAP.md).

## Current state

DOC-13.1 through DOC-13.8 are complete. Next is DOC-13.9 — versioning CI and publication safety.
