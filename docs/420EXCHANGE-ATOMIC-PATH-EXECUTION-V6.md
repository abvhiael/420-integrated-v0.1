# 420Exchange — Atomic Path Execution V6

## Scope

V6 adds bounded atomic multi-hop execution on top of the qualified V5 routing and oracle model.

The slice introduces `ExchangePathExecutor420`, which executes one to four governance-approved route hops while preserving the caller as the payer throughout the path. Intermediate hop output is delivered back to the calling account and becomes the input pulled by the next approved execution adapter in the same transaction. The executor itself never becomes a token custodian.

## Execution model

Each hop binds:

- an active 420Exchange market;
- an active governance-approved route adapter;
- the expected output token;
- a hop-specific minimum output;
- venue-specific route data.

Execution is exact-input. The initial input amount is fixed and every subsequent hop consumes the amount actually delivered by the prior hop. All hops execute in one transaction, so any failed market check, authorization check, adapter execution or slippage check reverts the entire path.

## Path commitment

`hashPath` commits to:

- the V6 path domain;
- chain ID;
- executor address;
- principal/payer;
- input token and amount;
- final minimum output;
- final recipient;
- every hop, including market ID, route ID, output token, hop minimum and route payload.

`executeExactInputPath` requires the caller-supplied expected hash to match the execution inputs. A route, recipient, amount, payload or slippage mutation therefore invalidates the commitment.

## Authorization

The caller remains the principal for every hop. `ExchangeAuthorization420.canSwap` is checked independently for each market using that hop's actual input amount. This allows Smart Account and session-key policies to fail closed if any market scope or amount is outside the granted capability.

V6 does not add an alternate payer, relayer spending authority or executor-owned balance model.

## Market and asset validation

Before each adapter call:

1. the market must remain active;
2. its underlying assets must remain trade-eligible through the market registry's live eligibility check;
3. the market's configured exchange-token pair must exactly match the current input token and requested hop output token;
4. the route must remain active in `ExchangeRouteRegistry420`.

A suspension, moderation change, delisting, route disablement or mismatched path therefore fails closed at execution time.

## Slippage

V6 applies two layers of exact-input slippage protection:

- every hop has its own `minAmountOut`;
- the complete path has `minFinalAmountOut`.

An adapter result below either applicable bound reverts the transaction.

## Emergency behavior

The existing `SWAPS` emergency domain gates the complete path before execution begins. A halted exchange cannot enter a multi-hop path.

## Custody invariant

**V6-INV-CUSTODY-001:** `ExchangePathExecutor420` never intentionally receives or holds path assets.

For non-final hops, the approved adapter settles output to the caller. For the final hop, it settles output directly to the requested recipient. The caller remains the payer passed to every adapter.

## Atomicity invariant

**V6-INV-ATOMIC-001:** no partial multi-hop result can survive a later-hop revert.

All adapter calls occur within a single EVM transaction. Any later failure reverts the earlier calls and their token state changes.

## Path integrity invariant

**V6-INV-PATH-001:** execution-critical path fields cannot differ from the caller's committed path hash.

## Authorization invariant

**V6-INV-AUTH-001:** every hop must independently satisfy the caller's swap capability for the hop market and actual hop input amount.

## Bounds

Paths are limited to four hops, matching `ExchangePathQuoter420.MAX_HOPS` from V5.

## Explicitly deferred

V6 does not add:

- limit-order execution;
- bridge execution;
- arbitrary external call routing;
- executor custody;
- a new oracle pricing authority;
- best-route search on-chain;
- unbounded route composition.

Those remain separate slices so V6 can qualify as a narrow execution layer on the already-approved V5 routing model.
