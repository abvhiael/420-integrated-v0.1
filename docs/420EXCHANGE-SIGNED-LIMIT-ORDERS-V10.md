# 420Exchange V10 — Signed Limit Orders + Atomic Settlement

V10 adds relayer-fillable EIP-712 limit orders without weakening the execution guarantees established in V6–V9.

## Order model

A signed order commits to:

- maker
- sell token
- buy token
- total sell amount
- minimum total net buy amount
- recipient
- primary market
- nonce
- expiry
- partial-fill policy

The order intentionally does not commit to one route. A filler may choose any valid 1–4 hop route that begins with the signed primary market and terminates in the signed buy token. The atomic router independently validates every hop, route adapter, market, oracle condition, capability, slippage bound, emergency state, and retained Exchange fee.

## Signature model

EOA makers use EIP-712 signatures with strict 65-byte ECDSA validation, low-s enforcement, and v restricted to 27/28. Contract-account makers are supported through ERC-1271 `isValidSignature`.

The EIP-712 domain binds the signature to the chain ID and the deployed `ExchangeLimitOrderSettlement420` contract.

## Replay and cancellation

V10 uses four layers of replay protection:

1. exact order hash fill accounting,
2. one signed order hash may bind to a maker nonce,
3. individual nonces may be cancelled,
4. makers may advance a minimum valid nonce floor.

An exact order may also be cancelled directly by its maker.

## Partial fills

If `allowPartial` is false, the order must be filled for the entire remaining sell amount.

If partial fills are enabled, each fill receives a proportional minimum buy requirement derived from the signed full-order ratio. The proportional minimum rounds upward so repeated partial fills cannot erode the maker's signed limit price through integer truncation.

## Custody boundary

Relayers never receive maker funds.

For a successful fill:

1. `ExchangeLimitOrderSettlement420` validates emergency state, order shape, expiry, cancellation state, nonce state, signature, and `canPlaceLimitOrder` capability.
2. The settlement contract pulls the exact approved sell amount from the maker into transient custody.
3. It grants the atomic router an exact temporary allowance.
4. `ExchangeAtomicRouter420.swapExactInputPathDelegated` pulls only from the governance-approved settlement executor, not from the maker.
5. The router executes under the maker as the authorization principal, so every hop still checks the maker's swap capability.
6. The router performs oracle checks and V9 retained-fee settlement, then sends net output directly to the signed recipient.
7. The temporary router allowance is zeroed and the settlement contract verifies that no sell-token residue remains.

Any failure reverts the entire transaction.

## Delegated-executor governance

The atomic router contains a narrow delegated-executor allowlist. Only the Governance Timelock exposed by the existing Exchange fee policy may add or remove an executor.

After deploying `ExchangeLimitOrderSettlement420`, governance must call:

`ExchangeAtomicRouter420.setDelegatedExecutor(orderSettlement, true)`

A delegated executor cannot nominate maker funds as its transfer source. It must first hold the exact input amount itself and approve the router, preserving the separation between signed authorization and custody.

## V10 invariants

- A relayer cannot change maker, sell token, buy token, recipient, price floor, nonce, expiry, or partial-fill policy.
- A route must start with the signed primary market and end in the signed buy token.
- Every fill preserves the signed net limit price.
- An order cannot fill beyond its signed sell amount.
- A non-partial order cannot be partially filled.
- A nonce cannot bind to two different order hashes.
- Cancelled orders/nonces and nonce-floor-invalidated orders fail closed.
- Expired or malformed signatures fail closed.
- Contract-account signatures require ERC-1271 approval.
- Maker limit-order capability is checked before custody moves.
- Maker swap capability remains checked per hop by the atomic router.
- Relayers never custody maker funds.
- The settlement contract must finish with its original sell-token balance.
- The router's delegated input must be an exact transfer amount.
- V7 oracle checks, V8 wrapped/native protections, and V9 fee settlement remain in force.

## Scope

V10 signed orders use ERC-20 inputs, including canonical wrapped `$420`. Native `$420` orders are represented by wrapped `$420`; direct native-value signed orders are intentionally excluded from this slice to keep relayer value semantics unambiguous.

The next Exchange roadmap slice is V11 canonical bridge adapters and external-asset qualification.
