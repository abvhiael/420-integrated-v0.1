---
title: Contextual-link version and environment coupling
audience:
  - developer
  - operator
category: architecture
status: current
version: current
---

# DOC-14.7 — Version and environment coupling

Contextual-link resolution is subordinate to the DOC-13 documentation version registry. A contextual-link ID identifies semantic documentation intent; DOC-13 determines whether that intent may be published for a requested environment/version and which URL forms are authoritative.

## Authoritative inputs

Resolution uses two registries:

- `docs/contextual/contextual-link-registry.json` — semantic contextual-link identity, audience, source surface, target class, target path/anchor and allowed environments;
- `docs/versioning/version-registry.json` — published documentation tracks, current aliases and immutable releases.

Neither registry can be interpreted in isolation. A contextual target is resolvable only when both permit the requested environment/version.

## Current alias resolution

A request for `current` resolves only when DOC-13 defines an explicit current release for the requested environment and that release is present in the environment's published set.

Current contextual URLs use:

`/versions/<environment>/current/<target-path>`

The current alias is convenience routing, not a new release identity. Applications should retain the contextual-link ID as their stable semantic reference rather than persist the resolved current URL as permanent identity.

At the present registry state:

- `development/current` is published and resolves to the mutable `development` documentation release;
- `genesis/current` is published and resolves to the immutable `genesis` documentation release;
- `testnet/current` is unavailable;
- `mainnet/current` is unavailable.

## Immutable release resolution

An explicit release URL is authoritative only when:

1. the release is listed under the requested environment's published set;
2. the release record declares the same environment;
3. the release is immutable when used as a historical/permanent contextual target;
4. the contextual-link record allows that environment;
5. the target exists within that release's documentation inventory.

The canonical shape is:

`/versions/<environment>/<release>/<target-path>`

At the present registry state, `genesis/genesis` is the only immutable published release suitable for durable historical contextual links. The `development` release is deliberately mutable and must not be represented as an immutable historical snapshot.

## Environment intersection

A contextual-link record's `environments` list is an allow-list, not evidence that every listed environment is published.

Resolution requires the intersection of:

- the contextual record's allowed environments; and
- the DOC-13 published environment/version authority.

This distinction prevents a planned or semantically valid target from being advertised before the corresponding documentation track exists.

## Unpublished testnet and mainnet behavior

The current DOC-13 registry publishes no testnet or mainnet documentation releases and defines no current aliases for them.

Therefore:

- no contextual-link ID may resolve to an authoritative testnet URL;
- no contextual-link ID may resolve to an authoritative mainnet URL;
- testnet-only Faucet contextual mappings remain intentionally unavailable;
- applications must not substitute development or Genesis documentation while labelling it testnet/mainnet guidance;
- generic help may be presented as unavailable without weakening runtime safety or changing application behavior.

Publication of a future testnet/mainnet track is a DOC-13 change first. DOC-14 consumers gain authority only after the version registry declares the track/release published and later DOC-14 qualification accepts the contextual target under that new authority.

## Development versus Genesis authority

Development documentation is repository-head guidance. It is mutable and may describe in-progress integration work. It must never be promoted into Genesis authority merely because a contextual target path exists in both environments.

Genesis documentation is frozen under the immutable `genesis` release. A Genesis contextual link may use `genesis/current` as the current alias or `genesis/genesis` as the explicit immutable release, subject to target availability.

When the two environments differ, the resolver must preserve the requested environment. Similar filenames, headings or semantic topics are not permission to cross environments.

## Historical contextual-link behavior

A previously published contextual-link ID remains semantically stable even as current documentation evolves.

For an immutable historical release:

- resolve the same contextual ID against the historical release inventory;
- preserve the historical target when it existed there;
- do not silently redirect to current content merely because the historical page was renamed or removed later;
- use an explicit DOC-13 migration/retirement declaration when a safe historical redirect is intended;
- otherwise fail closed.

A historical contextual link must never inherit new current-only claims retroactively.

## Deprecated and retired contextual IDs

DOC-14 deprecation/replacement semantics remain subordinate to version authority.

If a deprecated contextual ID names a replacement, the replacement may be followed only when the replacement itself resolves in the requested environment/version. A replacement that exists only in another environment or only in current documentation cannot rewrite a historical link automatically.

Retired IDs without an explicit safe replacement fail closed.

## Target inventory and anchors

Version publication authority does not prove target existence. After the environment/version is accepted, the resolver must verify the target path and any stable anchor against the selected release inventory.

For troubleshooting links this means the stable `TRB-*` anchor must exist in the selected release. A missing historical anchor is not permission to open a different release.

## Resolution algorithm

Given `contextual_link_id`, `environment`, and version selector (`current` or explicit release):

1. load the contextual record; fail if unknown/retired without safe replacement;
2. require the requested environment in the record's environment allow-list;
3. load the DOC-13 track for that same environment;
4. for `current`, require a non-null current release that is published;
5. for an explicit release, require it published under the same environment;
6. when the request is historical/permanent, require the explicit release to be immutable;
7. verify the target path/anchor exists in the selected release inventory;
8. construct the version-qualified URL;
9. otherwise fail closed without environment/release substitution.

## Invariants

DOC-14.7 establishes these invariants for later CI enforcement:

- contextual resolution never crosses environments;
- contextual resolution never falls back between releases implicitly;
- unpublished testnet/mainnet tracks cannot produce authoritative contextual URLs;
- development content cannot be advertised as Genesis/testnet/mainnet authority;
- current aliases exist only where DOC-13 publishes them;
- immutable historical links preserve historical meaning;
- mutable development documentation is never exposed as an immutable release;
- contextual deprecation/replacement cannot bypass DOC-13 publication authority;
- missing version-qualified paths or anchors fail closed.
