---
title: DOC-12 documentation CI roadmap
audience:
  - developer
  - operator
category: contributing
status: active
version: current
---

# DOC-12 — Documentation CI

DOC-12 turns the 420Docs publication rules established in DOC-0 through DOC-11 into deterministic repository checks. The goal is to fail early when documentation becomes structurally invalid, undiscoverable, internally inconsistent, stale or unsafe to publish.

## Phase policy

DOC-12 is monolithic. DOC-12.1 through DOC-12.10 remain on one branch and one pull request. Individual substeps are not merged separately. The phase merges once after DOC-12.10 closeout, reconciliation with current `main`, exact-head 420Docs Qualification and exact-head 420 Integrated Qualification are green.

Branch: `docs/doc-12-documentation-ci`

## Existing baseline

The existing `420Docs Qualification` workflow already performs:

1. generated-reference freshness qualification;
2. strict MkDocs build;
3. search/navigation qualification.

DOC-12 extends this baseline rather than replacing it. Existing generated-reference determinism remains owned by DOC-10; DOC-12 integrates and validates it as part of the whole documentation system.

## Roadmap

### DOC-12.1 — CI foundation and qualification contract

- Define documentation-CI scope, authority and failure policy.
- Inventory existing documentation checks and identify gaps.
- Establish one reusable documentation qualification entry point for local and CI execution.
- Define deterministic exit codes and failure messages.
- Preserve strict-build and generated-reference qualification as mandatory gates.

### DOC-12.2 — Front-matter validation

- Validate required front-matter fields by documentation class.
- Validate allowed `status`, `category`, `audience` and `version` shapes.
- Detect malformed or missing front matter on governed pages.
- Preserve explicit exceptions for legacy/non-governed source documents.

### DOC-12.3 — Internal links and anchors

- Validate relative internal Markdown links.
- Validate document targets and explicit anchors where practical.
- Reject links to missing renamed pages.
- Exclude approved external URLs from repository-target validation.

### DOC-12.4 — Stable troubleshooting-ID validation

- Validate `TRB-<DOMAIN>-<NNN>` syntax.
- Detect duplicate stable troubleshooting IDs across DOC-11.
- Verify registry references resolve to an owning entry.
- Detect malformed or ambiguous troubleshooting anchors.

### DOC-12.5 — Orphan-page and navigation validation

- Detect governed pages unreachable from 420Docs navigation or approved index routes.
- Distinguish intentionally non-published source/reference material from accidental orphans.
- Verify audience entry points remain reachable and indexed.

### DOC-12.6 — Required-document coverage

- Encode required documentation families and minimum entry pages.
- Verify frozen Genesis application manuals remain present.
- Verify architecture, user, developer, operator, reference and troubleshooting roots remain present.
- Fail closed when a required canonical documentation surface disappears.

### DOC-12.7 — Generated-reference and source-freshness integration

- Keep DOC-10 generated-reference freshness as a required gate.
- Verify generated outputs remain discoverable from reference navigation.
- Detect missing generated source registry/output families.
- Keep generated output validation deterministic and byte-for-byte reproducible.

### DOC-12.8 — Cross-document authority and environment safety checks

- Detect localhost/example/testnet-only values presented as canonical production authority where machine-checkable.
- Check for known unsafe secret-request patterns in support/troubleshooting documentation.
- Validate required authority/scope notices on high-risk documentation classes where practical.
- Keep semantic checks narrow enough to avoid pretending CI can replace human review.

### DOC-12.9 — Workflow integration and developer ergonomics

- Wire all DOC-12 checks into `420Docs Qualification`.
- Keep one local command/path equivalent to CI.
- Ensure path triggers include validators, schemas and governed documentation sources.
- Preserve workflow concurrency cancellation for superseded PR runs.
- Produce concise, actionable failure output.

### DOC-12.10 — CI self-tests, audit and closeout

- Add fixtures/self-tests for pass and fail cases.
- Verify validators fail closed on malformed inputs.
- Audit the current documentation corpus against all DOC-12 checks.
- Record deliberate exclusions and known non-goals.
- Reconcile with current `main`, run exact-head qualification and merge once.

## Exit condition

A documentation change cannot merge through the DOC-12 gate while it contains a broken governed internal link, invalid governed front matter, duplicate stable troubleshooting ID, accidental governed orphan, missing required documentation surface, stale generated reference, or another explicitly machine-checkable publication violation covered by this phase. Developers can run the same qualification locally, failures identify the offending file/rule clearly, and the CI remains deterministic enough to serve as a reliable publication gate rather than a heuristic lint layer.
