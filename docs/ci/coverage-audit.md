---
title: DOC-12 documentation CI coverage audit
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# DOC-12 documentation CI coverage audit

This audit records the machine-checkable publication invariants enforced by DOC-12 and the deliberate limits of those checks. DOC-12 is a deterministic repository gate, not a substitute for protocol, security, legal, architectural or editorial review.

## Qualified CI surface

The unified command is:

```bash
python scripts/qualify-documentation.py
```

The gate contains these ordered stages:

1. `front-matter`
2. `internal-links`
3. `troubleshooting-ids`
4. `orphan-navigation`
5. `required-doc-coverage`
6. `generated-reference-integration`
7. `publication-safety`
8. `workflow-contract`
9. `ci-self-tests`
10. `generated-reference-freshness`
11. `strict-mkdocs-build`
12. `search-navigation`

A nonzero stage result blocks documentation qualification. The runner stops at the first failing stage and preserves the validator's diagnostic output.

## Current corpus coverage

The DOC-12 qualification contract protects the following current repository surfaces:

- 434 governed Markdown pages for metadata/link/reachability qualification;
- 687 repository-internal Markdown links and practical anchors;
- 92 published stable troubleshooting owner IDs and 105 exact ID-reference occurrences;
- all 434 governed pages reachable from actual MkDocs navigation or approved entry routes, with 602 governed link edges and no approved orphan exceptions;
- 340 required documentation files, including the complete 16-file package for each of 20 frozen Genesis/testnet application manuals;
- seven DOC-10 generated-reference families, eight generated outputs and 25 declared source paths;
- byte-for-byte regeneration freshness for all eight DOC-10 generated outputs;
- selected high-risk authority/environment notices and troubleshooting secret-safety rules;
- the `420Docs Qualification` workflow contract, local/CI command equivalence, required path triggers and superseded-run cancellation semantics.

Counts are evidence for the audited tree, not immutable protocol constants. The validators derive current acceptance from version-controlled policy and repository state.

## CI self-tests

`scripts/selftest-documentation-ci.py` exercises production validator code with isolated deterministic fixtures. The self-tests prove both acceptance and rejection behavior for representative high-value rules:

- valid front matter passes;
- malformed YAML front matter fails closed;
- malformed front-matter policy JSON fails closed;
- a valid internal target/anchor passes;
- a missing internal target fails closed;
- affirmative secret-request language is rejected;
- explicit secret-safety negation is accepted.

The self-test stage runs inside the same unified qualification command used by GitHub Actions.

## Deliberate exclusions and non-goals

DOC-12 deliberately does not claim to validate:

- factual correctness of prose;
- protocol correctness, economic soundness or governance policy quality;
- cryptographic/security correctness beyond the narrow deterministic publication rules explicitly encoded;
- legal or regulatory correctness;
- availability of external URLs or mutable external services;
- whether every possible useful page is documented;
- whether an architecture or operational procedure is optimal;
- canonical chain state, deployment truth or provider truth beyond checking that documentation preserves the previously defined authority boundaries;
- semantic equivalence between prose and implementation where no deterministic contract has been encoded.

External link crawling remains excluded because network state is mutable and would make the publication gate nondeterministic. Legacy pages allowed to omit front matter remain explicit policy exceptions; when such a page contains front matter, that metadata is still validated.

## Fail-closed rules

Malformed governed policy/input must not silently become a pass. Validators reject missing required roots/files, malformed governed metadata, duplicate stable IDs, missing targets, missing required output/source families, missing safety notices, broken workflow contracts and stale generated outputs. Policy exceptions must be explicit and version-controlled; validators do not infer exceptions merely because a current page fails.

## Closeout condition

DOC-12 is ready for merge only after this audit and all DOC-12.1 through DOC-12.10 deliverables are on the monolithic branch, the branch is reconciled with current `main`, and exact-head `420Docs Qualification` plus exact-head `420 Integrated Qualification` are both successful. The merge is then performed once for the whole DOC-12 phase.
