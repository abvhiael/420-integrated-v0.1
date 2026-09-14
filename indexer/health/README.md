# 420Indexer health semantics

420Indexer health is an operational signal only. It must never be interpreted as canonical chain state.

Expected states include:

- `STARTING`
- `HEALTHY`
- `DEGRADED_WRONG_CHAIN`
- `DEGRADED_FINALIZED_CONFLICT`
- future persistent-store/RPC degradation states

Every consumer should display indexed height, safe height, finalized height, schema version and freshness so stale derived data is not presented as authoritative current state.
