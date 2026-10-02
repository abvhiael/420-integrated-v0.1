# 420Pay Genesis wiring verification

Genesis verification MUST fail unless all of the following hold:

1. `PaymentRouter420.settlementAdapter()` resolves to the canonical `CanonicalSettlementAdapter420` instance.
2. `PaymentRouter420.settlementRouter()` resolves to the exact canonical `SettlementRouter420` instance.
3. `CanonicalSettlementAdapter420.paymentRouter()` resolves to the exact canonical `PaymentRouter420` instance.
4. `CanonicalSettlementAdapter420.settlementRouter()` resolves to the exact canonical `SettlementRouter420` instance.
5. `CanonicalSettlementAdapter420.swapExecutor()` resolves to the canonical `CanonicalSwapExecutor420` instance.
6. `SettlementRouter420.paymentRouter()` resolves to the exact canonical `PaymentRouter420` instance.
7. `SettlementRouter420.settlementAdapter()` resolves to the exact canonical `CanonicalSettlementAdapter420` instance.
8. `RefundManager420.paymentRegistry()` resolves to the exact canonical `PaymentRegistry420` instance.
9. `CanonicalSwapExecutor420.trustedCaller(canonicalSettlementAdapter)` is `true`.
10. The configured payment router, settlement router, settlement adapter, payment registry, refund manager and swap executor are deployed contracts and registered as active protocol components.
11. The replay-protection dependency resolves to a contract implementing both the frozen read-only `IReplayProtection420` surface and the mutable `IReplayConsumer420` companion.
12. The replay consumer binds `ReplayDomainIds420.PAY_SETTLEMENT` exclusively to `PaymentRouter420`.
13. Every live GasSponsor reimbursement caller is explicitly governance-authorized through `GasSponsor420.setRelayer`; no arbitrary reimbursement target or arbitrary call execution path is configured.

This file is normative for the 420Pay Genesis remediation until the checks are encoded directly in the Genesis verifier.
