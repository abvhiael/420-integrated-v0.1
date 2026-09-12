---
title: Documentation qualification contract
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# Documentation qualification contract

DOC-12 defines the repository-level contract for automated 420Docs qualification. The contract is intentionally narrower than documentation review: CI enforces deterministic publication invariants, while human review remains responsible for architectural correctness, protocol meaning, safety judgment and prose quality.

## Scope

The documentation gate covers repository-controlled 420Docs sources and the source material that deterministically generates or configures published documentation. The current gate includes:

1. governed front-matter validation;
2. governed internal-link and anchor validation;
3. stable troubleshooting-ID validation;
4. generated-reference freshness;
5. strict MkDocs build;
6. search and navigation qualification.

DOC-12.5 through DOC-12.9 add further deterministic validators to this same gate. They do not replace the existing stages.

## Authority

The qualification runner does not create protocol authority. It checks documentation structure against repository rules and authoritative source files already defined by earlier documentation phases.

- `docs/ci/frontmatter-policy.json` defines the DOC-12.2 governed front-matter scope, vocabulary and explicit legacy missing-metadata exceptions.
- `scripts/validate-doc-frontmatter.py` owns deterministic front-matter parsing and policy enforcement for that scope.
- `docs/ci/link-policy.json` defines DOC-12.3 governed roots plus explicit target/anchor exceptions.
- `scripts/validate-doc-links.py` owns deterministic repository-target and practical Markdown-anchor resolution for that scope.
- `docs/ci/troubleshooting-id-policy.json` defines DOC-12.4 stable-ID owner pages, reserved domains and deliberate exact-reference exclusions.
- `scripts/validate-troubleshooting-ids.py` owns machine validation of stable troubleshooting ownership, uniqueness, domain syntax, exact references and troubleshooting anchors.
- DOC-10 remains authoritative for generated-reference provenance and byte-for-byte freshness.
- MkDocs strict build remains authoritative for renderer-level warnings and broken configured navigation/build conditions.
- `scripts/qualify-docs.py` remains authoritative for the current audience-entry, search-index and repository-discoverability checks.
- Later DOC-12 validators own only the machine-checkable invariants explicitly assigned to them.

A passing CI result means the checked publication invariants passed. It does not certify protocol correctness, legal correctness, security correctness or factual completeness.

## Unified entry point

Run the complete documentation qualification pipeline from the repository root with:

```bash
python scripts/qualify-documentation.py
```

The same entry point is used by `420Docs Qualification` in GitHub Actions. Individual validators may still be run directly while diagnosing a failure, but the unified runner is the merge/publication gate.

## Stage order

The runner executes stages in deterministic order and stops at the first failure:

1. `front-matter`
2. `internal-links`
3. `troubleshooting-ids`
4. `generated-reference-freshness`
5. `strict-mkdocs-build`
6. `search-navigation`

Later DOC-12 stages must be added deliberately to this ordered list. A validator may not silently bypass an earlier mandatory stage.

## Front-matter compatibility rule

DOC-12.2 distinguishes a legacy page that predates governed front matter from a page with invalid metadata.

- Governed pages with front matter are always validated, including pages whose path matches a legacy exception pattern.
- A declared legacy exception may only permit an existing page to omit front matter.
- It does not permit malformed YAML, invalid category/status/audience values or missing required fields when front matter is present.
- Legacy exceptions are repository policy and must be listed explicitly in `docs/ci/frontmatter-policy.json`; the validator must not infer exceptions from filenames or content.
- New governed documentation should use valid front matter rather than expanding a legacy exception merely for convenience.

## Internal-link rule

DOC-12.3 validates repository-internal Markdown links without turning CI into a network crawler.

- Relative targets resolve from the source page directory.
- A docs-root target beginning with `/` resolves beneath `docs/`.
- Extensionless targets may resolve to a sibling `.md` file or a directory `index.md`.
- Percent-encoded path/fragment values are decoded before validation.
- Fragment links into Markdown must resolve to an ID produced by the configured Markdown parser using `toc` and `attr_list`, covering ordinary heading IDs and explicit IDs.
- External `http`, `https`, `mailto` and `tel` links are excluded from repository-target validation.
- Any target or anchor exception must be explicit in `docs/ci/link-policy.json`; the validator does not infer exceptions from broken links.

The link gate proves repository target/anchor existence only. It does not claim that an external URL is reachable, that linked content is semantically correct, or that every prose mention should be a link.

## Stable troubleshooting-ID rule

DOC-12.4 enforces the stable identifier contract created by DOC-11.

- Entry ownership is defined by canonical troubleshooting owner headings using `TRB-<DOMAIN>-<NNN>`.
- Every owner ID must use one of the reserved domain tokens declared by the registry contract/policy.
- One stable ID may have exactly one owner entry.
- Exact `TRB-*` references in governed troubleshooting pages must resolve to an owner entry.
- Troubleshooting fragment references using `#trb-...` must resolve to an owning stable ID.
- Contract, template, roadmap and audit pages that intentionally contain illustrative IDs are excluded only from exact-reference resolution; they do not become owners.
- The validator recognizes the canonical backtick owner-heading form used by DOC-11.

This gate checks identity integrity, not the semantic correctness of a troubleshooting diagnosis.

## Failure policy

Documentation qualification fails closed for a machine-verifiable rule owned by DOC-12. A failure must identify the stage and preserve the underlying validator output so the offending source can be diagnosed.

The runner uses stable process exit semantics:

| Exit code | Meaning |
| --- | --- |
| `0` | every configured documentation qualification stage passed |
| `1` | a qualification stage executed and failed |
| `2` | the runner could not execute a configured stage |

A nonzero result blocks the DOC-12 documentation gate. Warnings emitted by tools configured in strict mode are failures when the underlying tool returns nonzero.

## Determinism rules

A DOC-12 validator must:

- operate only on repository state and declared generated/build outputs;
- avoid network-dependent success criteria unless a later phase explicitly defines a deterministic exception;
- report the same result for the same repository tree and supported toolchain;
- avoid timestamps, random sampling or mutable external service state as acceptance inputs;
- fail on malformed governed input rather than guessing intent;
- produce concise output that names the failed rule, file or identifier where practical.

## CI and local equivalence

The GitHub Actions workflow installs the documented documentation dependencies and then calls the same unified runner available to developers locally. CI must not contain hidden validation logic that cannot be invoked through the repository entry point.

Workflow path triggers must include:

- governed documentation sources and CI policy files;
- MkDocs configuration and documentation dependencies;
- the unified runner and component validators;
- generated-reference generators/renderers and their authoritative source families;
- documentation workflow files themselves.

## Failure ownership

Each failure should be repaired at the layer that owns it.

- front-matter failure: repair the governed page metadata or intentionally update the documented policy/legacy contract;
- internal-link failure: repair the source link, restore/rename the intended target, repair the target anchor, or add a narrowly reviewed explicit policy exception;
- troubleshooting-ID failure: repair the malformed/duplicate owner, resolve the reference to the intended stable entry, or intentionally update the reviewed registry domain/owner policy;
- stale generated output: regenerate or correct the DOC-10 source/generator;
- strict MkDocs failure: repair the page, link, configuration or renderer warning;
- search/navigation failure: repair discoverability or the qualification rule if the documentation contract intentionally changed;
- later DOC-12 validator failure: repair the governed source or update the rule only when the documentation contract itself has intentionally changed.

Do not weaken a gate merely to make a failing branch green.

## Deliberate non-goals

DOC-12 CI does not attempt to determine whether prose is persuasive, whether an architecture is well designed, whether a protocol decision is economically optimal, or whether a security claim is substantively correct. Those remain review responsibilities unless a specific deterministic invariant is encoded in a later DOC-12 step.

## Related documentation

- [Documentation CI](index.md)
- [DOC-12 roadmap](DOC-12-ROADMAP.md)
- [Generated reference](../reference/index.md)
- [Troubleshooting registry contract](../troubleshooting/registry-contract.md)
