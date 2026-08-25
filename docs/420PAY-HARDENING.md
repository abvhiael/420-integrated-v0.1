
# 420Pay Hardening Pass

This pass adds source-level fuzz/property tests for:
- atomic settlement rollback;
- payer spend ceilings;
- single-use duplicate protection;
- split-settlement conservation;
- refund bounds;
- GasSponsor gas/cost/usage exhaustion.

It also adds:
- `CanonicalSwapHealthAdapter420`;
- `CanonicalSettlementAdapter420`;
- `ICanonicalSettlement420`.

The settlement adapter requires a fresh 42-second quote, healthy canonical market, active settlement
asset, no quote replay, no payer input overspend, and merchant delivery at or above the exact invoice
settlement amount. If the underlying canonical swap call fails or any postcondition is violated, the
EVM transaction reverts atomically.

The current swap executor remains an external audited component to be wired to the finalized
canonical 420 Swap implementation. Test mocks are not production executors.

Foundry/solc execution remains a release gate when those tools are unavailable in the current runtime.
