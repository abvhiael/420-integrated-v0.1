
# 420Pay Genesis Parameters — Frozen

420Pay defaults to FINALIZED merchant acceptance.

Invoices default to SINGLE_USE and cannot be paid twice. MULTI_USE and PARTIAL_PAYMENT modes are
available only when explicitly declared. Partial payments are disabled by default.

Quote lifetime is 42 seconds. Canonical swap-assisted payments are atomic-or-revert and fail closed
when canonical pricing is unavailable. No centralized fallback price and no silent substitution of a
merchant's requested settlement asset are permitted.

Split settlement is supported at genesis.

Refund windows and invoice lifetimes are merchant-defined and disclosed in signed invoice data.
Direct finalized payments have no unilateral chargeback. Escrow/dispute rules apply only to explicit
escrow transactions.

Tips may be directed to a distinct disclosed tip-pool or employee address.

Merchant status levels are UNVERIFIED, REGISTERED, CREDENTIALED and REGULATED. Status affects
presentation/optional limits, not basic ability to receive payments.

GasSponsor420 must enforce per-wallet, per-merchant and global daily limits and may sponsor only
whitelisted payment/onboarding operations. It gains no arbitrary wallet transaction authority.

Accounting exports are a genesis requirement; sensitive purchase details remain off-chain.
