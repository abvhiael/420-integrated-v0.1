# COM-1.5 — Canonical ecosystem integration design

**Implementation reconciliation:** the original architecture below records the
COM-1 design baseline. COM-2 implemented/qualified the reporter source (see
`COM-2-QUALIFICATION-EVIDENCE.md`); COM-3 implements the noncustodial service/API/SDK
handoff (see `COM-3-SERVICE-AND-API.md`). Reporter live deployment and compatible
live Pay/Swap quote wiring remain later qualification gates; historical pending
source statements below do not override these subsequent implementation records.

**Canonical step:** COM-1.5 — 420Pay/Wallet/Registry/Identity/Swap integration design. **PR:** #588. **Status:** architecture delivered; automated exact-SHA qualification pending. **Current main reconciliation baseline:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.

## Contract of integration

420Commerce is a branded noncanonical application, not a new Genesis protocol/service. Keep Market V1 authoritative for listings, revisions, reservations and orders; Pay for merchant financial identities, invoices, payment settlement and refunds; Wallet for transaction signatures; Registry for canonical component identity; Swap for approved settlement conversion; Identity/Names/Verify for optional attestations. UI/API, event indexers and merchant admins are not settlement reporters.

| Boundary | Source-backed interface and owner | Commerce adapter contract | Failure and security policy |
| --- | --- | --- | --- |
| Discovery | `ServiceIds420.sol`, ProtocolRegistry, verified ecosystem manifest | Resolve exact chain ID, service ID, deployed code, version, interface, manifest; cache only with bound expiry | Missing/incompatible manifest or code: fail closed on writes; URL alone is not proof |
| Wallet | `wallet/web/core/services.js` `resolveServices` requires `420-ecosystem-manifest-v1` and `verified: true` | Display connected address/chain, explicit user-approved wallet execution; narrowly scoped capabilities | Wrong chain/address, unsigned request, revoked capability: stop; never store secret keys; no invented Commerce Wallet catalogue ID |
| Merchant binding | `MerchantRegistry420.register`, `merchants`, `schedulePayout`, `currentPayout` | Map store to merchantId and canonical `controller`; resolve activated payout at the correct time | Web profile/identity credential cannot transfer payout control; schedule requires controller signature; activated version may differ from latest scheduled version |
| Market listing and policy | `ListingRegistry420`, `MarketPolicyRegistry420` | Seller-signed publish/revise; exact revision, policy, adapter and quote asset checks before checkout | Stale listing, inactive policy or adapter, unsupported item class/asset: reject; do not mutate canonical stock off chain |
| Market order | `OrderRegistry420.createOrder` and `InventoryReservation420` | Buyer-signed order; pin listing revision, quote asset, quantity, total; reserve atomically | Wrong `msg.sender`, price mismatch or insufficient inventory: abort before payment; cart is not a reservation |
| Pay invoice | `InvoiceRegistry420.createInvoice`, `invoiceSigningRoot`, `merchantOf`, `amountOf`, `expiresAtOf` | Merchant-authorized invoice with order-correlated and domain-separated reference | Invoice cannot be created by generic commerce backend; expired/mismatched amount or merchant: no payment |
| Pay payment/finality | `PaymentRegistry420.createPayment`, `derivePaymentId`, `recordFinalized`, `recordSettled` | Bind payer, merchant, invoice, amount, asset, network, nonce and quote; reconcile finalized/settled state | SUBMITTED/INCLUDED/CERTIFIED are not paid; receipt alone not proof of Market order payment |
| Swap settlement | `contracts/src/pay/adapters/CanonicalSettlementAdapter420.sol` | Use Pay router and canonical quote engine; display quote expiry/slippage/asset and exact net settlement; respect 42-second quote lifetime | Adapter `quote()` **reverts**; never call it as quote engine. Only bound `paymentRouter` may `execute`; consumed quotes not reusable; market health, minimum delivery, canonical asset required |
| Payment splits | Pay `PaymentRouter420`, `SettlementRouter420` | Present payer-approved recipients/fee splits from canonical settlement plan | No unreviewed payout substitution or fee change; no Commerce custody |
| Refunds | `PaymentRegistry420.applyRefund`, `RefundManager420.recordRefund` | Require governance-authorized canonical refund accounting and payer/asset matching | Partial Pay refund is not terminal Market `REFUNDED`; release reservation only when full Market refund transition is justified |
| Optional identity/name/provenance | 420Identity, 420Names, 420Verify | Show explicit source and verification class, bind confirmed on-chain addresses | No credential, ENS-like name or badge authorizes merchant mutation/fund diversion |
| Optional projections | 420Indexer/Search/Analytics/Notifications | Rebuildable read API, finalized-state hints, tenant-filtered analytics and opt-in messages | Missing feed: stale/degraded; no phantom settlement, inventory or merchant verification |

## Critical unresolved canonical Market ↔ Pay adapter

The code-backed Market `OrderRegistry420.recordPayment(orderId,paymentRef)` checks nonzero ref and that `msg.sender` is the active, governed `MarketPolicyRegistry420.isSettlementReporter(adapterId, caller)`; it **does not validate Pay evidence itself**. `recordRefund` has analogous authorization and releases reserved stock. Pay's `CanonicalSettlementAdapter420` is a *Swap execution adapter* with a bound PaymentRouter; **it is not, by itself, proof of a live Market order settlement reporter**. A generic Commerce server MUST NOT be registered as reporter.

**Owning-protocol implementation requirement for COM-2 / COM-3:** design a governed, reviewed reporter bridge that atomically or verifiably binds `chainId, orderId, listingRevision, seller/Pay merchantId, buyer/payer, invoiceId, paymentId, quoteAsset, amount, policyId, settlementAdapterId, fulfillment/refund ref`; enforce canonical Pay finality threshold, replay/one-order-one-payment accounting and Pay refund eligibility. Explicitly define cancellation/timeout, partial-refund semantics, crash recovery and reorg discipline. Subject it to targeted Foundry negative tests (forged reporter, duplicate ref, different buyer/order/merchant/asset/amount, expired invoice, unfinalized or failed payment, swap replay, wrong settlement asset, stale listing/revision, partial refund terminalization, race with cancellation). This is an **open blocking dependency for real checkout**, not a claim of completed executable wiring.

## End-to-end customer path (planned, not deployed)

1. Fetch Registry-qualified Market and Pay identities, wallet chain/capabilities, validated merchant controller/payout, and active listing policy.
2. Browse verified listing projections; re-read canonical listing, revision, quantity and asset before transaction.
3. Buyer explicitly signs Market `createOrder` and receives authoritative order ID + reservation; no Pay charge on reservation failure.
4. Merchant-authorized Pay invoice binds same amount, asset, merchant, order and expiry; buyer approves funds/Swap quote where applicable.
5. Pay router performs permitted settlement; canonical Pay payment enters `FINALIZED`/`SETTLED` per its own policy. Approval/broadcast is not financial finality.
6. Only the verified, governed Market settlement reporter records payment for matching order. Commerce displays pending/reconciling until canonical Market `PAID` and corresponding Pay proof are validated.
7. Seller signs fulfillment commitment; buyer signs completion; disputes and refunds follow bounded Market/Pay paths. Indexer projects events but never settles.

## Test matrix / exit criteria for design

- Identity: manifest absent/unverified, wrong chain, unregistered service, incompatible version, claimed DNS or unknown contract → reject writes.
- Wallet: no signer, wrong account, revoked delegate, delegated seller pretending to be financial controller → reject.
- Market: revision race, bad policy/adapter, oversell, cancelled order, quote asset mismatch → reject.
- Pay: amount/merchant mismatch, invoice expiry, duplicate payment nonce, unfunded execution, failed/unfinalized payment → not PAID.
- Swap: quote API on adapter reverts, quote aged >42 seconds, consumed quote, unhealthy market, minimum settlement below invoice, wrong payer/recipient, insufficient output → reject or atomically revert.
- Refund: noncanonical refund, wrong payer/asset, partial Pay refund, replay or duplicate reporter → no terminal Market refund.
- Projections: stale indexer or reorg, search outage, notification replay → no fabricated canonical result.

**Ownership and qualification:** design-only COM-1.5 changes require source/ABI-level consistency verification and directly applicable documentation CI, not a fresh full Foundry or Genesis inventory. Actual bridge implementation and integration test milestone occur in the owning protocol COM-2 / COM-3; run Level 2 there. Level 3 COM-1.8 once on exact merge candidate; COM-8/COM-9 live handoffs remain gated.

**Next canonical step: COM-1.6 — Marketplace and storefront UX architecture.**
