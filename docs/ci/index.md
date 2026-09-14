---
title: Documentation CI
category: contributing
status: current
version: current
---

# Documentation CI

This section documents the automated qualification rules that protect 420Docs structure, discoverability, generated-reference freshness and publication safety.

## Current qualification gate

Run the same gate locally that GitHub Actions runs:

```bash
python scripts/qualify-documentation.py
```

The final DOC-12 deterministic stage order is:

1. governed front-matter validation;
2. governed internal-link and anchor validation;
3. stable troubleshooting-ID validation;
4. orphan-page and navigation reachability validation;
5. required-document coverage;
6. generated-reference family/source/navigation integration;
7. publication authority/environment/secret-safety validation;
8. workflow/local-CI integration contract validation;
9. deterministic CI self-tests;
10. DOC-10 generated-reference byte-for-byte freshness;
11. strict MkDocs build;
12. audience navigation and search-index qualification.

## Front-matter policy

`docs/ci/frontmatter-policy.json` and `scripts/validate-doc-frontmatter.py` enforce governed metadata. Legacy compatibility is narrow: a declared legacy page may omit front matter, but front matter is fully validated whenever present.

## Internal-link policy

`docs/ci/link-policy.json` and `scripts/validate-doc-links.py` resolve governed internal Markdown targets and practical generated anchors. External network availability is deliberately outside this deterministic repository gate.

## Troubleshooting-ID policy

`docs/ci/troubleshooting-id-policy.json` and `scripts/validate-troubleshooting-ids.py` enforce stable `TRB-<DOMAIN>-<NNN>` syntax, one owner per published ID, reserved-domain use, exact-reference resolution and troubleshooting-anchor ownership.

## Orphan and navigation policy

`docs/ci/orphan-policy.json` and `scripts/validate-doc-orphans.py` seed reachability from actual MkDocs navigation plus approved entry pages and traverse governed internal links. The audited corpus has no approved orphan exceptions.

## Required-document coverage

`docs/ci/required-docs-policy.json` and `scripts/validate-required-docs.py` protect canonical documentation roots, architecture entry families, generated-reference outputs and the complete 16-file manual package for each frozen Genesis/testnet application.

## Generated-reference integration

`docs/ci/generated-reference-policy.json` and `scripts/validate-generated-reference-integration.py` protect the DOC-10 source registry, seven generated-reference families, eight expected outputs, declared source-path existence and direct discoverability from `docs/reference/index.md`.

The separate DOC-10 qualifier retains ownership of byte-for-byte generation freshness:

```bash
python scripts/qualify-generated-reference.py --check
```

## Publication-safety policy

`docs/ci/publication-safety-policy.json` and `scripts/validate-doc-publication-safety.py` implement narrow machine-checkable safeguards for troubleshooting secret requests, Faucet testnet/no-value scope, local/example network authority and example deployment publication boundaries.

These checks do not claim semantic security review.

## Workflow integration policy

`docs/ci/workflow-policy.json` and `scripts/validate-doc-workflow.py` verify that `420Docs Qualification` still calls the unified local command, retains every required validator stage and source/path trigger, runs on `main` pushes, and cancels superseded runs for the same PR/ref.

The runner flushes stage start/run/pass/fail messages so GitHub Actions output remains ordered and actionable.

## CI self-tests and audit

`scripts/selftest-documentation-ci.py` executes deterministic pass/fail fixtures against production validator code. It proves representative acceptance and fail-closed behavior for front matter, malformed policy input, internal links/anchors and troubleshooting secret-safety language.

- [DOC-12 coverage audit](coverage-audit.md) — audited corpus coverage, self-test scope, fail-closed rules, deliberate exclusions and non-goals.
- [Documentation qualification contract](qualification-contract.md) — scope, authority, deterministic stage order, exit codes and failure ownership.
- [DOC-12 documentation CI roadmap](DOC-12-ROADMAP.md) — DOC-12.1 through DOC-12.10 implementation and closeout.

## Design rule

Documentation CI reports machine-verifiable defects without claiming semantic authority it cannot establish. Human review remains responsible for architectural correctness, protocol meaning, security judgment, legal correctness and prose quality.

## Phase status

DOC-12.1 through DOC-12.10 are complete at the content/implementation level. Final phase merge requires reconciliation with current `main` and successful exact-head 420Docs Qualification plus exact-head 420 Integrated Qualification.
