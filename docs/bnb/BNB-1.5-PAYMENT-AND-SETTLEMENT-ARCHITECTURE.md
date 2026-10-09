# BNB-1.5 — Payment and Settlement Architecture

**Classification:** Normative architecture only; no new transaction execution or custody. **PR:** #600. **Milestone:** M2, covering BNB-1.4 and BNB-1.5. **Release gate:** Genesis BnB transactions, host escrow and cancellation settlement remain disabled under GEN-SVC-3. **Next:** BNB-1.6 — Backend, API and Persistence Architecture.

## 1. Canonical owners and verified repository sources

| Capability | Authoritative component | Evidence and boundary |
| --- | --- | --- |
| Accommodation booking inventory, price/house-rule snapshot and cancellation eligibility | Future independently authorized BnB application | BNB-1.3 and BNB-1.4; no executable BnB booking backend is qualified |
| Merchant / payout controller | Pay MerchantRegistry420 | `docs/commerce/COM-1.5-ECOSYSTEM-ADAPTER-DESIGN.md`: controller and activated payout are independently verified, not host-editable |
| Invoice and invoice expiry | Pay InvoiceRegistry420 | Merchant-authorized invoice; `invoiceSigningRoot`, `merchantOf`, `amountOf`, `expiresAtOf`; bind booking/quote/asset and domain |
| Payment creation, finality, settlement and refunds | Pay PaymentRegistry420 and governed payment/settlement routers | `createPayment`, `derivePaymentId`, `recordFinalized`, `recordSettled`, `applyRefund`; no BnB local proof of funds |
| Refund audit | RefundManager420 | `recordRefund` must correlate with canonical Pay refund reference and payer/asset |
| Approved asset conversion | Pay-bound CanonicalSettlementAdapter420 / canonical Swap executor | `quote()` on settlement adapter reverts; canonical quote engine is separate, approved `paymentRouter` alone may execute |
| Dispute remedy | Independent Arbitration authority plus governed Pay settlement | Moderators do not move funds or sign financial finality |
| User transaction consent | Wallet with verified network / delegated capability | Wallet submission is not payment finality or legal property authority |
| Service addresses | ProtocolRegistry and Pay deployment package | `docs/apps/pay/deployment-operations.md`: residents Registry-resolved and deployment addresses null until deployed/verified; no fabricated BnB/Pay address |

BNB SHALL NOT be a settlement reporter, merchant financial controller, escrow custodian or unilateral refund authority merely because it manages a property booking. Any cross-service bridge must be separately governed, implemented, reviewed and exact-SHA qualified. Commerce's Market/Pay reporter bridge is **not** proof that BnB has a live reporter.

## 2. Monetary representations and quote

An authoritative quote contains `quote_id`, immutable `reservation_intent_id`, `listing_revision`, `guest_principal`, `host_pay_merchant_id`, `property_id`, `unit_id`, property timezone and half-open UTC stay interval, supported chain/asset, `night_count`, unit rates, service charges, taxes, discounts, deposit classification, platform/host fee schedule, payer max total, canonical recipient split policy, policy hash, exchange route binding if applicable, version, issuance/expiry, signature/authority proof and one-time idempotency key.

All monetary values use exact checked integers in canonical smallest asset units. Optional fiat displays use ISO currency minor units, explicitly stated exchange-rate provider/expiry/rounding and a full disclosure of conversion risk. No floating-point amount is accepted as final. `base + fees + taxes + permitted deposit - discounts = total` with checked arithmetic and defined rounding per component, and `total <= payer_max`. Taxes, service fee, network gas and any security deposit must be clearly distinguished and must not be silently deducted from refundable accommodation principal. The exact displayed total and policy snapshot must be the values the guest consents to.

**Native $420:** only an approved chain-native Pay route is eligible; being denominated in $420 does not entitle arbitrary token transfer, gas subsidy, or exchange-rate conversion. **Swap:** only qualifying routes through canonical Pay/Swap execution with approved quote engine, expiry/slippage/minimum delivered/chain/payer/payee binding; the referenced Commerce contract notes a 42-second quote lifetime for its route, which is a **route-specific constraint**, not an assumed universal BnB parameter. Unsupported fiat payment methods or custody must remain unavailable.

## 3. Lifecycle and trust boundary

1. Authoritative BnB inventory lock, listing policy and quote are validated transactionally before an invoice request.
2. Merchant/controller and activated payout destination are verified against canonical Pay identity; host profile is not payment-controller proof.
3. Pay invoice binds exact guest, host merchant, booking/quote ID, amount, currency/asset, nonce, chain and expiry. Wallet presents explicit consent for the exact intended execution.
4. Pay router accepts permitted funded payment, returns a canonical payment reference. UI state remains `PAYMENT_PENDING` while submitted/included/certified/unfinalized.
5. Independently governed proof verifier reconciles canonical Pay `FINALIZED` or `SETTLED` per applicable route, invoice and actual beneficiaries. Only then may BnB reservation move to `CONFIRMED`. The adapter cannot infer finality from a generic callback, transaction hash, notification, receipt screenshot or explorer projection.
6. Crash between Pay finality and BnB booking reconciliation must use immutable event cursor, deduplicated outbox/inbox and idempotent recovery. After hold expiry or capacity reassignment, a late payment triggers explicit refund/recovery rather than resurrecting booking inventory.
7. Reorg, asset mismatch, insufficient realized settlement, wrong chain, revoked controller, invalid invoice, stale quote, duplicate payment or refund are fail-closed. Record operational remediation and notify without inventing confirmation.

## 4. Economic conservation, fee and payout obligations

Define per booking and per canonical settlement asset:
- `finalized_captured`: authoritative received funds from Pay, excluding pending or failed attempts.
- `finalized_refunds` and `refund_reserved`: already paid and still in-flight authorized returns.
- `finalized_payouts` and `payout_reserved`: finalized and approved pending host/platform distributions.
- `liability_remaining = finalized_captured - finalized_refunds - refund_reserved - finalized_payouts - payout_reserved`.

Conservation must enforce nonnegative amounts, exact authorized recipient allocations and no unbacked payout/refund. **Invariant:** `finalized_refunds + refund_reserved + finalized_payouts + payout_reserved <= finalized_captured` for the same asset and economic account, unless independently approved external collateral/liability mechanisms explicitly extend it. One finalized Pay event contributes once, regardless of repeated webhooks, retries or reorg reconciliation. Provider fees, host earnings, tax remittances and platform fees are distinguished in an immutable split snapshot and approved policy revision. Payout beneficiary changes after booking require independent controller verification and an authorized beneficiary transition; no profile update silently redirects captured funds.

**Host payout:** policy-approved eligibility after fulfillment, cooling-off, dispute window or other adopted criteria; initiate through governed Pay authority; display `PAYOUT_PENDING` until canonical finality. Failed/partial payout remains reconciled and retriable with exactly-once economic credit; no self-awarded earnings.

## 5. Cancellation, refund, damage, insurance and dispute policy

Guest/host cancellation binds the original immutable cancellation policy version, effective timestamp, booking status and evidence. BnB can calculate **eligibility proposal**, but cannot unilaterally execute transfer. Pay/Arbitration owns actual remedy authorization and money movement. Account for nonrefundable fees, tax reversal and partial stays per separately adopted policy; never presume full or zero refund without that policy. A partial Pay refund does not mean reservation fully refunded. Store `REFUND_ELIGIBLE`, `REFUND_REQUESTED`, `REFUND_PENDING_FINALITY`, `PARTIALLY_REFUNDED`, `REFUNDED`, `REFUND_FAILED_RECOVERABLE` as derived financial read states with canonical proofs. Refund destination is bound to the original payer/approved refund beneficiary, not host-selected.

Damage deposits, host escrow, insurance, chargebacks and off-chain fiat reversals remain **unapproved and disabled** unless a separate service/asset-specific custody design, consumer policy, governance authority, claims evidence process and security qualification are adopted. Do not emulate escrow in a BnB database or assume standard Pay custody supports it. Arbitration decisions must be independently verified, finality-aware, replay-safe, appeal-compatible, and executable only through authorized settlement primitives.

## 6. Replay, concurrency, operator and crisis behavior

Key domain binding: `(chain_id, Pay registry identity/version, quote_id, booking_id, invoice_id, payment_id, asset, payer, merchant_controller, payout_version, amount, nonce)`. External events include canonical provenance, block/tx/log IDs, confirmation policy, replay domain and finality version. Require signature/issuer authorization and a single-use idempotency or consumed-event ledger with durable transactional uniqueness. Different economic payload under same idempotency key is rejected, not retried. Split execution and refund authorization require policy-specific least privilege; BnB admins, support, moderators, Search/Analytics/Notifications and Travel cannot settle, refund or override Pay.

Outage: keep reservation pending/unknown and inventory conservatively locked during policy-bounded investigation; no unlimited lock. Recovery requires reconciling independent Pay ledger with authoritative availability atomically. Fraud: verify ownership, merchant activation, price manipulation, double booking and beneficiary substitution. Network/chain reorganization: finalized policy must be rechecked, and reversal enters recovery rather than negative liabilities. Audit traces must avoid payment secrets, private addresses, sensitive guest details or unverifiable public 'paid' claims.

## 7. Required integration tests and release gates

| ID | Requirement | Later implementation test obligation |
| --- | --- | --- |
| BNB-F01 | Quote exactness, taxes/fees, currency and integer bounds | Overflow, decimal rounding, mismatched component sum, stale policy, expired quote |
| BNB-F02 | Approved $420/Swap route, wallet consent and expiry | Wrong chain/asset, invalid quote, slippage, replay, unavailable route |
| BNB-F03 | Merchant payout-controller and canonical invoice authority | Spoofed host, inactive payout, invoice payer/amount/ref mismatch |
| BNB-F04 | Pay finality, escrow prohibition and confirmation | Unfinalized, forged, reorged or late payment never confirms |
| BNB-F05 | Split accounting and total conservation | Overrefund, double payout, fee substitution, wrong beneficiary |
| BNB-F06 | Cancellation policy and refund settlement | Partial refund, cancelled reservation, payout collision, retry idempotency |
| BNB-F07 | Governance and Arbitration remedies | Forged ruling, stale order, moderator bypass, unauthorized refund |
| BNB-F08 | Crash/outage/replay recovery and provenance | Webhook replay, worker restart, stale indexer, chain reorg |
| BNB-F09 | No Genesis or invented deployment privilege | Booking/escrow/settlement remain disabled and addresses remain registry-resolved |
| BNB-F10 | Guest/host financial UI accuracy and privacy | Pending != finalized; only authorized principal sees complete financial details |

**BNB-1.5 Level 1:** audit architecture requirements against actual retained source declarations and Genesis fail-closed constraints. **M2 Level 2:** replay the BNB-1.1–1.5 source consistency and payment authority matrix against one exact PR branch SHA. These checks do not qualify live settlement code, deployed addresses, Pay integration or legally approved escrow. **Level 3:** BNB-1.10 only.

## 8. Future work and blockers

BNB-1.6 must define authenticated API and durable settlement reconciliation contracts; BNB-1.7 guest/host transaction UX; BNB-1.8 threat/regulatory security controls; BNB-1.9 production-equivalent deployment; BNB-1.10 phase-wide qualification. Runtime enablement is blocked on approved Pay/Swap deployment, governed adapter/proof authority, booking custody decision if applicable, host licensing/regulatory review and live testnet acceptance.

**Next canonical roadmap step:** BNB-1.6 — Backend, API and Persistence Architecture.
