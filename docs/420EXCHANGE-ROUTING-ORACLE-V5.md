# 420Exchange Routing + Oracle V5

## Scope

V5 establishes the non-custodial routing and price-sanity layer above the qualified V4 liquidity foundation.

### ExchangePathQuoter420
- Composes quotes across 1-4 governance-approved route adapters.
- Never moves user funds and has no token approvals or custody authority.
- Rejects zero/duplicate hop tokens and inactive routes.
- Carries the exact output of each hop into the next quote.
- Returns final output plus aggregate adapter-reported impact.

### ExchangeOracleGuard420
- Provider-neutral reference-price guard.
- Oracle observations are circuit-breaker inputs only and never determine executable market price.
- Governance configures an oracle, maximum staleness, and maximum deviation per market.
- Fails closed for disabled guards, zero/future/stale observations, and excessive deviation.
- Maximum configurable deviation is 50%; maximum staleness is seven days. Production markets should use materially tighter settings.

## Invariants

- V5 routing contracts do not custody user funds.
- Only active, governance-approved route adapters participate in path quotes.
- A path is bounded to four hops to prevent unbounded quote execution.
- Oracle failure cannot silently authorize a guarded trade.
- Oracle/reference prices do not override AMM or orderbook execution prices.
- Multi-hop execution remains a separate settlement surface and must preserve the existing Smart Account authorization, slippage, emergency-halt, and no-arbitrary-payer invariants.

## Next implementation slice

Wire guarded paths into execution with atomic multi-hop settlement, per-hop minimums/final minimum output, path hashing, and market/asset validation. This should be hardened before bridge-expanded assets are activated for trading.
