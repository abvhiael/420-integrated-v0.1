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
4. governed orphan/navigation reachability validation;
5. required-document coverage;
6. generated-reference family/source/navigation integration;
7. generated-reference byte-for-byte freshness;
8. strict MkDocs build;
9. search and navigation qualification.

DOC-12.8 and DOC-12.9 add further deterministic validators and workflow hardening to this same gate. They do not replace the existing stages.

## Authority

The qualification runner does not create protocol authority. It checks documentation structure against repository rules and authoritative source files already defined by earlier documentation phases.

- `docs/ci/frontmatter-policy.json` and `scripts/validate-doc-frontmatter.py` own DOC-12.2 metadata validation.
- `docs/ci/link-policy.json` and `scripts/validate-doc-links.py` own DOC-12.3 repository-target and Markdown-anchor resolution.
- `docs/ci/troubleshooting-id-policy.json` and `scripts/validate-troubleshooting-ids.py` own DOC-12.4 stable troubleshooting identity integrity.
- `docs/ci/orphan-policy.json` and `scripts/validate-doc-orphans.py` own DOC-12.5 governed reachability from published navigation/approved entry routes.
- `docs/ci/required-docs-policy.json` and `scripts/validate-required-docs.py` own DOC-12.6 required documentation surface/package presence.
- `docs/ci/generated-reference-policy.json` and `scripts/validate-generated-reference-integration.py` own DOC-12.7 generated family/source/output/discoverability integration.
- DOC-10 remains authoritative for generated-reference provenance and byte-for-byte freshness through `scripts/qualify-generated-reference.py --check`.
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
4. `orphan-navigation`
5. `required-doc-coverage`
6. `generated-reference-integration`
7. `generated-reference-freshness`
8. `strict-mkdocs-build`
9. `search-navigation`

Later DOC-12 stages must be added deliberately to this ordered list. A validator may not silently bypass an earlier mandatory stage.

## Front-matter compatibility rule

DOC-12.2 distinguishes a legacy page that predates governed front matter from a page with invalid metadata. Governed pages with front matter are always validated. A declared legacy exception may permit an existing page to omit front matter, but never permits malformed or invalid metadata when front matter is present.

## Internal-link rule

DOC-12.3 validates repository-internal Markdown targets and practical generated anchors. External network availability remains outside this deterministic repository gate.

## Stable troubleshooting-ID rule

DOC-12.4 enforces `TRB-<DOMAIN>-<NNN>` owner uniqueness, reserved-domain syntax, exact-reference resolution and stable troubleshooting anchors without attempting to judge the semantic correctness of a diagnosis.

## Orphan/navigation rule

DOC-12.5 treats publication reachability as a graph rooted in actual MkDocs navigation plus explicit approved entry pages.

- Governed pages reachable directly from navigation or through governed internal links pass.
- Required audience entry pages must exist and remain represented in MkDocs navigation.
- Intentional non-published/orphan cases require explicit policy treatment; the validator does not infer them from absence.
- MkDocs configuration is parsed without executing Python-tagged extension objects.

The current qualified corpus has 434 governed pages and no approved orphan exceptions.

## Required-document coverage rule

DOC-12.6 protects minimum canonical documentation surfaces from silent deletion.

- Required architecture, user, developer, operator, reference, troubleshooting, application and CI roots must exist.
- Required architecture family entry pages must exist.
- Every frozen Genesis/testnet application must retain its declared 16-file manual/developer package.
- Required generated-reference outputs must remain present.

This gate checks presence/shape, while the other validators check links, metadata, generated freshness and discoverability.

## Generated-reference integration rule

DOC-12.7 composes DOC-10 generation with the repository-wide documentation gate without redefining DOC-10 authority.

- `docs/reference/reference-sources.json` must contain exactly the governed generated-reference family IDs declared by DOC-12 policy.
- Every family must declare at least one source path, and every declared source path must exist in the repository.
- Every required generated output must exist.
- Every required generated output must be directly discoverable from `docs/reference/index.md`.
- The expected freshness command remains `python scripts/qualify-generated-reference.py --check`.
- Byte-for-byte recomputation and SHA-256 output identity remain owned by DOC-10's freshness qualifier and execute immediately after the DOC-12 integration stage.

Generated reference remains descriptive, not protocol/deployment authority. Passing integration/freshness proves source/output consistency and publication discoverability, not semantic or canonical chain correctness.

## Failure policy

Documentation qualification fails closed for a machine-verifiable rule owned by DOC-12. A failure must identify the stage and preserve the underlying validator output so the offending source can be diagnosed.

| Exit code | Meaning |
| --- | --- |
| `0` | every configured documentation qualification stage passed |
| `1` | a qualification stage executed and failed |
| `2` | the runner could not execute a configured stage |

A nonzero result blocks the DOC-12 documentation gate.

## Determinism rules

A DOC-12 validator must operate only on repository state and declared generated/build outputs, avoid mutable network state, report the same result for the same tree/toolchain, fail on malformed governed input rather than guessing intent, and produce actionable file/rule diagnostics.

## CI and local equivalence

GitHub Actions installs the documented dependencies and calls the same `python scripts/qualify-documentation.py` entry point available locally. Workflow path triggers must cover governed documentation, CI policies/validators, MkDocs/dependency configuration, generated-reference generators/renderers and their authoritative source families.

## Failure ownership

Repair failures at the owning layer: metadata in metadata sources, links in link sources, troubleshooting IDs in registry owners/references, reachability in navigation/index routing, coverage in required surfaces, generated integration in source registry/output/index wiring, generated freshness in generator/source output, build failures in MkDocs inputs, and search/discoverability failures in the navigation/search contract. Do not weaken a gate merely to make a branch green.

## Deliberate non-goals

DOC-12 CI does not determine whether prose is persuasive, architecture is well designed, protocol decisions are economically optimal, or security claims are substantively correct. Human review remains responsible unless a specific deterministic invariant is explicitly encoded.

## Related documentation

- [Documentation CI](index.md)
- [DOC-12 roadmap](DOC-12-ROADMAP.md)
- [Generated reference](../reference/index.md)
- [Troubleshooting registry contract](../troubleshooting/registry-contract.md)
