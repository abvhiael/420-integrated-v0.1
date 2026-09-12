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

## Phase roadmap

See [DOC-12 documentation CI roadmap](DOC-12-ROADMAP.md).

## Design rule

Documentation CI must report machine-verifiable defects without claiming semantic authority it cannot establish. Human review remains responsible for architectural correctness, protocol meaning, safety judgment and prose quality; CI owns structural and deterministic publication invariants.
