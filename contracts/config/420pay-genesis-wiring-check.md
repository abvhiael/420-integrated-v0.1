# 420Pay Genesis wiring verification

Genesis verification MUST fail unless all of the following hold:

1. `PaymentRouter420.settlementAdapter()` resolves to the canonical `CanonicalSettlementAdapter420` instance.
2. `CanonicalSettlementAdapter420.paymentRouter()` resolves to the exact canonical `PaymentRouter420` instance.
3. `CanonicalSettlementAdapter420.swapExecutor()` resolves to the canonical `CanonicalSwapExecutor420` instance.
4. `CanonicalSwapExecutor420.trustedCaller(canonicalSettlementAdapter)` is `true`.
5. The configured payment router, settlement adapter and swap executor are deployed contracts and registered as active protocol components.
6. The replay-protection dependency resolves to a contract implementing both the frozen read-only `IReplayProtection420` surface and the mutable `IReplayConsumer420` companion.
7. The replay consumer binds `ReplayDomainIds420.PAY_SETTLEMENT` exclusively to `PaymentRouter420`.

This file is normative for the 420Pay Genesis remediation until the checks are encoded directly in the Genesis verifier.
