# LIFTd PT-03 — Pay integration repository readiness

**Scope:** Supplemental pre-testnet engineering. Canonical L03.10 and deployed operational acceptance remain NOT ACCEPTED; the locked phase sequence is unchanged.

## Source-to-requirement discovery
- Quote-bound payment intent and exact canonical PaymentRegistry420 identity, token asset, route and direct settlement calldata: `rideshare/src/payment-protocol.mjs` and `rideshare/src/pay-authority.mjs`.
- Signed independent wallet consent and expiry: `rideshare/src/pay-authority.mjs`, with persistent intent/consent binding in `rideshare/src/payments.mjs`.
- Durable transactional command idempotency, original payer refunds and account-bound authorization: `rideshare/src/payments.mjs`.
- Financial receipts, exact chain/payer/asset/registry bindings, replay/equivocation, finality, reorg recovery, refund state, operation reserve ceilings, canonical funding and beneficiary payout controls: `rideshare/src/payments.mjs`.
- Existing detailed behavioral regression: `rideshare/test/payment.test.mjs` and `rideshare/test/postgres/payments.test.mjs` with genuine isolated PostgreSQL, not a fake in-memory ledger.

## Gap remediated
The Pay authority already prevented reuse of the wallet-consent signer for payment preparation, but did not reject wallet signer reuse in other independently signed financial projections. PT-03 now prevents a wallet consent signer from also acting as the event, operation, meter, rules or funding authority; an intentional wallet/beneficiary ownership pairing remains permitted. Tests prove each forbidden alias fails closed while allowed pairing works. This protects the consumer-side wallet authorization from signature authority collapse.

## Level 1 ownership and preflight
`LIFTd PT-03 Pay Level 1` owns the scoped qualification inventory: Node 22, locked application dependencies, app test suite, PostgreSQL 16 service and the retained real-database Pay lifecycle regression including refund, payout, reorg, funding and replay. The workflow requires exact candidate checkout and no unrelated Solidity, Genesis, Geth, Integrated or Docs reruns.

## Unchanged external acceptance
Official deployment/configuration authority, live 420 Pay contract receipts, funded token settlement, chain finality/reorganization, real refund/payout dispatch, independently controlled issuer key rotation and consuming service observed receipts must be executed within L03.10 and existing testnet TN-0 through TN-6. Tests using generated RSA issuer keys and local PostgreSQL cannot establish live authorization or financial settlement. Production payment/public passenger operations remain disabled.

**PT-03 repository status:** implementation candidate; qualification to be recorded only after successful exact-SHA CI and evidence review.
