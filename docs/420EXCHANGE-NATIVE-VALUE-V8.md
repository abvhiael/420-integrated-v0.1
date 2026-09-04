# 420Exchange V8 — native $420 wrapping and value paths

## Scope

V8 establishes the canonical wrapped representation of native `$420` and binds native value entry/exit to the existing V6/V7 atomic execution path.

## Components

### Wrapped420

`Wrapped420` is the canonical ERC-20 representation of native `$420` for exchange settlement surfaces. Deposits mint W420 1:1 against native value. Withdrawals burn W420 before sending native value. Supply therefore tracks wrapped native reserves exactly under ordinary execution.

### Atomic router native entry

`swapExactInputNativePath` treats `msg.value` as the exact input amount, wraps it into W420, and executes the existing bounded atomic path. The original caller remains the authorization principal. The router acts only as the temporary first-hop payer and grants an exact transaction-local allowance to the approved execution adapter target.

### Atomic router native exit

`swapExactInputPathForNative` requires the final path token to be canonical W420. The final venue sends W420 to the router, the router verifies the exact output balance delta and V7 oracle guard, then unwraps precisely the realized amount and transfers native `$420` to the requested recipient.

## Security invariants

- V8-NATIVE-001: native input is exact `msg.value`; there is no silent overpayment bucket.
- V8-NATIVE-002: the user, not the router, remains the capability authorization principal.
- V8-NATIVE-003: only canonical W420 may represent native `$420` in value paths.
- V8-NATIVE-004: router-held W420 allowances are exact and reset to zero after use.
- V8-NATIVE-005: final W420 output is balance-delta checked before unwrap.
- V8-NATIVE-006: direct native transfers to the router are rejected; only W420 withdrawal callbacks are accepted.
- V8-NATIVE-007: oracle, slippage, authorization, market, route, or custody failure reverts the full transaction including wrap/unwrap effects.
- V8-NATIVE-008: successful native value paths leave no newly introduced native or wrapped balance stranded on the router.
- V8-NATIVE-009: cycle rejection prevents paths from leaving and later returning to W420 in a single atomic route.
- V8-NATIVE-010: unwrap burns W420 before external native transfer and is reentrancy guarded.

## Non-goals

V8 does not add retained Exchange fees. Fee extraction is the next execution-layer slice and must preserve exact accounting for both ERC-20 and native value paths.
