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

Key rule: labels such as `genesis`, `testnet` and `mainnet` do not create network/deployment authority by themselves. Canonical values remain dependent on approved source evidence and an approved documentation release record.

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

## Version registry

[Documentation version registry contract](version-registry-contract.md) defines publication routing, release manifests, aliases and fail-closed behavior. The canonical machine registry is `version-registry.json`.

Current publication state:

- **development** — published; mutable repository-head documentation;
- **Genesis** — published; immutable frozen Genesis documentation contract;
- **testnet** — unavailable until an approved testnet documentation release and evidence manifest exist;
- **mainnet** — unavailable until an approved mainnet documentation release and evidence manifest exist.

The registry validator runs through the normal documentation qualification gate:

```bash
python scripts/validate-doc-version-registry.py
```

Neither the Genesis registry record nor its manifest claims a live network or canonical deployment. Live testnet/mainnet authority remains unavailable until the required evidence exists.

## URL and renderer model

[Documentation URL and renderer version model](url-renderer-contract.md) defines stable version-qualified routing.

- immutable releases use `/versions/<environment>/<release>/<path>`;
- moving aliases use `/versions/<environment>/current/<path>` and resolve only through the registry;
- unknown, unpublished or missing version/page combinations fail closed rather than falling through to current or another environment;
- existing flat URLs remain compatibility surfaces until DOC-13.8 defines explicit redirects/migration.

Machine policy is `url-renderer-policy.json`. `scripts/render-doc-version-context.py` resolves version routes and generates the deployed `site/version-context.json` runtime manifest after the MkDocs build. `scripts/validate-doc-version-routing.py` exercises the same resolver in the unified qualification gate.

The renderer context exposes only registry-approved published tracks and release routes; it does not create network or deployment authority.

## Phase roadmap

See [DOC-13 documentation versioning roadmap](DOC-13-ROADMAP.md).

## Current state

DOC-13.1 through DOC-13.4 are complete. Next is DOC-13.5 — navigation and version selector.
