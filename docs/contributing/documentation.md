# Documentation Contribution Policy

Documentation is a product requirement for 420 Integrated. Externally visible behavior is not considered complete when users, operators, or developers cannot reliably discover how to use, integrate, operate, or recover it.

## Documentation classes

Use the following page types consistently:

- **Concept** — defines an idea, object, role, or protocol primitive.
- **Explanation** — provides background, rationale, and mental models.
- **Architecture** — describes system design, boundaries, dependencies, invariants, and failure behavior.
- **Tutorial** — teaches by completing a guided end-to-end task.
- **How-to** — provides a focused procedure for a specific goal.
- **Reference** — precise, factual definitions of APIs, contracts, RPCs, events, errors, constants, and schemas.
- **Troubleshooting** — symptom-to-diagnosis-to-recovery guidance.
- **ADR** — preserves a significant architectural decision and its rationale.

## Required metadata

New user-facing and architecture pages should include front matter where supported by the documentation renderer:

```yaml
---
title: Page title
component: component-id
audience:
  - user
category: how-to
status: development
version: current
---
```

Valid audience values should prefer: `user`, `developer`, `validator`, `operator`, `integrator`, `architect`, and `security`.

## Documentation change rule

A PR must update documentation when it materially changes externally observable behavior, including:

- user workflows or UI semantics;
- transaction signing or wallet permissions;
- public contract interfaces or protocol semantics;
- RPC, API, SDK, CLI, event, or error behavior;
- validator or operator procedures;
- security assumptions or trust boundaries;
- genesis configuration or canonical deployment behavior;
- interoperability, bridge, settlement, or asset semantics.

Pure refactors with no externally visible behavior change do not require prose changes, but generated reference outputs may still change.

## Source of truth

Repository Markdown and generated reference inputs are canonical. Published 420Docs pages are renderings of repository-controlled documentation and must not diverge from source.

## Existing documentation

DOC-0 does not require immediate relocation of existing files. When existing documentation is materially revised, contributors should migrate it toward the canonical taxonomy when safe and update links in the same PR.

## Review expectations

Documentation changes should be reviewed for:

1. technical correctness;
2. correct audience and page type;
3. terminology consistency;
4. explicit security or irreversible-action warnings where applicable;
5. working internal links;
6. executable or realistic examples;
7. version/genesis applicability;
8. absence of undocumented assumptions.

## Completion principle

A feature may be code-complete while still being release-incomplete. If a user, developer, validator, or operator needs documentation to safely use the feature, that documentation is part of the feature's release qualification.