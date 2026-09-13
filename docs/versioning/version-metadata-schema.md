---
title: Documentation version metadata schema
audience:
  - developer
  - operator
category: contributing
status: current
version: current
doc_release: development
doc_environment: development
publication_status: development
---

# Documentation version metadata schema

DOC-13.2 introduces a normalized machine-governed metadata tuple for documentation version identity while preserving the existing `version: current` corpus during migration.

## Governed tuple

A page that opts into DOC-13 version identity uses all three fields together:

```yaml
doc_release: development
doc_environment: development
publication_status: development
```

The fields are independent dimensions and must not be inferred from one another.

### `doc_release`

Identifies the release/lifecycle documentation describes. It is a lowercase identifier using letters, digits, `.`, `_` or `-`, up to 64 characters.

Reserved labels are:

- `development` — mutable repository-head documentation;
- `current` — mutable resolver alias, never an immutable historical identity;
- `genesis` — the frozen Genesis lifecycle contract.

Later DOC-13 release manifests may introduce immutable identifiers such as testnet or mainnet release IDs. An immutable release ID must remain bound to one release record once published.

### `doc_environment`

Allowed values:

- `development`
- `genesis`
- `testnet`
- `mainnet`

The environment states where claims apply; it does not itself prove deployment authority.

### `publication_status`

Allowed values:

- `development` — mutable/unreleased documentation;
- `current` — supported published documentation for its track;
- `historical` — immutable retained release documentation;
- `deprecated` — retained but no longer recommended;
- `unpublished` — known to tooling but not advertised as supported documentation.

## Completeness rule

The DOC-13 tuple is atomic. If any of `doc_release`, `doc_environment` or `publication_status` appears, all three must appear.

A partial tuple fails qualification. This prevents a renderer or integration from guessing the missing authority dimension.

## Compatibility with `version: current`

The existing `version` field remains part of the DOC-12 front-matter contract during DOC-13 migration.

A page containing only:

```yaml
version: current
```

remains valid as a legacy compatibility page. It does **not** gain an inferred `doc_environment`, immutable release identity or live-network authority.

New version-aware pages should use the complete DOC-13 tuple. DOC-13 does not require a repository-wide metadata rewrite before the registry and renderer are ready.

## Compatibility rules

Machine validation currently enforces these invariants:

- `historical` and `deprecated` pages cannot use mutable release aliases such as `current` or `development`;
- a `development` environment uses `development` or `current` release context while migration is active;
- `testnet` and `mainnet` environments cannot use `development` or `genesis` as their release identity;
- the `genesis` release cannot be bound to the `development` environment;
- invalid release syntax, unknown environments, unknown publication states and incomplete tuples fail closed.

These checks establish structural compatibility only. DOC-13.3 adds the release registry that determines whether a syntactically valid release identifier is actually approved and publishable.

## Aliases versus immutable identifiers

`current` and `development` are mutable aliases. They may resolve differently over time and therefore cannot identify an immutable historical snapshot.

`genesis` is a reserved lifecycle label. Its exact immutable publication evidence is established by the version registry/release manifest layer.

Other immutable release identifiers are registry-owned. A page must not invent an identifier and treat syntax validation as publication approval.

## Machine ownership

The machine policy lives at:

- `docs/versioning/version-metadata-policy.json`

The deterministic validator is:

```bash
python scripts/validate-doc-version-metadata.py
```

The validator reads the existing DOC-12 governed documentation roots plus `docs/versioning`, validates any complete DOC-13 tuples it finds, and accepts existing `version: current` pages under the explicit migration compatibility rule.

## Migration rule

Migration proceeds page-by-page or release-by-release. A page becomes DOC-13-aware only when its complete tuple is added from approved context.

Do not bulk-fill environment or release metadata by guessing from filenames, prose, application names, current deployment assumptions or repository location. Where release/environment authority is unknown, retain the legacy compatibility state until DOC-13.3 provides approved registry evidence.
