---
title: Contextual-link authority and URL contract
audience:
  - developer
  - operator
category: architecture
status: current
version: current
---

# DOC-14.1 — Contextual-link authority and URL contract

A contextual link is an application-owned pointer into canonical 420Docs content. It helps a user move from a runtime state to the relevant documentation without giving the application authority to redefine documentation meaning, environment, release status or recovery guidance.

## Authority model

420Docs remains authoritative for documentation content. DOC-13 remains authoritative for documentation environment/version publication. DOC-11 remains authoritative for stable troubleshooting identifiers and recovery guidance.

Applications may choose **when** to expose contextual help and **which stable contextual-link ID** applies to a runtime state. They must not redefine the target path, environment authority, release authority or troubleshooting semantics independently of the contextual-link registry.

A contextual link never proves:

- canonical chain state;
- transaction success or finality;
- deployment authenticity;
- application eligibility;
- provider correctness;
- user authorization;
- network support merely because documentation exists.

Runtime code must establish those facts through their canonical sources.

## Canonical target classes

Every contextual-link record resolves to one of four target classes:

- `task` — procedural guidance for an action;
- `concept` — explanatory guidance for a state or boundary;
- `reference` — technical reference intended for developers/operators;
- `troubleshooting` — DOC-11 recovery/help material, preferably a stable `TRB-*` anchor.

A single stable contextual-link ID has one semantic purpose. IDs are never reassigned to unrelated help topics.

## URL resolution model

Application code should store or emit a stable contextual-link ID rather than a hard-coded absolute 420Docs URL. A resolver combines that ID with the active documentation environment/version authority and returns the published route.

Authoritative versioned targets follow DOC-13 semantics:

`/versions/<environment>/<token>/<path>`

where `<token>` is either the published `current` alias for that environment or an explicitly published immutable release.

Flat, pre-versioned 420Docs routes are compatibility-only. They must not be used by runtime clients as evidence of Genesis, testnet or mainnet publication.

## Environment rules

Resolution is environment-local.

- Development contextual links resolve only within the published development track.
- Genesis contextual links resolve only within the published Genesis track.
- Testnet contextual links remain unavailable until a testnet documentation track is published.
- Mainnet contextual links remain unavailable until a mainnet documentation track is published.
- No resolver may silently substitute one environment for another.

An application may present a neutral unavailable-help state when the requested documentation environment is not published. It must not redirect to development content and label it as testnet/mainnet guidance.

## Current and historical releases

A `current` target is valid only when DOC-13 defines a published current alias for that environment.

A historical target is valid only when its release is explicitly published and immutable. Historical contextual links must preserve the historical documentation meaning of the target and must not rewrite themselves onto current content merely because the current page has a similar title.

If a historical target no longer has an equivalent page, the resolver fails closed or resolves to an explicitly declared migration/retirement target under DOC-13 policy.

## Troubleshooting targets

Troubleshooting contextual links should resolve directly to the stable DOC-11 entry anchor:

`/troubleshooting/<registry-page>/#trb-domain-nnn`

The `TRB-*` ID is the durable semantic identifier. Applications must not copy the full recovery procedure into runtime code as a competing source of truth.

Applications may display concise local safety text before opening documentation, especially for value-risk or security-critical conditions, but that text must not contradict the canonical troubleshooting entry.

## Failure behavior

Resolution fails closed when:

- the contextual-link ID is unknown;
- the target has been retired without an explicit replacement;
- the target path or anchor no longer exists;
- the requested environment is unpublished;
- the requested release is unpublished or mutable where immutability is required;
- resolution would cross environments;
- resolution would require automatic fallback to a different release;
- the target violates audience/security constraints defined by the registry.

The client may show a generic `Open 420Docs` entry point when a specific contextual target is unavailable, but must not fabricate a specific route.

## Privacy and URL safety

Contextual URLs must not contain secrets or private payloads. Do not place seed phrases, private keys, passkey material, recovery secrets, access tokens, private Messenger content, private AI inputs/outputs or unrelated Identity data in path segments, query strings or fragments.

Public identifiers such as a transaction hash may be passed only when a later DOC-14 integration contract explicitly declares a safe parameter shape. Static contextual links defined by DOC-14.1 carry no runtime user data.

## Application fallback hierarchy

When contextual help is requested:

1. resolve the stable contextual-link ID under the active environment/version;
2. if unavailable, present a neutral help-unavailable state;
3. optionally offer the generic 420Docs landing page for the same published environment;
4. never cross environments or rewrite onto development documentation automatically;
5. never weaken runtime safety because documentation is unavailable.

## Contract invariants

DOC-14 validation will enforce that:

- every registered contextual-link ID is unique and stable;
- every published target exists;
- troubleshooting anchors match stable DOC-11 identifiers;
- authoritative links resolve only to published DOC-13 tracks/releases;
- no cross-environment or implicit cross-release fallback is permitted;
- retired links are explicit rather than silently repurposed;
- application integrations reference stable IDs instead of duplicating canonical recovery guidance.
