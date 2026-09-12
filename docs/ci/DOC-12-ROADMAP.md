---
title: DOC-12 documentation CI roadmap
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# DOC-12 — Documentation CI

DOC-12 turns the 420Docs publication rules established in DOC-0 through DOC-11 into deterministic repository checks. DOC-12 is monolithic: DOC-12.1 through DOC-12.10 remain on one branch/PR and merge once after final reconciliation and exact-head qualification.

Branch: `docs/doc-12-documentation-ci`

## Roadmap

### DOC-12.1 — CI foundation and qualification contract — COMPLETE

- [x] Define CI scope, authority and failure policy.
- [x] Establish one local/CI entry point: `python scripts/qualify-documentation.py`.
- [x] Define deterministic runner exit semantics.
- [x] Preserve strict MkDocs and generated-reference freshness gates.

### DOC-12.2 — Front-matter validation — COMPLETE

- [x] Validate required governed metadata and vocabulary.
- [x] Fail on malformed front matter.
- [x] Preserve explicit legacy missing-metadata exceptions without exempting invalid metadata.
- [x] Wire `scripts/validate-doc-frontmatter.py` into the unified gate.

Evidence: 434 governed pages checked; 271 declared legacy pages permitted without front matter; 420Docs Qualification #622 passed.

### DOC-12.3 — Internal links and anchors — COMPLETE

- [x] Validate relative/internal Markdown targets and practical anchors.
- [x] Exclude external network availability from deterministic repository validation.
- [x] Wire `scripts/validate-doc-links.py` into the unified gate.

Evidence: 687 internal links checked across 434 governed pages; zero target/anchor exceptions required; 420Docs Qualification #629 passed.

### DOC-12.4 — Stable troubleshooting-ID validation — COMPLETE

- [x] Validate `TRB-<DOMAIN>-<NNN>` syntax/reserved domains.
- [x] Enforce global owner uniqueness and exact-reference resolution.
- [x] Validate troubleshooting anchors.
- [x] Wire `scripts/validate-troubleshooting-ids.py` into the unified gate.

Evidence: 92 unique stable owner IDs and 105 exact ID-reference occurrences checked; 420Docs Qualification #637 passed.

### DOC-12.5 — Orphan-page and navigation validation — COMPLETE

- [x] Detect governed pages unreachable from navigation/approved entry routes.
- [x] Verify audience entry pages.
- [x] Preserve explicit orphan exclusions only.
- [x] Wire `scripts/validate-doc-orphans.py` into the unified gate.

Evidence: 434 governed pages; 367 directly represented in governed MkDocs navigation; all 434 reachable through 602 governed link edges; zero approved orphan exceptions; 420Docs Qualification #654 passed.

### DOC-12.6 — Required-document coverage — COMPLETE

- [x] Protect canonical documentation roots and architecture entry families.
- [x] Protect all eight generated DOC-10 outputs.
- [x] Protect the complete 16-file package for each of 20 frozen Genesis/testnet application manuals.
- [x] Wire `scripts/validate-required-docs.py` into the unified gate.

Evidence: 340 required files checked; all 20 frozen application packages present; 420Docs Qualification #654 passed.

### DOC-12.7 — Generated-reference and source-freshness integration — COMPLETE

- [x] Validate generated family/source/output/discoverability integration.
- [x] Require every declared source path and output to exist.
- [x] Keep DOC-10 byte-for-byte freshness as a separate mandatory gate.

Evidence: seven generated families, eight outputs and 25 declared source paths validated; all outputs linked from `docs/reference/index.md`; 420Docs Qualification #654 passed.

### DOC-12.8 — Cross-document authority and environment safety checks — COMPLETE

- [x] Detect affirmative secret-request patterns in troubleshooting docs.
- [x] Require selected high-risk authority/environment notices.
- [x] Protect Faucet testnet/no-value scope and local/example deployment/network boundaries.
- [x] Keep checks narrow and machine-verifiable.

Evidence: corrected exact-head 420Docs Qualification #662 passed.

### DOC-12.9 — Workflow integration and developer ergonomics — COMPLETE

- [x] Keep the same local command and GitHub Actions command.
- [x] Verify required validator stages/path triggers.
- [x] Preserve `main` push coverage and superseded-run cancellation.
- [x] Emit ordered START/RUN/PASS/FAIL diagnostics.
- [x] Add a self-checking workflow contract.

Evidence: 420Docs Qualification #668 passed with workflow-contract validation enabled.

### DOC-12.10 — CI self-tests, audit and closeout — COMPLETE

- [x] Add deterministic pass/fail fixtures using production validator code.
- [x] Verify malformed YAML/policy input fails closed.
- [x] Verify valid/broken internal links and secret-safety positive/negative cases.
- [x] Wire `ci-self-tests` into the unified qualification gate and workflow contract.
- [x] Audit the current documentation corpus against DOC-12 coverage.
- [x] Record deliberate exclusions and known non-goals.
- [x] Publish `docs/ci/coverage-audit.md`.
- [ ] Reconcile with current `main`.
- [ ] Obtain successful exact-head 420Docs Qualification.
- [ ] Obtain successful exact-head 420 Integrated Qualification.
- [ ] Merge PR #231 once.

## Exit condition

A documentation change cannot pass the DOC-12 gate while it contains a governed metadata defect, broken governed internal link/anchor, duplicate/unresolved stable troubleshooting ID, accidental governed orphan, missing required documentation surface, generated-reference integration/freshness defect, narrow machine-detectable publication-safety violation, workflow integration drift, failed CI self-test, strict MkDocs failure, or required navigation/search defect.

The phase is implementation-complete. The remaining closeout is the final reconciliation, exact-head qualification and single monolithic merge.
