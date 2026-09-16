---
title: 420Analytics ANALYTICS-2 metric and snapshot contract
audience: [developer, architect, operator]
category: architecture
status: active
version: current
---

# ANALYTICS-2 — Metric model and snapshot contract

ANALYTICS-2 freezes the first public internal data contract used by 420Analytics to represent derived metrics and historical snapshots.

## Schema identities

- metric schema: `420-analytics-metric-v1`
- snapshot schema: `420-analytics-snapshot-v1`

Every metric is explicitly derived and non-canonical. Every snapshot is explicitly non-canonical and rebuildable.

## Metric classes

The ANALYTICS-0 classes remain frozen:

- network
- validator
- protocol
- economic
- cohort
- ranking
- forecast
- anomaly

No metric class creates protocol authority.

## Metric contract

Each metric carries:

- stable metric ID;
- class;
- human-readable label;
- finite numeric value encoded as text;
- explicit unit;
- methodology ID, methodology version and description;
- explicit point, block-range or time-range window;
- 420Indexer provenance;
- `canonical=false`.

Methodology metadata is mandatory so a historical value can be interpreted against the exact calculation definition that produced it.

## Window contract

A point metric has no range bounds.

A block-range metric carries inclusive start/end heights and may not extend beyond the Indexer snapshot height.

A time-range metric carries start/end timestamps and may not extend beyond the Indexer snapshot timestamp.

Mixed block/time range bounds fail closed.

## Provenance contract

Analytics provenance is bound to the qualified 420Indexer projection only and carries:

- chain ID;
- indexed height;
- indexed head hash;
- safe height;
- indexed timestamp.

Direct node420/RPC provenance is rejected. Safe height may never exceed indexed height.

## Snapshot contract

A snapshot contains one or more metrics bound to exactly one provenance context. Mixed provenance is rejected rather than silently combining values derived from different chain/indexer observations.

Snapshot IDs are deterministic hashes over the snapshot schema, chain ID, indexed height, indexed head hash, safe height and generation timestamp. The ID is therefore stable for the same snapshot context and detects accidental/tampered identity drift.

Snapshots do not become canonical history. They are versioned derived records that can be rebuilt from qualified public canonical sources through 420Indexer.

## Authority boundary

ANALYTICS-2 does not add chain ingestion, direct RPC, finality processing, protocol mutation, ownership/accounting authority, private-data ingestion or execution authority.
