
# 420Pay — Genesis Contract Implementation & Test Status

Genesis Decisions #1–#4 are frozen.

Implemented source-level components:
- InvoiceRegistry420
- PaymentRegistry420
- MerchantRegistry420 with versioned/delayed payout profiles
- PaymentRouter420 with payer spend limits and fail-closed health checks
- SettlementRouter420 with max-eight split settlement and deterministic remainder
- RefundManager420
- GasSponsor420 with frozen sponsorship caps and reserve floor
- AccountingCommitment420

Foundry test sources cover settlement remainder and core constants. Static verification checks the
frozen invariants.

This runtime does not necessarily contain Foundry/solc. A PASS from static verification is not a
claim that Solidity has compiled, executed or been audited. The release remains blocked until:
1. pinned Solidity compilation succeeds;
2. all Foundry tests pass;
3. fuzz/invariant tests run;
4. canonical market/asset-health adapters are wired;
5. payment swaps are implemented atomically against the canonical DEX;
6. cryptographic invoice-signature verification is finalized and tested;
7. external security review completes.
