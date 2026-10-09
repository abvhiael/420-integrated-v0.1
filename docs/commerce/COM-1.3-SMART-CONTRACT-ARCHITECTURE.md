# COM-1.3 — Smart contract architecture and integration-gap analysis

**Step:** COM-1.3 — Smart contract architecture. **Phase:** COM-1. **PR:** #588.  
**Status:** DESIGN IMPLEMENTED; exact-SHA automated qualification not yet confirmed.  
**Current review base:** main `ffc6a4028676907c266714b5c1ae8ba3af9a7137` (PR branch ahead 5, behind 0 at discovery).

## Architectural decision

420Commerce V1 is a branded client and orchestration layer. The existing **420 Market** contracts own listing revisions, inventory reservation, order and fulfilment/dispute state; **420Pay** owns merchant financial registration, invoices, payment lifecycle, settlement and refunds. Do **not** deploy independent Commerce merchant/market/payment contracts or change frozen Market V1 semantics for UI convenience. Changes required to bridge existing canonical authorities must be proposed and qualified in the owning component.

## Contract graph and exact interfaces inspected

- `contracts/src/market/MarketPolicyRegistry420.sol`: policy and settlement adapter definitions; governance-only `setPolicy` and `setSettlementAdapter`, read `policyActive`, `settlementAdapterActive`, `isSettlementReporter`. A reporter matches the single registered active adapter address.
- `contracts/src/market/ListingRegistry420.sol` (protocolVersion 2): `createListing`, `reviseListing`, `cancelListing`, `getListing`, `getListingRevision`, `listingAvailable`. Listing includes seller/profile, canonical item class, asset ref, metadata hash, policy, sale mechanism, settlement adapter ID, quote asset, unit price, fixed original quantity, expiry and revision. `reviseListing` requires the original quantity; invalid policy, inactive adapter, invalid item class/mechanism and expired listing are rejected.
- `contracts/src/market/InventoryReservation420.sol` (protocolVersion 1): `reserve(orderId, listingId, revision, quantity)`, `release(orderId)`, `consume(orderId)`, `available(listingId)`, `conserved(listingId)`. Order registry is governance-bound; only authorized order registry releases/consumes. Reservation must be authoritative, not a database decrement.
- `contracts/src/market/OrderRegistry420.sol` (protocolVersion 2): `createOrder(orderId,listingId,revision,quantity,paymentAsset,totalAmount)`, `recordPayment(orderId,paymentRef)`, `recordFulfillment(orderId,fulfillmentHash)`, `completeOrder(orderId)`, `cancelOrder(orderId)`, `disputeOrder(orderId,disputeHash)`, `recordRefund(orderId,refundRef)`, `orderStatus(orderId)`. Constructor binds immutable listing, policy and reservation contracts.
- `contracts/src/pay/MerchantRegistry420.sol`: `register`, `setStatus`, `schedulePayout`, `currentPayout`; Pay controls payout state, not Commerce web profile.
- `contracts/src/pay/InvoiceRegistry420.sol`: `createInvoice`, `invoiceSigningRoot`, `markPaid`, `close`, invoice read methods. Invoice creation must be by merchant. Governance is required to mark paid.
- `contracts/src/pay/PaymentRegistry420.sol`: `derivePaymentId`, `createPayment`, `recordIncluded`, `recordCertified`, `recordFinalized`, `recordSettled`, `applyRefund`, `refundAccounting`; financial transitions are explicitly governed.
- `contracts/src/pay/PaymentRouter420.sol`: `executeSwapSettlement`, `executeSwapSplitSettlement`, `executeDirectTokenSplitSettlement`, `executeNativeSplitSettlement`; canonical replay/spend/health checks.
- `contracts/src/pay/RefundManager420.sol`: governance-only refund accounting bound to `PaymentRegistry420`, verifies canonical payer, asset, maximum and authorized refund total.

Sources are pinned by the existing COM-1.1 inventory and current branch file reads, not assumed ABI deployments. ABI artifacts, approved deployed addresses and production inter-service binding **have not yet been validated**.

## Canonical order state transitions (not Commerce-owned)

`NONE -> CREATED` via buyer-created order with an atomic reservation; `CREATED -> PAID` solely by registered settlement reporter; `PAID -> FULFILLED` solely by seller; `FULFILLED -> COMPLETED` solely by buyer (consumes inventory); `CREATED -> CANCELLED` by buyer/seller (releases inventory); `PAID/FULFILLED -> DISPUTED` by buyer/seller; `PAID/FULFILLED/DISPUTED -> REFUNDED` solely by settlement reporter (releases inventory). Other transitions fail. No `PENDING`, `PARTIAL_REFUNDED`, `SHIPPED` or `REFUND_REQUESTED` Market states. Commerce can display such derived statuses with unambiguous provenance.

**Critical quote constraint:** `createOrder` requires `paymentAsset == listing.quoteAsset` and, when price is nonzero, `totalAmount == unitPrice * quantity`. An alternative input token belongs on the Pay/swap leg; it must not be passed as the Market order's quote asset. The settlement output must satisfy pinned Market economic terms.

**Finality constraint:** Market's `recordPayment` only checks authorized caller and nonzero `paymentRef`, not Pay proof content itself. Pay `PaymentRegistry420` has distinct `SUBMITTED/INCLUDED/CERTIFIED/FINALIZED/SETTLED/REFUNDED/PARTIALLY_REFUNDED/FAILED` states. Therefore an approved reporter must independently verify the Pay payment belongs to the exact order (buyer, merchant, invoice, listing terms, value, asset, chain, finality, idempotency) before calling Market. Frontend/Indexer claiming success is insufficient.

## Detected gap — Pay-to-Market approved reporter

A repository code search for direct `recordPayment(orderId...` callers found only `contracts/test/Market420.t.sol`; search for `isSettlementReporter` found only Market's policy and order registries. No explicitly named `MarketPay` or `SettlementReporter420` integration source surfaced. These results **do not prove exhaustive absence**, but source inspection does **not establish a production-qualified Pay→Market reporter bridge**.

**Required next work (COM-1.5 / owning upstream integration):** define an explicit versioned adapter with tightly bound Market order and Pay payment references; authorized call path; independent canonical finality / refund evidence verification; replay and order-payment uniqueness; exact buyer/merchant/asset/value bindings; lifecycle race/reorg behaviour; negative tests for wrong caller, wrong order, wrong amount, wrong merchant, unfinalized payment, duplicate proof and partial refund. Resolve whether this belongs in Market settlement adapter or Pay event settlement bridge under existing frozen authority. Do not give a generic web API reporter privileges or assume a payment receipt alone authorizes a Market transition.

## Other design gaps and security controls

1. **Merchant role mismatch:** Market `createListing` uses `msg.sender` as seller; Pay merchant registration uses canonical controller. A storefront operator, session capability or merchant delegate is not automatically authorized to sign these calls. Determine legitimate signer/account abstraction pathway in COM-1.5; never proxy using a shared admin key.
2. **Order creation and reservation:** `createOrder` uses `msg.sender` for buyer. Client must avoid a stale revision or incompatible asset and surface failed reservation without charging. Checkout correlation IDs must be domain-separated and unique.
3. **Reservation lifetime:** inspect expiration and cancellation semantics in full before committing to abandoned-cart TTL; Market V1 has explicit cancellation but should not be assumed to automatically expire unpaid orders. Map stuck reservations and recovery policy.
4. **Partial refunds:** Pay supports partial refund accounting, whereas Market V1 exposes only terminal `REFUNDED`. Partial Pay refund is not equivalent to final Market release; require explicit design and avoid falsely marking Market refunded.
5. **Fulfilment and disputes:** only commitments/hashes on chain; private shipping/payment details stay off-chain; Arbitration does not inherit custody authority.
6. **Swap quote:** prove quote freshness, route/slippage and minimum net settlement; no guaranteed swap output without liquidity and policy approval.
7. **Deployment:** consult frozen Registry IDs, chain/address manifests and published ABI version before any binding. Production addresses are not assumed by this document.

## Required COM-1.3 tests and acceptance

- [x] Inspect Market policy/listing/inventory/order source interfaces.
- [x] Inspect Pay merchant/invoice/payment/router/refund interfaces.
- [x] Preserve the exact frozen Market V1 state machine and ownership boundaries.
- [x] Identify strict Market quote asset/amount and paid-finality prerequisites.
- [x] Identify reporter and partial-refund integration risks; no silent unsupported compatibility claims.
- [x] Define upstream interface proposal and security/adversarial scenarios without implementing a second protocol.
- [ ] Exact-SHA automated Level 1 source/interface verifier + applicable CI conclusion: evidence pending.
- [ ] Level 2 integration milestone: deferred until meaningful adapter implementation.
- [ ] Level 3 comprehensive phase qualification: COM-1.8 only.

No contract, governance, address, workflow or frontend source changes are authorized by this architecture-only step. The **next canonical step is COM-1.4 — Data storage and event-indexing architecture**. COM-8 testnet and COM-9 mainnet remain gated by live evidence and authorization.
