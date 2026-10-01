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
