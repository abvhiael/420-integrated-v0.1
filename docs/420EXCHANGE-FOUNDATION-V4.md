# 420Exchange Foundation V4 — Canonical Liquidity Execution

V4 productionizes the first executable ERC20/ERC20 liquidity venue beneath the qualified V3 420Exchange router and canonical 420Swap adapter.

## Added

- `CanonicalConstantProductPool420`
  - deterministic constant-product quoting
  - configurable immutable swap fee capped at 1%
  - executor-only swap entrypoint compatible with `CanonicalSwapExecutor420`
  - exact-input settlement with caller-provided minimum output
  - permissionless liquidity provision/removal
  - internal non-transferable LP shares for V1
  - permanently locked minimum liquidity on pool initialization
  - exact balance-delta checks that reject fee-on-transfer/rebasing behavior
  - reentrancy protection
  - reserve synchronization from actual token balances
  - no governance owner, seizure path or arbitrary reserve setter

## Core invariants

1. Only the immutable canonical executor may invoke pool swap execution.
2. A swap cannot spend more than the requested exact input.
3. A swap cannot settle below the requested minimum output.
4. For supported standard ERC20 assets, reserve accounting follows actual balances after every transfer.
5. Fee-on-transfer/rebasing behavior fails closed rather than silently corrupting reserves.
6. With a non-negative fee, the constant-product reserve invariant cannot decrease from an accepted swap except for integer-rounding behavior already biased toward the pool.
7. LP withdrawals are bounded by the caller's recorded share ownership and proportional pool reserves.
8. The initial minimum-liquidity tranche remains permanently locked at the zero address.
9. The pool has no hidden owner, reserve-writing authority or confiscation function.

## Deliberate V4 scope

V4 is the first production candidate for canonical ERC20/ERC20 420Swap execution. It does not yet provide:

- concentrated-liquidity ticks/ranges
- multi-hop aggregation
- TWAP/oracle circuit breakers
- native `$420` value-path/wrapped-native semantics
- transferable LP position tokens/NFTs
- fee governance after deployment
- protocol-fee extraction from pool fees

Those remain separate stages so the basic execution and accounting surface can qualify independently before more complex routing and liquidity mechanics are introduced.
