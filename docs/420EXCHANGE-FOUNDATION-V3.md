# 420Exchange Foundation V3 — Guarded Spot Execution

Foundation V3 turns the V1/V2 registries, authorization and emergency controls into a concrete non-custodial spot execution path over approved liquidity adapters.

## Scope

- `ExchangeRouter420` is the user-facing spot execution boundary.
- `CanonicalSwapAdapter420` maps approved 420Exchange routes onto the existing canonical `420Swap` executor.
- Swap capability checks are now scoped to the dedicated `EXCHANGE_ROUTER` component ID.
- Quotes and execution are restricted to active exchange markets and active approved route adapters.
- The payer is always the router caller. V3 intentionally does not expose an arbitrary `payer` argument.
- Emergency `SWAPS` halt is checked before execution.
- The router itself takes no token custody and performs no token approval.

## Route model

A route remains governance-approved in `ExchangeRouteRegistry420` and contains separate quote and execution adapters. This keeps market discovery and execution venue policy replaceable while 420Swap remains the initial canonical liquidity layer.

For `CanonicalSwapAdapter420`, `routeData` is exactly:

```solidity
abi.encode(bytes32 canonicalMarketId)
```

The adapter independently verifies that the canonical 420Swap market is active, has deployed pool code and matches the requested token pair before quote or execution.

## Quote boundary

The canonical adapter expects production 420Swap pools to implement:

```solidity
quoteCanonicalSwap(address tokenIn, address tokenOut, uint256 amountIn)
    returns (uint256 amountOut, uint256 priceImpactBps)
```

The current `CanonicalPool420` remains an explicitly documented reference scaffold and does not yet satisfy that production pool interface. V3 therefore establishes the exchange/420Swap integration boundary without falsely treating the scaffold pool as production liquidity.

## Execution invariants

- EX-INV-ROUTER-001: a swap must reference an active 420Exchange market.
- EX-INV-ROUTER-002: tokenIn must be one side of the registered market and tokenOut is derived on-chain.
- EX-INV-ROUTER-003: only an active governance-approved route may execute.
- EX-INV-ROUTER-004: the payer is exactly `msg.sender`; no arbitrary third-party payer is accepted.
- EX-INV-ROUTER-005: the caller must hold a market-scoped `ACTION_SWAP` capability against `EXCHANGE_ROUTER` for the requested amount.
- EX-INV-ROUTER-006: the SWAPS emergency domain fails execution closed.
- EX-INV-ROUTER-007: execution output must meet or exceed the user-specified minimum.
- EX-INV-ROUTER-008: the exchange router never takes omnibus custody or grants token allowances.
- EX-INV-ADAPTER-001: canonical route data contains exactly one nonzero canonical market ID.
- EX-INV-ADAPTER-002: the canonical 420Swap market must be active and pair-matched.
- EX-INV-ADAPTER-003: canonical execution may not overspend input or under-deliver the requested settlement minimum.

## Focused tests

`ExchangeRouter420.t.sol` covers:

- quoting an active verified market;
- authorized self-payer execution;
- capability denial;
- emergency SWAPS halt;
- rejection of tokens outside the registered pair.

## Deferred to subsequent stages

- production 420Swap pool implementation / concentrated-liquidity engine;
- route aggregation across multiple hops and venues;
- oracle/TWAP sanity guards and circuit breakers;
- exchange-fee extraction integrated atomically with execution;
- signed limit-order nonce/domain/fill accounting;
- bridge ingress/egress adapters;
- native `$420` value-path handling and wrapped-native policy.
