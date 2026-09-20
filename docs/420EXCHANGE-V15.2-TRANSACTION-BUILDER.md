# 420Exchange V15.2 — Transaction Builder + Deployed-Contract Binding

## Status

V15.2 converts reviewed Exchange operations into deterministic EVM signing/submission requests while preserving the V15.1 deployment authority boundary.

The implementation lives in:

- `exchange/web/core/abi.js`
- `exchange/web/core/execution.js`
- `exchange/web/test/execution.test.js`

## Core rule: exact raw units only

The V14 UI models use human-readable numbers for presentation. Those values are not safe transaction inputs because JavaScript floating point cannot represent arbitrary ERC-20 integer quantities exactly.

V15.2 therefore refuses to infer token units from presentation values.

Every executable request must receive exact integer raw units such as:

- `amountInRaw`
- `minFinalAmountOutRaw`
- `minAmountOutRaw`
- `sellAmountRaw`
- `minBuyAmountRaw`
- `amountRaw`

Decimal strings such as `"1.5"` are rejected. Token-decimal conversion belongs upstream in a token-aware canonical amount layer, not in the final transaction encoder.

## Swap execution

`buildSwapTransaction` binds reviewed swap intent to `ExchangeAtomicRouter420`.

Supported contract entry points:

- `swapExactInputPath`
- `swapExactInputNativePath`
- `swapExactInputPathForNative`

The builder requires:

- a resolved V15.1 runtime;
- connected account;
- exact token addresses;
- exact raw input/minimum-output values;
- bytes32 expected path hash;
- one to four exact hop records;
- bytes32 market ID;
- bytes32 route ID;
- output-token address;
- raw hop minimum;
- opaque route data.

Where the reviewed UI intent already contains canonical hexadecimal identifiers, the builder verifies they did not change after review.

The transaction is returned as an EIP-1193-compatible request envelope but is not broadcast in V15.2.

## Limit orders

420Exchange limit orders are not created by sending an on-chain transaction. Makers sign the exact EIP-712 `LimitOrder` structure consumed by `ExchangeLimitOrderSettlement420`.

`buildLimitOrderTypedData` binds:

- domain name: `420Exchange Limit Orders`
- version: `1`
- V15.1 chain ID
- deployed `ExchangeLimitOrderSettlement420` address
- maker
- sell/buy token addresses
- raw uint128 sell and minimum-buy values
- recipient
- bytes32 market ID
- nonce
- uint64 expiry
- partial-fill policy

This payload is intended for `eth_signTypedData_v4` in V15.4.

`buildLimitOrderCancelTransaction` creates the maker-only `cancelOrder(LimitOrder)` transaction. It rejects cancellation when the connected account is not the signed maker.

## Bridge boundary

`ExchangeBridgeQualification420` does **not** execute transfers. Its Solidity source explicitly states that it qualifies Exchange representations against canonical 420Bridge state.

V15.2 therefore uses it only for the canonical `isQualified(bytes32)` read.

Executable outbound transfers are directed to canonical `GatewayRouter420.initiateOutbound`, never to the Exchange qualification contract. V15.2 adds `GatewayRouter420` to the resolved Exchange testnet deployment catalogue for this purpose.

The outbound builder requires exact:

- adapter ID
- route ID
- bridge asset ID
- destination recipient bytes
- raw amount
- optional adapter-specific extra bytes
- optional native fee value

Inbound bridge acceptance remains a proof-driven 420Bridge operation and is not fabricated from the V14 Exchange deposit intent.

## ABI implementation

420Exchange remains dependency-free in the browser. `core/abi.js` supplies the narrow encoding surface required by V15.2:

- Ethereum Keccak-256
- function selectors
- uint/address/bool/bytes32 words
- dynamic bytes
- Exchange atomic-router hop arrays
- swap calldata
- limit-order cancellation calldata
- bridge qualification calldata
- GatewayRouter outbound calldata

Qualification includes the canonical empty-string Keccak-256 vector and the well-known ERC-20 `transfer(address,uint256)` selector `0xa9059cbb`.

## Authority and safety boundaries

V15.2 does not:

- select or guess a testnet deployment;
- convert floating-point UI amounts into token units;
- sign with a wallet;
- simulate transactions;
- estimate gas;
- broadcast transactions;
- wait for receipts or finality;
- treat Exchange bridge qualification as bridge execution.

These are intentionally separated into later V15 phases.

## Exit criteria

V15.2 is repository-complete when:

1. Ethereum Keccak/selectors qualify;
2. swap calldata is deterministic and runtime-bound;
3. human decimal values cannot leak into raw transaction amounts;
4. reviewed swap mutation fails closed;
5. EIP-712 limit-order payloads bind chain and settlement address;
6. cancellation is maker-only;
7. bridge qualification targets `ExchangeBridgeQualification420`;
8. outbound bridge execution targets `GatewayRouter420`;
9. unresolved V15.1 runtime cannot construct executable requests;
10. the complete Exchange web qualification suite remains green.

The next phase is **V15.3 — preflight and simulation**, using these deterministic requests as the exact inputs to `eth_call`, gas estimation, allowance/authorization checks, route freshness checks, and revert decoding before any wallet signature or broadcast.
