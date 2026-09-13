---
title: Historical documentation retention and archival contract
category: contributing
status: current
version: current
---

# Historical documentation retention and archival contract

DOC-13 preserves released documentation as evidence of the behavior, interfaces and operational assumptions that belonged to that release. Historical documentation is retained; it is not silently rewritten to match later code or network state.

## Snapshot versus update-in-place

Mutable development documentation may be updated in place while it represents repository-head behavior. Once a release is approved as immutable, its release-qualified documentation tree becomes a snapshot. Subsequent corrections that would change technical meaning require a new release snapshot or an explicit erratum/tombstone mechanism; they do not overwrite the historical record.

Renderer-only support/deprecation notices may be added without changing the historical technical body.

## Current aliases

`current` is a track-local alias resolved by `version-registry.json`. Moving `current` to a newer release does not move, rename or rewrite the previous immutable release URL. A superseded release remains addressable by its immutable release identifier while retained.

A track may have at most one `current` release, and that release must be in the track's published set and match the track environment.

## Historical and deprecated releases

A release marked `historical` or `deprecated` must:

- use an immutable release identifier;
- remain explicitly published by immutable release ID while retained;
- never resolve through another environment or release as fallback;
- display a renderer-level historical/deprecated notice;
- preserve its historical technical claims, links and generated-reference provenance;
- remain distinct from the moving `current` alias.

`historical` means retained superseded documentation. `deprecated` means retained documentation that is no longer recommended for new use. Neither status means the release may be promoted back to current without an explicit registry change and review.

## Unsupported and unavailable versions

If a requested release is not retained, an explicit tombstone/unsupported state is preferred over redirecting to current content. The renderer must not make an unavailable historical URL look successful by substituting a newer page.

DOC-13.8 defines redirect and tombstone mechanics. DOC-13.6 defines the authority rule: absence remains explicit unless compatibility has been deliberately approved.

## Troubleshooting and error identifiers

Stable troubleshooting identifiers such as `TRB-<DOMAIN>-<NNN>` remain stable historical references. A later release may supersede guidance around an ID, but the ID must not be silently reassigned to a different condition.

When a historical page references an error/troubleshooting identifier, that reference remains attributable to the historical release. Current guidance may link forward, but historical content is not rewritten merely to reflect a newer remediation path.

## Canonical historical references

Release-qualified URLs are the canonical references for immutable historical documentation. Flat legacy URLs and moving aliases are compatibility/navigation surfaces and must not be cited as immutable historical identity.

## Archival banners

Renderer notices are presentation metadata, not replacements for technical content. Historical and deprecated banners must clearly state that the page is retained for an older release and must not imply that current network/deployment values apply.

The banner text is governed by `historical-retention-policy.json` and may be changed for clarity without rewriting the underlying historical snapshot.

## Core invariant

Moving the supported `current` alias forward must never destroy, rewrite or silently reinterpret the immutable documentation record of the release it leaves behind.
