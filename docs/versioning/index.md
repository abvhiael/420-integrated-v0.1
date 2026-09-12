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

[Documentation version authority contract](version-authority-contract.md) defines the three independent versioning dimensions—release/lifecycle version, environment and publication status—and the fail-closed rules that prevent one context from masquerading as another.

Key rule: labels such as `genesis`, `testnet` and `mainnet` do not create network/deployment authority by themselves. Canonical values remain dependent on approved source evidence and, once DOC-13.3 is complete, an approved documentation release record.

## Version metadata

[Documentation version metadata schema](version-metadata-schema.md) defines the normalized DOC-13 tuple:

- `doc_release`
- `doc_environment`
- `publication_status`

The tuple is atomic: if one field is present, all three are required. Existing pages containing only `version: current` remain valid during migration, but that legacy field does not imply an environment or immutable release identity.

Machine policy lives in `version-metadata-policy.json`, and the same documentation CI gate validates it with:

```bash
python scripts/validate-doc-version-metadata.py
```

## Phase roadmap

See [DOC-13 documentation versioning roadmap](DOC-13-ROADMAP.md).

## Current state

DOC-13.1 and DOC-13.2 are complete. Next is DOC-13.3 — version registry and release manifests.
