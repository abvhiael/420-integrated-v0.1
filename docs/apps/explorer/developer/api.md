# Explorer API integration

Use 420Indexer Public API v1 as the machine-readable backend for Explorer-class data. Consumers should validate chain identity, response version, provenance and current indexed/finalized cursors.

API responses are read-only projections. They must not be treated as authorization, settlement or ownership proof independent of the referenced canonical source.

Use opaque pagination tokens as supplied; do not construct internal database offsets. Retry transient transport failures conservatively and fail closed on wrong-chain or finalized-conflict signals.

See `docs/420INDEXER-API-V1.md` for the current stable surface.
