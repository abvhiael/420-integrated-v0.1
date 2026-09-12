---
title: Documentation navigation and version selector contract
category: contributing
status: current
version: current
---

# Documentation navigation and version selector contract

DOC-13.5 defines how 420Docs exposes documentation release/environment context to readers and how a reader may move between published documentation contexts without silent substitution.

## Visible context

Every rendered documentation page must make the active documentation context discoverable. The renderer may derive the context from the version-qualified route or from the compatibility status of an unversioned legacy route.

The visible context must distinguish:

- environment;
- release or current alias;
- publication status;
- compatibility-only legacy URLs from version-qualified URLs.

A legacy flat URL is never allowed to imply an immutable release merely because the corresponding page also exists in a published release.

## Selector source of truth

The selector consumes the deterministic runtime manifest generated from `docs/versioning/version-registry.json` and `docs/versioning/url-renderer-policy.json`.

Only registry-published tracks/releases may be advertised. Testnet and mainnet remain absent from enabled choices while their registry tracks have no published release.

The selector must not derive available releases from filenames, prose, network names or URL guesses.

## Same-page switching

A version/environment switch is enabled only when the renderer can prove that the equivalent logical page exists in the target context.

If the equivalent page is unavailable:

- the target remains visible when useful for context;
- the control is disabled or marked unavailable;
- the renderer does not substitute a target landing page silently;
- the renderer does not fall back to current content;
- the reader remains on the existing page.

This preserves the DOC-13.4 fail-closed routing invariant.

## Audience navigation

Switching documentation context must preserve the logical page path when an equivalent page exists. The normal audience hierarchy (`Use`, `Build`, architecture, reference, troubleshooting, and documentation-project navigation) remains a property of the selected documentation tree rather than being replaced by a separate version-navigation hierarchy.

A context switch therefore changes documentation identity, not the reader's audience classification.

## Current repository behavior

The repository currently publishes the flat MkDocs corpus as a compatibility surface while version-qualified historical trees are not yet materialized. The selector therefore exposes the current compatibility context and the registry's published tracks, but it enables only targets whose page availability is explicitly present in the runtime manifest.

DOC-13.6 defines snapshot/retention behavior that will create immutable historical material. DOC-13.8 owns redirects and tombstones. DOC-13.5 does not fabricate either.

## Runtime availability manifest

`render-doc-version-context.py` records a deterministic `page_inventory` for the built site. Each item is a logical page path known to exist in the currently built corpus.

Future materialized release builds may supply release-specific page inventories. A selector target is actionable only when its target inventory contains the logical path.

## Core invariant

A version selector is a navigation aid, not an authority escalation mechanism. It may display only approved registry contexts and may navigate only to an explicitly available equivalent page. Missing documentation stays missing instead of resolving to content from another release or environment.
