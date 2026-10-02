# 420 Swap architecture

420 Swap supplies the canonical liquidity/execution layer. Exchange-style discovery or advanced routing may compose above it, but cannot replace canonical Swap execution semantics.

Execution rechecks current market/route state, authorization, exact input accounting, minimum output and configured safety/oracle-health conditions. Routing custody must be transient and balance-checked.

## Canonical TWAP/reference path

The Swap TWAP is derived from the canonical on-chain market, not from a centralized API or arbitrary governance price submission.

`CanonicalConstantProductPool420` maintains cumulative token0/token1 reserve-price state across every reserve-changing sync. `TWAPOracle` resolves the current active market through `CanonicalMarketRegistry`, validates the exact pool/pair/code identity, and derives a time-weighted average only from cumulative-price deltas across a configured observation window.

Governance controls market-level minimum window, maximum window, freshness and enable/disable policy. Governance does **not** publish a price. Checkpointing is permissionless because callers cannot supply price data; they can only ask the oracle to derive the next observation from canonical on-chain state.

A changed canonical pool, pair, code hash or market metadata changes the committed source hash and resets the TWAP baseline. An overlong observation gap also reseeds instead of carrying an unbounded historic window forward.

The resulting observation exposes explicit source provenance, observation-window length, freshness expiry and normalized quote-per-base price. The Swap oracle implements the Exchange reference-price boundary directly and the 420Oracle TWAP adapter reads the same fail-closed observation.

Reference-oracle data is a circuit-breaker input; it does not unilaterally set executable market price.
