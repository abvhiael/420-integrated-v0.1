# Analytics events and update semantics

Analytics does not define canonical protocol events. Metric updates are derived operational events.

A pre-finality source event can be removed/replaced during reorg repair, requiring affected aggregates to be recomputed. Backfills and formula-version changes can also legitimately revise derived values.

Consumers should distinguish `new source data`, `recomputed due to reorg/backfill`, and `new metric-definition version` rather than treating all changes as equivalent.
