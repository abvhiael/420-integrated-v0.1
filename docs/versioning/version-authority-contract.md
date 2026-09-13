---
title: Documentation version authority contract
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# Documentation version authority contract

DOC-13 separates documentation identity into three independent dimensions: release/lifecycle version, environment, and publication status. A page or generated reference is authoritative only within the context that its approved metadata and supporting evidence establish.

## Version dimensions

### Release / lifecycle version

The release dimension answers **which product or protocol state this documentation describes**.

- `development` describes the moving repository head and unreleased behavior. It may change without compatibility guarantees.
- `genesis` describes the frozen Genesis launch contract once that contract has been approved and snapshotted.
- released testnet/mainnet documentation uses an immutable release identifier or approved alias that resolves to one immutable release record.

`current` is an alias, not an immutable release identifier. It resolves only through the documentation version registry introduced later in DOC-13. A historical document must never use `current` as its immutable identity.

### Environment

The environment dimension answers **where the described configuration or deployment applies**.

Allowed authority classes are:

- `development` — local development, repository-head examples, simulated or dev-only infrastructure;
- `genesis` — Genesis configuration and frozen launch composition where no live network deployment claim is implied;
- `testnet` — an approved test network with explicit network/deployment evidence;
- `mainnet` — the production network with explicit canonical network/deployment evidence.

Environment labels do not create network authority. A page labelled `testnet` or `mainnet` may make canonical deployment/network claims only when those claims are backed by the approved network/deployment evidence required by DOC-10 and the future DOC-13 version registry.

### Publication status

Publication status answers **whether readers should treat this version as supported documentation**.

DOC-13 distinguishes at least:

- `development` — mutable and not release-stable;
- `current` — the currently supported published alias for a track;
- `historical` — immutable retained documentation for a superseded release;
- `deprecated` — retained for compatibility/reference but no longer recommended;
- `unpublished` — known to tooling/registry but not exposed as supported documentation.

The exact machine vocabulary is defined in DOC-13.2. This contract defines the semantics that vocabulary must preserve.

## Authority rules

### Development

Development documentation follows the active repository state and may describe incomplete, experimental, local/example, or not-yet-deployed behavior. It must not be presented as canonical testnet or mainnet authority merely because code exists in the repository.

Development pages may reference planned Genesis/testnet/mainnet behavior, but those references must be clearly prospective unless approved release/network evidence exists.

### Genesis

Genesis documentation describes the frozen launch design, inventory, configuration, contracts, and operational assumptions approved for Genesis.

Genesis is a release/lifecycle authority, not automatically a live-network deployment authority. A Genesis contract address, RPC endpoint, deployment record, validator set, or other live state claim is canonical only if the corresponding environment evidence has been approved and published.

### Testnet

Testnet documentation is authoritative only for the specific approved testnet release/environment record it names. Testnet aliases must not silently move historical URLs or immutable snapshots to newer incompatible content.

Testnet values are never promoted to mainnet authority by similarity, reuse, or naming.

### Mainnet

Mainnet documentation is the highest publication context for production behavior, but the `mainnet` label itself is insufficient evidence. Canonical production addresses, chain identifiers, endpoints, deployments, and configuration claims must remain bound to approved canonical source evidence.

If canonical evidence is absent, ambiguous, stale, or contradictory, documentation must fail closed rather than invent or infer a production value.

## Current versus historical authority

`current` is always a resolver/alias. It points to one approved release for one documentation track and environment.

An immutable historical version:

- keeps its own release identity;
- preserves the content and generated reference that belonged to that release;
- may carry deprecation/support banners added by the renderer without rewriting historical technical claims;
- must not silently inherit later addresses, interfaces, RPC methods, errors, or deployment records.

If a corresponding page did not exist in a historical version, the renderer must not silently substitute the current page. Cross-version fallback behavior is defined later in DOC-13 and must prefer explicit absence/tombstone behavior over misleading substitution.

## Machine-governed versus descriptive fields

Machine-governed fields are fields whose values affect routing, publication authority, version selection, historical retention, CI, or generated-reference binding. Their vocabulary and relationships are validated by CI.

Examples include:

- documentation release/version identifier;
- environment/track;
- publication status;
- current/historical alias relationships;
- release manifest identity;
- generated-reference source/provenance identity.

Descriptive fields may explain compatibility, support notes, release summaries, migration guidance, or prose context, but they cannot override machine-governed authority.

A sentence claiming “mainnet” cannot override metadata/registry state that says a page is development-only or unpublished.

## Unknown or unavailable versions

Unknown, unapproved, or unavailable documentation versions fail closed.

Tooling and renderer behavior must not:

- resolve an unknown version to `current` silently;
- promote `development` into `genesis`, `testnet`, or `mainnet`;
- promote testnet values into mainnet;
- substitute current generated reference for a historical release without an explicit compatibility rule;
- advertise unpublished tracks as supported versions.

An unavailable version should produce an explicit unavailable/not-published result or an approved tombstone/redirect, never a misleading success.

## Relationship to DOC-10 generated reference

DOC-10 owns deterministic generated-reference provenance and freshness. DOC-13 adds version/environment identity around that output.

Generated reference remains descriptive of its declared source tree and environment. It does not become canonical network/deployment authority merely by being generated successfully.

DOC-13.7 will bind each published generated-reference set to the release/environment identity that produced it and preserve source/provenance hashes for historical snapshots.

## Relationship to DOC-12 CI

DOC-12 owns the unified documentation qualification gate. DOC-13 extends that gate rather than creating a parallel qualification system.

DOC-13 validators will fail closed for deterministic versioning defects such as invalid metadata, unknown registry references, alias cycles/ambiguity, environment/version incompatibility, unpublished advertised tracks, broken versioned navigation, or generated-reference version mismatches.

A green documentation qualification means those encoded invariants passed; it does not replace human review of semantic correctness or release approval.

## Core invariant

A reader, renderer, generator, or integration must never have to guess which release or environment a piece of 420Docs describes. When identity or authority cannot be proven from approved metadata and evidence, the system reports that ambiguity instead of silently selecting a more authoritative context.
