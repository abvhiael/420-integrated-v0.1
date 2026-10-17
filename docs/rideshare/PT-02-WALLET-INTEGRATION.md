# LIFTd PT-02 — pre-testnet Wallet integration

**Supplemental PT-02 work package.** This does not alter the canonical L03.10 official-testnet integration requirement.

## Existing source-of-truth
- `rideshare/src/payment-protocol.mjs`: validates exact PaymentRouter420 settlement calldata, invoice/payment/quote binding, ERC-20 asset, chain, smart account, controller, merchant, target, amount and explicit consent.
- `rideshare/src/pay-authority.mjs`: separate signed prepare and wallet consent authorities; nonce/replay/context verification.
- `rideshare/src/payments.mjs`: durable wallet-consent intent, event/finality/reorg/refund/payout authorization and transaction/replay protections.
- Canonical SDK: `packages/420-sdk/`, with `rideshare/test/sdk/payment-wallet.test.mjs` testing actual SDK consumer without broadcasting.

## PT-02 additional safeguards
- Ensure the prepared operation is checked against exact intent digest, expiry and explicit consent.
- Reauthorize wallet chain/controller/smart-account binding *after* the asynchronous session preparation operation. Reject wallet switching during preparation, expiry during awaiting and mutated intent. **No blockchain transaction is broadcast by this operation.**
- Preserve all existing directly applicable retained rideshare and actual Wallet SDK consumer tests; PT-02 CI explicitly compiles the SDK and runs the nested consumer tests rather than silently omitting them from `rideshare/test/*.test.mjs`.
- No arbitrary approvals or unbounded session entitlements; preparation remains bound to direct settlement calldata only.

## Remaining genuine external dependencies
Official-testnet Wallet deployment, contract/address manifests, finality, reorg, revoked/granted session behavior, real transaction funding, broadcast and consuming-service receipt remain **NOT ACCEPTED**, under original L03.10 and TN-0–TN-6. Local SDK fixture behavior does not count as deployed proof.

## Disposition
Local PT-02 engineering to be qualified by `LIFTd PT-02 Wallet Level 1` against exact final implementation SHA; no global Level 3 suites should be launched.
