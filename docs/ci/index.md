---
title: Documentation CI
category: contributing
status: active
version: current
---

# Documentation CI

This section documents the automated qualification rules that protect 420Docs structure, discoverability, generated-reference freshness and publication safety.

## Current qualification baseline

The repository currently requires three documentation checks in `420Docs Qualification`:

1. DOC-10 generated-reference freshness;
2. strict MkDocs build;
3. audience navigation and search-index qualification.

DOC-12 extends that baseline with deterministic validation for governed front matter, internal links, stable troubleshooting IDs, orphan pages, required-document coverage, generated-reference integration and narrowly scoped publication-safety rules.

## Run the gate locally

From the repository root, run:

```bash
python scripts/qualify-documentation.py
```

This is the same qualification entry point used by GitHub Actions. It runs mandatory stages in deterministic order and stops at the first failure.

## CI contract

- [Documentation qualification contract](qualification-contract.md) — scope, authority, deterministic stage order, exit codes, failure ownership and CI/local equivalence.
- [DOC-12 documentation CI roadmap](DOC-12-ROADMAP.md) — implementation sequence for DOC-12.1 through DOC-12.10.

## Design rule

Documentation CI must report machine-verifiable defects without claiming semantic authority it cannot establish. Human review remains responsible for architectural correctness, protocol meaning, safety judgment and prose quality; CI owns structural and deterministic publication invariants.

## Phase status

DOC-12.1 is complete. DOC-12.2 next adds governed front-matter validation to the unified qualification runner.
