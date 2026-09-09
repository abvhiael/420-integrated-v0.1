# Bong Goggles BG-12.2 — Domain Materialized Views

BG-12.2 builds Bong Goggles-specific read models on top of the deterministic BG-12.1 projector.

## Scope

This slice materializes four production-facing domains:

- profiles
- social objects
- relationship edges
- feed entries

The indexer remains non-authoritative. Canonical eligibility, audience, block, lifecycle and search policy still come from chain state and the Bong Goggles contracts.

## Guarantees

- every materialized view is derived only from canonical projector state
- profiles are keyed by canonical normalized account identity
- social objects preserve author, type, lifecycle, audience, provenance references, content hash and version
- relationship edges preserve directional type, status, mute and block state
- feed entries are keyed by feed class + viewer scope + object id
- ineligible feed entries are deleted rather than retained as stale rows
- inactive authors and inactive/deleted objects are omitted from visible feed output
- feed ordering is deterministic by rank key then object id
- relationship deletion removes stale edges deterministically
- view digests are deterministic for an identical canonical event stream
- materialized checkpoints follow BG-12.1 rollback/replay after reorgs

## Authority boundary

The backend does not decide whether a user may view content. Feed materialization represents candidate projection state only. Production query handlers must continue to revalidate viewer eligibility against canonical policy surfaces before serving private or restricted content.

## Next

BG-12.3 adds canonical event adapters/reducers for real Bong Goggles contract events and persistent projection storage/checkpoint recovery.
