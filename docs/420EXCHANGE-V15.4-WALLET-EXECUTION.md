# 420Exchange V15.4 — Real EIP-1193 Signing & Submission

## Status

V15.4 adds the first real wallet-execution bridge for 420Exchange. It consumes deterministic V15.2 requests only after V15.3 qualification and then invokes the connected EIP-1193 wallet.

Implementation:

- `exchange/web/core/wallet-execution.js`
- transaction fingerprint evidence in `exchange/web/core/preflight.js`
- limit-order signing qualification in `exchange/web/core/preflight.js`
- `exchange/web/test/wallet-execution.test.js`

## Transaction submission

`submitPreflightedTransaction` sends the exact V15.2 request with:

`eth_sendTransaction`

Before submission it requires all of the following to remain unchanged:

- wallet session is connected;
- wallet session generation matches the reviewed/preflighted generation;
- expected chain matches the session;
- transaction chain matches the session;
- successful V15.3 preflight chain matches;
- transaction sender matches the wallet account;
- preflight account matches the wallet account;
- transaction fingerprint matches the exact request that was simulated.

Immediately before `eth_sendTransaction`, V15.4 re-reads:

- `eth_chainId`
- `eth_accounts`

Any live wallet drift forces the operation to be preflighted again.

The V15.3 gas estimate is supplied as the transaction `gas` field. V15.4 does not silently replace calldata, value, sender, target, or gas with a new locally invented value.

A submitted transaction must return a canonical 32-byte transaction hash.

## Preflight evidence binding

V15.3 now emits a Keccak-256 transaction fingerprint over canonical:

- operation kind;
- chain ID;
- sender;
- target;
- calldata;
- value.

V15.4 compares that fingerprint immediately before wallet submission. A request modified after simulation cannot be broadcast under stale preflight evidence.

## Limit-order signing

420Exchange limit-order creation uses EIP-712 rather than `eth_sendTransaction`.

V15.4 therefore adds `preflightLimitOrderSigning` before invoking:

`eth_signTypedData_v4`

The qualification step requires:

- resolved deployment;
- live RPC chain match;
- unexpired order;
- exact ERC-20 allowance from maker to deployed `ExchangeLimitOrderSettlement420`;
- positive `ExchangeAuthorization420.canPlaceLimitOrder` result.

The wallet-execution layer then rechecks:

- connected session;
- session generation;
- account;
- chain;
- qualification account and chain;
- live `eth_chainId`;
- live `eth_accounts`.

Only then is the exact V15.2 typed-data object serialized and submitted to the wallet.

The returned signature is preserved as opaque hex. V15.4 does not force 65-byte EOA signatures because `ExchangeLimitOrderSettlement420` also supports ERC-1271 contract-wallet signatures.

## Wallet failures

Common EIP-1193 provider codes are normalized:

- 4001 → `USER_REJECTED`
- 4100 → `UNAUTHORIZED`
- 4200 → `UNSUPPORTED_METHOD`
- 4900 → `DISCONNECTED`
- 4901 → `CHAIN_DISCONNECTED`

Unknown provider failures remain explicit `PROVIDER_ERROR` results rather than being misclassified as protocol errors.

## Safety boundary

V15.4 does not:

- auto-approve ERC-20 allowances;
- bypass wallet confirmation;
- retry rejected signatures automatically;
- broadcast if account/chain/session changed;
- treat a successful wallet request as confirmation or finality;
- replace V13 indexed state with wallet-returned state.

Transaction receipt tracking and canonical lifecycle reconciliation belong to V15.5.

## Exit criteria

V15.4 is repository-complete when tests prove:

1. exact preflight transaction fingerprint binding;
2. stale session generation blocks signing/submission;
3. live account drift blocks submission;
4. live chain drift blocks submission;
5. V15.3 gas estimate is propagated;
6. invalid wallet transaction hashes fail closed;
7. EIP-1193 rejection codes remain distinguishable;
8. limit-order allowance and authorization qualify before signing;
9. `eth_signTypedData_v4` receives the exact reviewed typed data;
10. ERC-1271-compatible opaque signatures are preserved.

The next phase is **V15.5 — transaction lifecycle, receipts, confirmations/finality and V13 reconciliation**.
