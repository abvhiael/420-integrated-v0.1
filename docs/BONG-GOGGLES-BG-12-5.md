# Bong Goggles BG-12.5 — Search & Recommendation Query Service

BG-12.5 adds the production query layer over the deterministic Phase-12 projections while preserving the canonical authority boundary defined by `BongGogglesSearchIndexSurface420`.

## Search classes

The backend understands the canonical V1 search classes:

- PEOPLE
- PAGES
- GROUPS
- POSTS
- PLACES
- PRODUCTS
- BRANDS
- EVENTS
- RESOURCES
- COLLECTIONS
- GAMES

Projected entities are classified deterministically. Social-object collections are kept separate from ordinary posts, and discovery subjects map only to their canonical discovery classes.

## Authority boundary

The indexer may retrieve, rank, paginate and recommend candidates, but it never decides whether a candidate is actually visible to a viewer.

Every candidate must pass `canonicalEligibility(...)` at query time before it can be returned. Production wiring is expected to resolve that callback against the canonical read surfaces/contracts at the requested snapshot context. A missing canonical eligibility provider is a construction error and therefore fails closed.

This is particularly important for PAGES, GROUPS and community EVENT candidates. The current `BongGogglesSearchIndexSurface420` exposes explicit canonical eligibility functions for profiles, social objects and discovery subjects, while community-specific page/group/event visibility is represented by their canonical registries/policies. The backend therefore does not infer permission from materialized `active` or privacy fields.

## Deterministic ranking and pagination

- candidate pools come only from the deterministic projector state
- query text is normalized before backend hashing
- default ranking is deterministic and can later be replaced by a versioned ranking adapter
- result ordering is stable for the same projected state/query
- pagination carries the BG-12.1 schema/chain/snapshot/ranker-bound cursor envelope
- callers may supply the canonical on-chain `queryCursorDigest`; the backend binds it into its cursor envelope rather than substituting for it
- cursors cannot point ahead of the indexed snapshot

## Recommendations

Recommendation candidate generation uses the same canonical eligibility requirement as search.

The returned recommendation envelope binds:

- viewer
- search class
- surface ID
- model ID
- deterministic candidate-set hash
- indexed snapshot block
- optional canonical `recommendationDigest`
- backend digest

The model/ranker may order candidates off-chain; final viewer eligibility is still canonical.

## Freshness

Each search and recommendation response includes the indexed block number, indexed block hash and local observation time. BG-12.7 will connect this to production RPC ingestion/lag metrics and canonical freshness reporting.

## Phase-12 integration

BG-12.5 remains on `feature/bong-goggles-phase12-monolithic` in PR #307. It is not merged independently. BG-12.6 and BG-12.7 continue on the same branch, followed by reconciliation with current `main` and one final Phase-12 qualification/merge.
