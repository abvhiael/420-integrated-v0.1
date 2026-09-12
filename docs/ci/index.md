---
title: Documentation CI
category: contributing
status: active
version: current
---

# Documentation CI

This section documents the automated qualification rules that protect 420Docs structure, discoverability, generated-reference freshness and publication safety.

## Current qualification gate

Run the same gate locally that GitHub Actions runs:

```bash
python scripts/qualify-documentation.py
```

The current deterministic stage order is:

1. governed front-matter validation;
2. governed internal-link and anchor validation;
3. stable troubleshooting-ID validation;
4. DOC-10 generated-reference freshness;
5. strict MkDocs build;
6. audience navigation and search-index qualification.

DOC-12 continues to extend this runner with orphan/coverage and narrowly scoped publication-safety checks.

## Front-matter policy

`docs/ci/frontmatter-policy.json` defines which documentation roots are governed, the required metadata fields, accepted category/status/audience vocabulary and the explicit legacy paths allowed to omit front matter.

Legacy compatibility is intentionally narrow: a matching legacy page may omit front matter, but if front matter exists it is still fully validated. New governed pages should carry valid metadata rather than expanding the legacy exception set.

The direct diagnostic command is:

```bash
python scripts/validate-doc-frontmatter.py
```

## Internal-link policy

`docs/ci/link-policy.json` defines the governed roots used by DOC-12.3, URL schemes excluded from repository-target validation and any deliberately reviewed target/anchor exceptions.

The validator resolves relative Markdown targets, docs-root targets, extensionless Markdown paths and directory `index.md` paths. Fragment links into Markdown are validated against IDs produced by the same Markdown toolchain used by the documentation build, including normal heading anchors and explicit `attr_list` IDs.

External `http`, `https`, `mailto` and `tel` links are deliberately outside this repository-target check. DOC-12.3 checks whether internal documentation links resolve; it does not perform network-dependent external-link availability checks.

Run it directly with:

```bash
python scripts/validate-doc-links.py
```

## Troubleshooting-ID policy

`docs/ci/troubleshooting-id-policy.json` declares the DOC-11 pages that own stable troubleshooting entries, the reserved domain vocabulary and the narrow files excluded from exact-reference resolution because they intentionally contain examples, templates or audit prose.

`scripts/validate-troubleshooting-ids.py` verifies stable `TRB-<DOMAIN>-<NNN>` syntax, one owner per published ID, reserved-domain use, exact-reference resolution and troubleshooting-anchor ownership.

Run it directly with:

```bash
python scripts/validate-troubleshooting-ids.py
```

The qualified DOC-11 corpus currently contains 92 unique stable owner IDs; the DOC-12.4 qualification checked 105 exact ID-reference occurrences.

## CI contract

- [Documentation qualification contract](qualification-contract.md) — scope, authority, deterministic stage order, exit codes, failure ownership and validator rules.
- [DOC-12 documentation CI roadmap](DOC-12-ROADMAP.md) — implementation sequence for DOC-12.1 through DOC-12.10.

## Design rule

Documentation CI must report machine-verifiable defects without claiming semantic authority it cannot establish. Human review remains responsible for architectural correctness, protocol meaning, safety judgment and prose quality; CI owns structural and deterministic publication invariants.

## Phase status

DOC-12.1 through DOC-12.4 are complete. Next is DOC-12.5 — orphan-page and navigation validation.
