---
title: Documentation URL and renderer version model
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# Documentation URL and renderer version model

DOC-13.4 defines how version identity is represented in published 420Docs URLs and how the renderer exposes enough deterministic context for later version-selection UI without silently substituting incompatible content.

## Route classes

420Docs uses two version-qualified route classes.

### Immutable release route

`/versions/<environment>/<release>/<path>`

This route identifies one published release record in one environment. The `<release>` segment must resolve to an immutable published release in `docs/versioning/version-registry.json`.

An immutable release route must never be rewritten to another release merely because the requested page is missing. If the release or page does not exist, the renderer returns an explicit not-found result.

### Current alias route

`/versions/<environment>/current/<path>`

`current` is a moving alias and is resolved through the version registry. It is not itself a historical release identity.

A current alias may move only when the registry changes deliberately. Resolution must remain inside the requested environment; testnet `current` cannot fall through to development or mainnet, and an unpublished environment cannot advertise a current alias.

## Existing flat URLs

Pre-versioned 420Docs URLs remain compatibility surfaces during DOC-13. They do not become immutable version identities.

DOC-13.4 does not redirect or reinterpret those paths. DOC-13.8 owns migration and redirect policy so legacy links can be handled explicitly rather than silently mapped to an incompatible release.

## No silent fallback

The renderer must not:

- fall from an unknown release to `current`;
- substitute a page from another release when the requested release lacks that page;
- cross environments to satisfy a route;
- advertise unpublished testnet/mainnet tracks;
- infer a canonical network or deployment merely from the URL.

Missing version/page combinations resolve as unavailable/not-found until an explicit redirect, tombstone, or compatibility rule exists.

## Renderer manifest

`scripts/render-doc-version-context.py` produces a deterministic runtime manifest from the canonical registry and URL policy.

The generated site artifact is `version-context.json`. It contains only registry-approved published tracks/releases and route templates. This gives the rendered site a single version-context source without turning browser-side state into documentation authority.

The renderer manifest is descriptive routing data. The canonical authority remains:

1. `docs/versioning/version-registry.json`;
2. release manifests under `docs/versioning/releases/`;
3. source/network/deployment evidence referenced by those manifests.

## Build behavior

GitHub Pages builds normal MkDocs content first and then generates `site/version-context.json` from repository-controlled versioning sources. Qualification validates the same resolver and manifest generation before publication.

DOC-13.5 may use this manifest to implement visible version/environment navigation. DOC-13.4 intentionally does not create selector UX yet.

## Stability rules

- Immutable release URLs are stable for the lifetime of the retained release.
- `current` URLs are stable aliases whose target may change deliberately through the registry.
- A historical release cannot resolve through `current` as its identity.
- A missing historical page remains missing unless DOC-13.8 defines an explicit compatible redirect/tombstone.
- Version-qualified URLs never upgrade authority beyond the registry/manifests/evidence that back them.
