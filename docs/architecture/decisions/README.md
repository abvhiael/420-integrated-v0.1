# Architecture Decision Records

420 Integrated uses Architecture Decision Records (ADRs) to preserve important architectural choices and their rationale.

## When an ADR is required

Create an ADR when a decision materially affects system architecture, security boundaries, protocol semantics, interoperability, governance authority, consensus behavior, upgrade strategy, or long-lived developer assumptions.

Examples include choosing provider-neutral randomness, separating governance authority from payment-path authority, defining bridge verification boundaries, selecting consensus reward behavior, or fixing genesis application semantics.

## Naming

Use sequential identifiers:

`ADR-0001-short-kebab-case-title.md`

Numbers are never reused, even when an ADR is superseded.

## Required format

```markdown
# ADR-XXXX — Title

Status: proposed | accepted | superseded | deprecated
Date: YYYY-MM-DD
Decision owners: ...
Related components: ...
Supersedes: ...
Superseded by: ...

## Context

What problem or architectural pressure required a decision?

## Decision

What was decided?

## Rationale

Why was this option selected?

## Alternatives considered

What credible alternatives were evaluated and why were they rejected?

## Consequences

What becomes easier, harder, safer, more constrained, or operationally different because of this choice?

## Security and trust implications

How does the decision affect trust boundaries, authority, custody, validation, or attack surface?

## Compatibility and migration

What compatibility or migration implications exist?

## References

Links to contracts, specifications, issues, PRs, tests, or related documentation.
```

## ADR rules

- ADRs record decisions; they are not implementation tutorials.
- Accepted ADRs are immutable except for corrections and reference updates. Materially changing a decision requires a new ADR.
- Superseded ADRs remain in the repository and point to the replacing ADR.
- An ADR should explain the rejected alternatives well enough that a future maintainer understands why reopening the decision would be significant.
- Where code enforces the decision through invariants or qualification tests, link those artifacts from the ADR.