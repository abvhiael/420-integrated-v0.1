# 420 Swap security

Verify asset identity instead of relying on symbols. Confirm route/market eligibility, amount bounds, minimum output and transaction destination before signing.

Fail closed on stale quotes, wrong-network state, disabled routes, unhealthy markets, stale oracle references or excessive deviation. Do not approve arbitrary unlimited spending to bypass a failed trade.

## TWAP security invariants

- Reference prices originate from cumulative state of the active canonical Swap pool, never caller-supplied or governance-supplied price values.
- Governance may configure TWAP window/freshness policy but cannot directly inject an observation.
- A TWAP is unavailable until a complete configured minimum observation window has elapsed.
- An interval longer than the configured maximum window is discarded and reseeded rather than silently accepted.
- A canonical pool/pair/code/metadata change invalidates the previous source baseline and prior observation.
- Security-sensitive reads fail closed after `maxStalenessSeconds`.
- The 420Oracle adapter consumes the fail-closed Swap observation instead of bypassing freshness through the raw compatibility getter.
- Exchange compares realized normalized execution price to the TWAP only as a circuit breaker. TWAP never sets AMM output.
- Single-pool TWAP confidence remains explicitly `0`; consumers that require statistical confidence must add independent sources through 420Oracle rather than inventing confidence.

## Public batch auction security invariants

- The auction never mints native 420; inventory must already exist in the contract before governance can reserve it.
- Per-auction inventory is capped at 100,000 native 420, matching the PublicDistributionVault daily release bound.
- Only a currently canonical approved quote asset may be escrowed.
- Public bids use exact balance-delta custody checks; non-exact token behavior fails closed.
- Bids stop at `closesAt`; settlement cannot occur before close and cannot be replayed.
- Oversubscribed fills are deterministic pro-rata allocations; undersubscribed inventory is released instead of becoming implicitly sold.
- Every bidder's quote deposit is conserved as `quoteSpent + quoteRefund`.
- Claims are one-shot and pull-based, avoiding an unbounded settlement loop.
- Cancellation releases reserved native inventory and preserves full bidder refunds.
- Refund/claim recovery remains available under the shared SAFE_WHEN_PAUSED path so emergency controls do not trap escrowed user value.
- Governance remains responsible for the clearing-price decision because no different canonical clearing algorithm is frozen in repository authority; that authority cannot bypass custody, fill, refund, or claim accounting.
