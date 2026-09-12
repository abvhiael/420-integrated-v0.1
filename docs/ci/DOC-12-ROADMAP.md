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

The existing `420Docs Qualification` workflow already performs generated-reference freshness, strict MkDocs build and search/navigation qualification. DOC-12 extends this baseline rather than replacing it. Existing generated-reference determinism remains owned by DOC-10; DOC-12 integrates and validates it as part of the whole documentation system.

## Roadmap

### DOC-12.1 — CI foundation and qualification contract — COMPLETE

- [x] Define documentation-CI scope, authority and failure policy.
- [x] Inventory existing documentation checks and identify gaps.
- [x] Establish one reusable documentation qualification entry point for local and CI execution.
- [x] Define deterministic exit codes and failure messages.
- [x] Preserve strict-build and generated-reference qualification as mandatory gates.

Deliverables:

- `docs/ci/qualification-contract.md`
- `scripts/qualify-documentation.py`
- `420Docs Qualification` routed through the unified local/CI entry point
- stable runner exit semantics: `0` pass, `1` qualification failure, `2` runner execution error

### DOC-12.2 — Front-matter validation — COMPLETE

- [x] Validate required front-matter fields on governed documentation.
- [x] Validate allowed `status`, `category`, `audience` and `version` shapes.
- [x] Detect malformed or missing front matter on governed pages.
- [x] Preserve explicit exceptions for legacy/non-governed source documents.
- [x] Wire front-matter validation into the unified local/CI gate.

Deliverables:

- `docs/ci/frontmatter-policy.json`
- `scripts/validate-doc-frontmatter.py`
- explicit `PyYAML` documentation dependency
- `front-matter` as the first stage of `scripts/qualify-documentation.py`
- compatibility rule: legacy patterns may permit missing front matter, but front matter is fully validated whenever present
- corpus qualification evidence: 434 governed pages checked; 271 declared legacy pages permitted without front matter; exact-head 420Docs Qualification #622 passed

### DOC-12.3 — Internal links and anchors — COMPLETE

- [x] Validate relative internal Markdown links.
- [x] Validate document targets and fragment anchors where practical.
- [x] Reject links to missing/renamed pages inside governed documentation.
- [x] Exclude external URL schemes from repository-target validation.
- [x] Wire internal-link validation into the unified local/CI gate.

Deliverables:

- `docs/ci/link-policy.json`
- `scripts/validate-doc-links.py`
- `internal-links` as the second stage of `scripts/qualify-documentation.py`
- corpus qualification evidence: 687 internal links checked across 434 governed pages with zero target/anchor exceptions required; exact-head 420Docs Qualification #629 passed

### DOC-12.4 — Stable troubleshooting-ID validation — COMPLETE

- [x] Validate `TRB-<DOMAIN>-<NNN>` syntax and reserved domain tokens.
- [x] Detect duplicate stable troubleshooting IDs across DOC-11 owner pages.
- [x] Verify exact registry references resolve to one owning entry.
- [x] Detect troubleshooting anchors that do not resolve to an owning entry.
- [x] Wire stable-ID validation into the unified local/CI gate.

Deliverables:

- `docs/ci/troubleshooting-id-policy.json`
- `scripts/validate-troubleshooting-ids.py`
- `troubleshooting-ids` as the third stage of `scripts/qualify-documentation.py`
- corpus qualification evidence: 92 unique stable owner IDs and 105 exact ID-reference occurrences checked; exact-head 420Docs Qualification #637 passed

### DOC-12.5 — Orphan-page and navigation validation — COMPLETE

- [x] Detect governed pages unreachable from 420Docs navigation or approved index routes.
- [x] Distinguish intentionally non-published source/reference material from accidental orphans.
- [x] Verify audience entry points remain reachable and indexed.
- [x] Traverse governed links from actual MkDocs navigation plus explicitly approved entry pages.
- [x] Wire orphan/navigation validation into the unified local/CI gate.

Deliverables:

- `docs/ci/orphan-policy.json`
- `scripts/validate-doc-orphans.py`
- non-executing YAML parsing for MkDocs navigation, including configs containing Python-tagged extension values
- `orphan-navigation` stage in `scripts/qualify-documentation.py`
- corpus qualification evidence: 434 governed pages, 367 directly in governed MkDocs navigation, all 434 reachable through 602 governed link edges, zero approved orphans; exact-head 420Docs Qualification #654 passed

### DOC-12.6 — Required-document coverage — COMPLETE

- [x] Encode required documentation families and minimum entry pages.
- [x] Verify frozen Genesis application manuals remain present.
- [x] Verify architecture, user, developer, operator, reference and troubleshooting roots remain present.
- [x] Fail closed when a required canonical documentation surface disappears.
- [x] Wire required-document coverage into the unified local/CI gate.

Deliverables:

- `docs/ci/required-docs-policy.json`
- `scripts/validate-required-docs.py`
- `required-doc-coverage` stage in `scripts/qualify-documentation.py`
- coverage for the complete 16-file documentation package of each of 20 frozen Genesis/testnet applications
- corpus qualification evidence: 340 required files checked and all 20 frozen application packages present; exact-head 420Docs Qualification #654 passed

### DOC-12.7 — Generated-reference and source-freshness integration — COMPLETE

- [x] Keep DOC-10 generated-reference freshness as a required gate.
- [x] Verify generated outputs remain discoverable from reference navigation.
- [x] Detect missing generated source registry/output families.
- [x] Keep generated output validation deterministic and byte-for-byte reproducible.
- [x] Validate declared source paths for each generated-reference family.

Deliverables:

- `docs/ci/generated-reference-policy.json`
- `scripts/validate-generated-reference-integration.py`
- `generated-reference-integration` immediately before DOC-10 `generated-reference-freshness` in the unified runner
- DOC-10 byte-for-byte freshness remains owned by `scripts/qualify-generated-reference.py --check`
- corpus qualification evidence: 7 generated families, 8 generated outputs and 25 declared source paths validated; all outputs directly linked from `docs/reference/index.md`; exact-head 420Docs Qualification #654 passed

### DOC-12.8 — Cross-document authority and environment safety checks — COMPLETE

- [x] Detect localhost/example/testnet-only values presented without required scope/authority guards where machine-checkable.
- [x] Check for known unsafe secret-request patterns in support/troubleshooting documentation.
- [x] Validate required authority/scope notices on selected high-risk documentation classes.
- [x] Keep semantic checks narrow enough to avoid pretending CI can replace human review.
- [x] Wire publication-safety validation into the unified local/CI gate.

Deliverables:

- `docs/ci/publication-safety-policy.json`
- `scripts/validate-doc-publication-safety.py`
- `publication-safety` stage in `scripts/qualify-documentation.py`
- explicit guards for local/example generated network/deployment values, Faucet testnet-only/no-value semantics and DOC-11 secret-safe support rules
- corpus qualification evidence: corrected exact-head 420Docs Qualification #662 passed after the validator learned the existing explicit `no troubleshooting step ... paste ... secrets` negation form

### DOC-12.9 — Workflow integration and developer ergonomics — COMPLETE

- [x] Wire all DOC-12 checks into `420Docs Qualification`.
- [x] Keep one local command/path equivalent to CI.
- [x] Ensure path triggers include validators, schemas and governed documentation sources.
- [x] Preserve workflow concurrency cancellation for superseded PR runs.
- [x] Produce concise, actionable failure output.
- [x] Add a self-checking workflow contract so CI wiring cannot silently drift.

Deliverables:

- `docs/ci/workflow-policy.json` — required runner stages, local/CI command, PR/push path triggers, `main` push coverage and concurrency expectations
- `scripts/validate-doc-workflow.py` — deterministic workflow/runner contract validator
- `workflow-contract` stage in `scripts/qualify-documentation.py`
- ordered unbuffered runner diagnostics for START/RUN/PASS/FAIL stage messages
- workflow trigger coverage for the workflow validator itself
- exact-head qualification evidence: 420Docs Qualification #668 passed with the workflow contract enabled

### DOC-12.10 — CI self-tests, audit and closeout

- Add fixtures/self-tests for pass and fail cases.
- Verify validators fail closed on malformed inputs.
- Audit the current documentation corpus against all DOC-12 checks.
- Record deliberate exclusions and known non-goals.
- Reconcile with current `main`, run exact-head qualification and merge once.

## Exit condition

A documentation change cannot merge through the DOC-12 gate while it contains a broken governed internal link, invalid governed front matter, duplicate stable troubleshooting ID, accidental governed orphan, missing required documentation surface, stale generated reference, unsafe machine-detectable publication condition, workflow integration drift, or another explicitly machine-checkable violation covered by this phase. Developers can run the same qualification locally, failures identify the offending file/rule clearly, and the CI remains deterministic enough to serve as a reliable publication gate rather than a heuristic lint layer.
