# Bong Goggles BG-12.1 — Deterministic Indexer / Projection Foundation

BG-12.1 begins the production backend layer for Bong Goggles. It consumes canonical chain events and builds deterministic off-chain projections without becoming an authority source.

## Authority boundary

- chain contracts remain authoritative for profile, relationship, audience, content, discovery, moderation, reward and wallet state
- `BongGogglesSearchIndexSurface420` remains authoritative for search eligibility and canonical search cursor/freshness/schema semantics
- the backend may retrieve, project, cache and rank, but may not override canonical eligibility

## BG-12.1 guarantees

- canonical event identity is chain id + block + transaction index + log index
- exact duplicate events are idempotent
- conflicting reuse of an event identity fails closed
- block hash drift detects a reorg
- rollback to a known canonical block followed by replay deterministically rebuilds state
- entity projections carry source block/hash/transaction/log provenance
- state roots are deterministic for an identical event stream and schema hash
- cursor envelopes are bound to schema hash, chain id and snapshot block
- cursors cannot point ahead of the current indexed checkpoint

## Initial projection classes

The generic projector supports profile, relationship, post/comment/story, page/group/event, discovery/review, game, moderation, reward and notification projections through typed entity mutations. Domain-specific reducers are added in later BG-12 slices.

## Next

BG-12.2 adds canonical Bong Goggles domain reducers and materialized views for profiles, social objects, relationship edges and feeds.
