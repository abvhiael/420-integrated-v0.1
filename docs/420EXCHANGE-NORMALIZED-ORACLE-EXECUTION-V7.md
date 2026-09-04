# 420Exchange V7 — Normalized Oracle-Bound Execution

## Scope

V7 closes the deliberate V6 safety deferral around cross-decimal oracle enforcement. Atomic multi-hop execution now derives a canonical quote-per-base execution price from the actual registered ERC20 token decimals and requires every executed hop to pass the configured V5 oracle/TWAP guard.

## Execution normalization

For every hop, the router resolves the canonical market base and quote tokens from `ExchangeMarketRegistry420` and `ExchangeAssetRegistry420`.

`ExchangeOracleGuard420` then:

1. reads `decimals()` directly from both token contracts;
2. rejects missing, malformed, or unsupported decimal metadata;
3. normalizes raw base and quote amounts to 18-decimal amount space;
4. derives `quote / base` at 1e18 price precision;
5. compares the normalized execution price to the configured provider-neutral reference observation.

The same canonical quote-per-base price is produced whether the user trades base→quote or quote→base.

## Fail-closed behavior

Execution reverts when:

- a market oracle guard is disabled;
- the oracle observation is zero, future-dated, or stale;
- the normalized execution price is zero;
- token decimals cannot be read or exceed the supported bound;
- normalization would overflow or collapse a nonzero amount to zero precision;
- execution/reference deviation exceeds the configured per-market limit.

Because the guard runs inside the atomic path transaction, a failed oracle check rolls back venue transfers, intermediate custody, and transient approvals.

## Security model

- Oracle values remain circuit breakers only; they do not set swap settlement prices.
- Execution price is derived from realized hop amounts, not quoted amounts.
- Every hop is checked independently.
- Market orientation comes from the canonical Exchange market registry, not caller-supplied direction metadata.
- Token decimal metadata is obtained from the actual exchange token contract.
- V6 path hashing, authorization, market validation, emergency controls, cycle rejection, slippage checks, custody accounting, and zero-reset allowance lifecycle remain intact.

## V7 invariants

- **EXCHANGE-V7-INV-001:** raw token integer ratios are never compared directly to reference prices.
- **EXCHANGE-V7-INV-002:** every atomic hop must resolve to canonical base/quote orientation before oracle evaluation.
- **EXCHANGE-V7-INV-003:** both forward and reverse trades are evaluated as quote units per base unit at 1e18 precision.
- **EXCHANGE-V7-INV-004:** missing, invalid, or excessive token decimal metadata fails closed.
- **EXCHANGE-V7-INV-005:** stale, invalid, disabled, or excessively deviating reference observations fail closed.
- **EXCHANGE-V7-INV-006:** an oracle failure at any hop reverts the complete atomic path and leaves no intermediate custody or allowance residue.
- **EXCHANGE-V7-INV-007:** oracle observations cannot override the executable venue price; they only approve or reject the realized execution.

## Next slice

The next Exchange stage can build native `$420` wrapping/value-path support on top of the now oracle-bound ERC20 routing path, followed by atomic retained-protocol fee extraction.
