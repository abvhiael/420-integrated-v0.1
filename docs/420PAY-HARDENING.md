
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

The repository contains the canonical `CanonicalSwapExecutor420` implementation and Pay/Swap integration tests. Production activation still requires deployment-time verification of the exact Registry-resolved `PaymentRouter420`, `CanonicalSettlementAdapter420`, `CanonicalSwapExecutor420`, and replay-consumer bindings. Test mocks are not production executors.

The settlement adapter is explicitly bound to the canonical payment router so another contract cannot use the executor-trusted adapter to bypass Pay authorization, limits, fee checks, or replay handling.

Foundry/solc execution is an exact-head qualification gate, and external independent security review remains a production/mainnet release gate under repository policy.
