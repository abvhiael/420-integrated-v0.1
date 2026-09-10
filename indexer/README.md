# 420Indexer implementation map

GEN-11.1 implements a shared, rebuildable read layer for the 420 Integrated ecosystem.

## Packages

- `indexer/model` — canonical-source records, checkpoints and health/finality metadata.
- `indexer/core` — chain validation, checkpoint progression, finality boundaries and reorg safety.

## Planned packages

- `indexer/rpc` — JSON-RPC ingestion and source consistency validation.
- `indexer/store` — persistent rebuildable storage.
- `indexer/reorg` — deterministic ancestry discovery, rollback and replay.
- `indexer/decoder` — version-aware protocol event decoding sourced from 420Registry.
- `indexer/api` — stable read APIs for Explorer/Search/Analytics/Notifications/Status.
- `indexer/cmd/indexer420` — production service entry point.

No package in this tree is permitted to become canonical protocol authority or to hold wallet/custody execution authority.
