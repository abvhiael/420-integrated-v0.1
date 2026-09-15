# 420Analytics ANALYTICS-3.2 — Validator and staking metrics

ANALYTICS-3.2 adds derived validator/staking metrics without creating staking authority inside 420Analytics.

## Source boundary

All validator inputs are normalized public projections derived from qualified 420Indexer data and bound to the ANALYTICS-2 snapshot provenance. 420Analytics does not read ValidatorRegistry, CommunityValidatorReserve, RewardController or node420 RPC directly.

Canonical staking and validator lifecycle authority remains in the protocol/consensus layer. Analytics outputs are non-canonical and rebuildable.

## Genesis metric set

- `validator.registered_count` — unique indexed validator projections.
- `validator.active_count` — validators whose indexed lifecycle is `active`.
- `validator.native_collateral` — summed validator-owned collateral in base units.
- `validator.community_collateral` — summed community-reserve collateral assigned to validators in base units.
- `validator.accrued_rewards` — summed indexed accrued validator rewards in base units.

All metrics use `MetricValidator`, point-in-time observation windows, methodology version `v1`, and exact ANALYTICS-2 provenance.

## Lifecycle model

Genesis analytics recognizes only `registered`, `active`, `exiting`, and `cooldown`. Unknown states fail closed rather than being silently classified.

## Safety invariants

- qualified 420Indexer provenance is mandatory;
- at least one validator projection is required for this producer;
- duplicate validator identities are rejected case-insensitively;
- arithmetic overflow fails closed;
- no delegation metric exists because Genesis exposes no public delegation;
- no stake-weighted governance metric exists;
- no metric is canonical protocol state.
