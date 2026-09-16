# ANALYTICS-6.2 — reorg, finality and freshness

420Analytics remains a rebuildable, non-canonical consumer of qualified 420Indexer projections. ANALYTICS-6.2 defines how derived snapshots behave as the indexed head changes.

## Finality boundary

A snapshot is treated as finalized for Analytics reconciliation when its qualified provenance reports `safeHeight >= indexedHeight`. Once a snapshot reaches that condition, a different snapshot for the same logical observation slot cannot replace it. Analytics never rewrites finalized history.

The term **safe** is intentionally preserved from the 420Indexer contract. Analytics does not invent a stronger consensus/finality claim than its upstream source provides.

## Nonfinalized reconciliation

A snapshot whose indexed height remains above the safe height is a nonfinalized projection. If the upstream head changes, a replacement for the same generated observation slot and metric set may replace it only when:

- the replacement is valid Analytics data;
- the chain remains the same;
- safe height does not regress; and
- the existing slot has not already become finalized.

Reconciliation is deterministic and idempotent. Reapplying the same replacement is a no-op.

## Freshness

Freshness is derived explicitly from Indexer `IndexedAt` provenance and a configured maximum age. Responses and runtime state must distinguish current data from stale data; stale projections must never silently appear current.

Future timestamps fail closed. A stale result remains non-canonical and cannot be promoted to protocol authority.

## Reorg semantics

Analytics does not perform independent chain reorg detection. 420Indexer owns chain ingestion and projection reconciliation. Analytics reacts only to changes in qualified Indexer provenance and rebuilds nonfinalized derived state from those projections.

No Analytics reorg/finality decision can change balances, settlement, validator state, ownership, governance, identity, rights, or any other protocol state.

## Qualification

ANALYTICS-6.2 tests require:

- finalized snapshots reject rewrites;
- nonfinalized slots reconcile deterministically;
- repeated reconciliation is idempotent;
- safe-height regression fails closed; and
- stale age is explicit and deterministic.
