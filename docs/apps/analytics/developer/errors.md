# Analytics integration errors

Important classes include wrong network, stale source, incomplete source range, unsupported metric version, incompatible units/windows, degraded Indexer, provenance unavailable and finalized inconsistency.

Fail closed when a metric is used for a decision that requires a complete/finalized source range but the response cannot prove that condition.

Transient indexing/backfill failures may be retried. Wrong-chain or semantic-version mismatches require configuration or caller correction.
