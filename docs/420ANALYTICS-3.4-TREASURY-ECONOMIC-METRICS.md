# 420Analytics ANALYTICS-3.4 — Treasury and economic metrics

ANALYTICS-3.4 adds derived Treasury/economic metrics without creating custody or spending authority inside 420Analytics.

## Source boundary

All inputs are normalized public projections derived from qualified 420Indexer data and bound to the ANALYTICS-2 snapshot provenance. 420Analytics does not read Treasury contracts, 420Vault, node420 RPC, or private Indexer storage directly.

420 Treasury remains the governed budget/disbursement control plane. 420Vault remains the canonical custody and release boundary. Analytics reports rebuildable observations only.

## Genesis metric set

- `economic.treasury_budget_ceiling` — sum of indexed governed Treasury budget spending ceilings.
- `economic.treasury_committed` — sum of indexed amounts reserved against governed Treasury budgets.
- `economic.treasury_executed` — sum of indexed successfully executed governed Treasury budget amounts.
- `economic.treasury_scheduled_disbursement_volume` — sum of indexed disbursements currently in `scheduled` state.
- `economic.treasury_executed_disbursement_volume` — sum of indexed disbursements in `executed` state.

All metrics use `MetricEconomic`, point-in-time windows, methodology version `v1`, exact ANALYTICS-2 provenance, and `base_units` as the unit.

## Budget accounting contract

Every indexed budget projection must satisfy:

`executed <= committed <= spendingCeiling`

Violations fail closed. Duplicate budget IDs are rejected case-insensitively, and aggregate arithmetic must not overflow.

## Disbursement lifecycle

Genesis analytics recognizes only:

- `scheduled`
- `executed`
- `cancelled`

Cancelled disbursements remain valid audit records but contribute to neither current scheduled volume nor executed volume. Unknown states fail closed. Duplicate disbursement IDs are rejected case-insensitively.

## Provenance and coordinate rules

Every projection must:

- come from the qualified `420Indexer` source boundary;
- match the snapshot chain ID;
- have a nonzero block number at or below the qualified indexed height;
- share the exact ANALYTICS-2 provenance carried by the emitted metrics.

## Safety invariants

- no metric is canonical Treasury or Vault state;
- no direct Treasury contract read exists;
- no direct 420Vault custody read exists;
- no metric can authorize, schedule, execute, cancel, or recover funds;
- no custody balance is inferred from budget accounting;
- budget accounting invariants fail closed;
- unknown disbursement states fail closed;
- duplicate identities fail closed;
- arithmetic overflow fails closed;
- all outputs remain rebuildable from qualified indexed projections.
