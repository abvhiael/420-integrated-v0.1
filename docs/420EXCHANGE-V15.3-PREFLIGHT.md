# 420Exchange V15.3 — Preflight, Simulation, Authorization & Gas Qualification

## Status

V15.3 inserts a fail-closed validation layer between deterministic V15.2 transaction construction and future wallet signing/broadcast.

Implementation:

- `exchange/web/core/preflight.js`
- V15.3 ABI helpers in `exchange/web/core/abi.js`
- `exchange/web/test/preflight.test.js`

## Required order of operations

Before an executable Exchange transaction may reach a wallet, V15.3 performs:

1. resolved deployment check;
2. runtime/transaction chain-ID equality;
3. live RPC `eth_chainId` equality;
4. quote/intent freshness check when freshness metadata is required;
5. exact ERC-20 allowance checks supplied by canonical execution-route metadata;
6. canonical `ExchangeAuthorization420` capability checks;
7. additional protocol static reads such as bridge qualification;
8. `eth_call` simulation of the exact V15.2 transaction;
9. `eth_estimateGas` on the exact same transaction.

Any failed gate blocks signing.

## Canonical authorization

V15.3 adds `ExchangeAuthorization420` to the required V15.1 deployment catalogue.

The preflight layer can query:

- `canSwap(address,bytes32,uint256)`
- `canPlaceLimitOrder(address,bytes32,uint256)`
- `canBridgeWithdraw(address,bytes32,uint256)`

The amount is always the exact raw integer amount used by execution. Authorization is not inferred from UI state.

## Allowance boundary

V15.3 deliberately does not assume that `ExchangeAtomicRouter420` is always the ERC-20 allowance spender.

The router permits an approved execution adapter to pull the initial ERC-20 directly from the payer. Therefore each allowance check must explicitly identify:

- token;
- owner;
- canonical spender/allowance target;
- required raw amount.

This spender must come from qualified route/deployment data. Missing or insufficient allowance blocks signing.

For maker limit orders, the canonical approval target is the deployed `ExchangeLimitOrderSettlement420` contract.

## Freshness

`freshnessGate` supports:

- quote/intent expiry;
- observed-at timestamp;
- optional maximum-age policy.

Expired or stale reviewed intent cannot advance to signing even if its calldata was valid when first built.

## Simulation

V15.3 calls `eth_call` with the exact V15.2 transaction request. This catches protocol-level failures before signature/broadcast, including:

- inactive market/route;
- path-hash mismatch;
- authorization failure;
- slippage failure;
- emergency controls;
- bridge route or adapter failures;
- token transfer/allowance failures;
- limit-order state violations.

Simulation success is necessary but is not a guarantee that a later transaction will succeed because chain state can change after simulation.

## Revert decoding

The preflight layer decodes:

- Solidity `Error(string)`;
- Solidity panic selector;
- custom-error selectors.

Known Exchange custom-error selectors are mapped back to signatures such as:

- `UnauthorizedSwap()`
- `SlippageExceeded()`
- `PathHashMismatch()`
- `InvalidAllowanceTarget()`
- `OrderExpired()`
- `OrderCancelled()`
- `UnauthorizedLimitOrder()`
- `RouteIneligible()`
- `AdapterMismatch()`
- `ProvenanceMismatch()`

Unknown custom errors preserve their selector and raw revert data rather than being guessed.

## Gas estimate

A successful `eth_estimateGas` is mandatory after simulation. Missing, malformed, zero, or reverted estimation blocks signing.

V15.3 records the estimate but does not add a gas margin or submit a transaction. Wallet submission remains a later phase.

## What V15.3 does not do

V15.3 does not:

- request a wallet signature;
- broadcast with `eth_sendTransaction`;
- sign EIP-712 limit orders;
- choose a route or allowance target;
- invent an approval transaction;
- wait for inclusion/finality;
- reconcile receipts with V13 indexed state.

Those remain later V15 phases.

## Exit criteria

V15.3 is repository-complete when the test suite proves:

1. exact chain binding;
2. freshness enforcement;
3. raw allowance enforcement;
4. canonical authorization enforcement;
5. protocol static-read support;
6. exact transaction simulation;
7. known Exchange custom-error decoding;
8. gas-estimation enforcement;
9. fail-closed behavior before signing;
10. the complete Exchange web qualification remains green.

The next phase is **V15.4 — real EIP-1193 signing/submission**, consuming only a successful V15.3 preflight result.
