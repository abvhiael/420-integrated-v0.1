# 420 Launchpad consumer API integration (REC-2)

The non-custodial Launchpad service resolves its contract graph from the canonical ProtocolRegistry and separately verifies RPC chain identity. Write endpoints return **unsigned, exact target/calldata/value review objects** only. Only a connected Wallet signs and submits. The service cannot issue merchant invoices, deliver Pay refunds, bypass CapabilityRegistry or exercise governance authority.

## Read endpoints

- GET /v1/launchpad/runtime — verified Registry-derived contract graph and chain.
- GET /v1/launchpad/campaigns?search=&mode=&state=&limit=&cursor= — provenance-stamped, filtered, deterministically paginated indexer catalogue; cursors are block-hash scoped.
- GET /v1/launchpad/campaigns/:saleId — catalogue campaign detail (discovery; not signing authority).
- GET /v1/launchpad/campaigns/:saleId/position/:account — live sale/Identity/credential/capability/capacity read, recorded payment references, delivered refund status, claim state, attestation and verified Arbitration case origin/status.
- GET /v1/launchpad/campaigns/:saleId/checkout?account=&amount=&nonce= — canonical intent invoice ID, registered status, invoice existence/terms, Pay invoice-to-payment pointer, settlement, recorded status, refundable principal delivery and next recovery action.
- GET /v1/launchpad/campaigns/:saleId/conversion-quote?account=&amount=&nonce=&marketId=&inputAsset=&maxInput=&minOutput= — codehash-verified 420Pay canonical conversion quote, exact settlement validation, quoted fee, slippage, current token allowance/balance and unsigned Pay Router data.
- GET /v1/launchpad/transactions/:txHash?account= — chain-confirmed status and recovery: UNKNOWN, PENDING, CONFIRMED, FINALIZED, REVERTED or REORGED. Verified case-opening receipt logs expose the associated case ID.

A legacy participant read endpoint remains for Audit-5 compatibility. All writes must be re-reviewed after a chain/account change.

## Unsigned transaction review

POST /v1/launchpad/prepare/:kind with campaign and Wallet context. Kinds include bind-identity, register-intent, approve-conversion, pay-conversion, contribute, claim, refund (prepare/record), open-dispute, link-dispute, publish-outcome, reconcile-refund and recover-unallocated. Conversion approvals are exact input-token amounts for the validated canonical market pool; they are not blanket spend permissions. Dispute preparation requires an active canonical policy and nonzero evidence/remedy commitments.

POST /v1/launchpad/creator-requests produces governance **drafts** only. Creator lifecycle actions do not grant direct mutation authority.

## Safety and accounting boundaries

Do not infer that a paid 420Pay checkout is a recorded contribution: checkout and Launchpad recording are non-atomic. Do not treat an authorized Pay refund as delivered, a partial refund as a complete batch, or an arbitration ruling as refund/cancellation authority. Historical gross funding remains gross even after delivered-refund reconciliation.

The service stores no keys; it never generates real transactions without an explicit client Wallet submission. Production needs the real RPC, chain, service API and canonical projection; local application qualification alone is not live deployment evidence.
