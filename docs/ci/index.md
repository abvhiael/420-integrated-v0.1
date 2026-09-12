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
4. orphan-page and navigation reachability validation;
5. required-document coverage;
6. generated-reference family/source/navigation integration;
7. publication authority/environment/secret-safety validation;
8. DOC-10 generated-reference byte-for-byte freshness;
9. strict MkDocs build;
10. audience navigation and search-index qualification.

DOC-12 continues with workflow ergonomics and final CI self-tests/audit.

## Front-matter policy

`docs/ci/frontmatter-policy.json` defines which documentation roots are governed, the required metadata fields, accepted category/status/audience vocabulary and the explicit legacy paths allowed to omit front matter.

Legacy compatibility is intentionally narrow: a matching legacy page may omit front matter, but if front matter exists it is still fully validated. New governed pages should carry valid metadata rather than expanding the legacy exception set.

Run it directly with `python scripts/validate-doc-frontmatter.py`.

## Internal-link policy

`docs/ci/link-policy.json` defines the governed roots used by DOC-12.3, URL schemes excluded from repository-target validation and any deliberately reviewed target/anchor exceptions.

The validator resolves relative Markdown targets, docs-root targets, extensionless Markdown paths and directory `index.md` paths. Fragment links into Markdown are validated against IDs produced by the same Markdown toolchain used by the documentation build.

Run it directly with `python scripts/validate-doc-links.py`.

## Troubleshooting-ID policy

`docs/ci/troubleshooting-id-policy.json` declares the DOC-11 pages that own stable troubleshooting entries, the reserved domain vocabulary and the narrow files excluded from exact-reference resolution because they intentionally contain examples, templates or audit prose.

`scripts/validate-troubleshooting-ids.py` verifies stable `TRB-<DOMAIN>-<NNN>` syntax, one owner per published ID, reserved-domain use, exact-reference resolution and troubleshooting-anchor ownership.

The qualified DOC-11 corpus currently contains 92 unique stable owner IDs; DOC-12.4 checks 105 exact ID-reference occurrences.

## Orphan and navigation policy

`docs/ci/orphan-policy.json` defines governed roots, approved entry pages, required audience entry pages and explicit orphan exclusions. `scripts/validate-doc-orphans.py` starts from actual MkDocs navigation plus approved entry pages and follows governed internal Markdown links.

The qualified corpus contains 434 governed pages. All 434 are reachable; 367 are directly represented in governed MkDocs navigation and the graph contains 602 governed link edges. No approved orphan exceptions are required.

## Required-document coverage

`docs/ci/required-docs-policy.json` protects the canonical documentation entry surfaces, four architecture entry families, all eight generated DOC-10 outputs and the complete 16-file manual package for each frozen Genesis/testnet application.

`scripts/validate-required-docs.py` validates 340 required files across 20 frozen application packages.

## Generated-reference integration

`docs/ci/generated-reference-policy.json` protects the DOC-10 source registry, seven generated-reference families, eight expected outputs and direct discoverability from `docs/reference/index.md`.

`scripts/validate-generated-reference-integration.py` validates family uniqueness, declared source-path existence, required output presence and reference-index discoverability. The separate DOC-10 qualifier still owns byte-for-byte generation freshness:

```bash
python scripts/qualify-generated-reference.py --check
```

Current corpus evidence: 7 generated families, 8 outputs and 25 declared source paths pass integration checks, and every generated output is linked from the reference index.

## Publication-safety policy

`docs/ci/publication-safety-policy.json` defines the narrow machine-checkable safety rules introduced by DOC-12.8. `scripts/validate-doc-publication-safety.py` scans troubleshooting documentation for affirmative secret-request language, requires selected high-risk safety notices, and verifies that local/example environment material carries explicit scope/authority guards.

The gate intentionally does not claim semantic security review. It protects only deterministic invariants such as: support must not request signer/recovery secrets; Faucet documentation remains testnet-only/no-value; local/example network values are not promoted to testnet/mainnet authority; and example deployment records are not published as canonical deployments.

Run it directly with:

```bash
python scripts/validate-doc-publication-safety.py
```

## CI contract

- [Documentation qualification contract](qualification-contract.md) — scope, authority, deterministic stage order, exit codes, failure ownership and validator rules.
- [DOC-12 documentation CI roadmap](DOC-12-ROADMAP.md) — implementation sequence for DOC-12.1 through DOC-12.10.

## Design rule

Documentation CI must report machine-verifiable defects without claiming semantic authority it cannot establish. Human review remains responsible for architectural correctness, protocol meaning, safety judgment and prose quality; CI owns structural and deterministic publication invariants.

## Phase status

DOC-12.1 through DOC-12.8 are complete. Next is DOC-12.9 — workflow integration and developer ergonomics.
