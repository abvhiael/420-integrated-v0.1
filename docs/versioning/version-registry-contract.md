---
title: Documentation version registry contract
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# Documentation version registry contract

DOC-13.3 makes `docs/versioning/version-registry.json` the canonical routing registry for published 420Docs tracks. The registry does not create chain or deployment authority; it records which documentation releases are approved for publication and where their evidence manifests live.

## Required tracks

The registry always declares four documentation tracks:

- `development`
- `genesis`
- `testnet`
- `mainnet`

Each track declares its environment, a `current` release or `null`, and the set of published release identifiers. A track with no approved release keeps `current: null` and an empty published list. Tooling must not synthesize a release for such a track.

## Release records

Every published release identifier must have one registry release record containing:

- its environment;
- publication status;
- whether the release identity is immutable;
- the repository path to its release manifest.

Mutable aliases are not release manifests. Alias resolution terminates at a concrete registry release record.

## Release manifests

A release manifest binds documentation identity to repository evidence. Every manifest declares:

- `release`;
- `environment`;
- `publication_status`;
- `immutable`;
- `authority` description;
- one or more evidence paths;
- whether network authority is asserted;
- whether deployment authority is asserted.

Every evidence path must exist in the repository. A manifest may only assert network or deployment authority when the relevant approved canonical evidence is explicitly represented; documentation labels alone never satisfy this requirement.

## Current project state

At DOC-13.3 closeout:

- `development` is published as the mutable repository-head documentation track;
- `genesis` is published as the frozen Genesis documentation contract;
- `testnet` has no approved documentation release and remains unpublished;
- `mainnet` has no approved documentation release and remains unpublished.

The Genesis release manifest explicitly does not assert a live testnet/mainnet network or canonical deployment. This preserves the distinction between a frozen launch contract and live network state.

## Aliases

Aliases are scoped by track, for example `genesis/current`. They must resolve directly to a registered release in the same track. Alias cycles, dangling aliases, cross-environment aliasing, or aliases to unpublished releases are invalid.

`current` is therefore a convenience resolver, never an immutable historical identifier.

## Fail-closed rules

Qualification fails when:

- a required track is missing;
- a track environment disagrees with its name;
- a track advertises an unknown or unpublished `current` release;
- a published release lacks a registry record or manifest;
- a manifest disagrees with its registry release identity/environment/status/immutability;
- an evidence path is missing;
- an alias is dangling, ambiguous, or cross-track;
- testnet/mainnet is advertised as published without an explicit release record and manifest.

Unknown or unpublished tracks remain unavailable rather than falling back to development or Genesis documentation.
