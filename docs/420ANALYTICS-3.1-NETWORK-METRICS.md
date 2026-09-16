# ANALYTICS-3.1 — Network and chain metrics

420Analytics derives network and chain metrics only from the qualified 420Indexer v1 status boundary.

## Genesis metric set

- `network.indexed_height`
- `network.safe_height`
- `network.finality_depth`
- `network.projection_lag`

All four metrics use class `network`, schema `420-analytics-metric-v1`, methodology version `v1`, point-window semantics, and the exact ANALYTICS-2 provenance snapshot.

`network.finality_depth` is derived as `indexedHeight - safeHeight`.

`network.projection_lag` uses the Indexer-reported lag when present. The Indexer API documents lag as optional, so an omitted value is represented as zero rather than inferred from private storage or node RPC.

## Qualification boundary

Metric production fails closed when:

- the Indexer claims canonical authority,
- chain ID differs from the bound analytics provenance,
- indexed height differs from the bound provenance,
- indexed head hash differs from the bound provenance,
- safe height differs from the bound provenance,
- safe height exceeds indexed height, or
- a present lag value is malformed.

No direct `node420` RPC, SQL projection schema, or undocumented Indexer internals are used.

These values describe the 420Indexer projection snapshot. They do not become canonical chain or protocol authority.
