# 420BnB — External Pay/Wallet and reorg acceptance docket

**Status: NOT ACCEPTED / NOT LIVE.** Created to operationalize existing `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1`, `T-BNB-PAY-2`, and `T-BNB-SETTLEMENT-3` gates. This is a planning/evidence register, not an acceptance certificate, wallet signature, official testnet deployment, or release authorization.

## Preserved repository qualification

BNB-3.6 / M3-A synthetic integration evidence: `docs/bnb/BNB-3.6-M3A-LEVEL2-QUALIFICATION.md`. Implementation SHA `b01b47a7e72e6af78d34fd965e29a81f95673ad8`, runtime run `38330538809`: 227 passing test executions and retained BNB 1.1–1.9 workflows PASS. These attest only to app-level contracts; no proof of independent Wallet user authorization or movement of real/official-testnet funds.

## Four independent acceptance tracks

### A. Verified Wallet consent — NOT WITNESSED

Owner: independently controlled 420Wallet signer / authorized human payer and 420Pay issuer, *not BnB*.

Required witness: approved Wallet version and chain/asset/contract manifest, authenticated consenting payer, wallet connection, exact invoice and reservation/quote, fee and maximum-spend display, signed user authorization (or valid wallet transaction signature), expiry, nonce and typed-data domain, refusal, replay, wrong chain/recipient, revoked session and wallet disconnect; independent 420Pay verification and receipt. Record redacted Wallet intent ID, Pay invoice ID, quote/property/reservation ID, payer address proof (privacy-safe), chain ID, approved asset, on-chain transaction hash where applicable, timestamp, wallet/Pay image SHA, signer registry version and reviewer signature. Never save seed phrase, private keys or unredacted identity files in this repository.

### B. Actual fund movement and allocation — NOT WITNESSED

Owner: independently authorized 420Pay settlement operator, merchant/payout controller, finance/security approvers.

Required witness: official testnet registry/frozen-address binding for PaymentRouter, Invoice/PaymentRegistry, SettlementRouter, MerchantRegistry, RefundManager and approved 420Swap route if used; merchant activation and Pay-authorized immutable quote. Fund an approved test account using controlled testnet tokens and a bounded authorized test invoice. Show Pay-owned reserve/capture/finality against real chain receipts; reconcile exact integer smallest-unit amounts and host/platform/developer/retained split; partial refunds to original payer; nonduplicated payee payout following stay/dispute conditions. Include competing-transaction, duplicate/cross-invoice, under-delivery, out-of-order events, insufficient funds and provider outage traces. Log real transaction/block hash, confirmations/finality policy, receipt, relevant Pay and Wallet release SHAs, beneficiary approval, ledger snapshot, conservation and independent signoffs. Never use user production funds for qualification.

### C. Finalized reorg / finality-revocation resolution — NOT WITNESSED

Owner: 420Pay finality/recovery operator and independent chain/testnet witness.

Required witness: controlled official testnet/finality-fault scenario with previously accepted Pay event then canonical reversal/finality revocation. Pay must resolve merchant liability, refund/payout reservation, beneficiary conservation and finality ledger under provider reorg; reconcile BnB's confirmed stay and occupied hold without silently reissuing inventory or paying twice. Current BnB app deliberately returns `FINALIZED_PAYMENT_REQUIRES_PAY_RECOVERY` for signed failure against finalized reservations: this protects against callback-controlled reversal but **does not itself complete the Pay-side reorg recovery**. Verify current outcome, reconciliation IDs, retry/compensation, dispute/refund, concurrent retry and exact terminal state. Redact customer information and keep signed immutable evidence of operator and security review.

### D. Independent operator / legal / security acceptance — NOT SIGNED

Owner: independent approved payment operator, 420Wallet/420Pay authority owner, security reviewer and legal/regulatory authority where required. Required: approved trust roots and rotation/revocation, deployment manifest and chain/frozen address provenance, least privilege, segregated duties, audited settlement accounting, consumer taxes and refund policies, jurisdiction and merchant eligibility, production-equivalent failover and recovery, key compromise, incident escalation, logs/privacy/redaction, signed approval including named role, timestamp and bounded release/image SHAs. BnB owner and ChatGPT do not self-issue third-party approvals.

## Acceptance matrix

| Gate | App evidence | Independent evidence | State |
|---|---|---|---|
| T-BNB-QUOTE-1 | Signed quote/invoice validation tested | authoritative tax/policy, merchant, asset and consent acceptance | BLOCKED |
| T-BNB-BOOKING-1 | Reservation/finality/late-hold guards tested | official chain payment, real booking, reversal and recovery witnesses | BLOCKED |
| T-BNB-PAY-2 | Pay/Wallet attestations and replay boundaries tested | approved Pay/Wallet deployments, real signed consent, settlement/finality and issuer acceptance | BLOCKED |
| T-BNB-SETTLEMENT-3 | Split, refund, payout accounting tests passed | actual authorized Pay operations, original-payer delivery, reorg and independent financial/security review | BLOCKED |

## Release rule

Before approving any gate, append exact source SHA, independently verified official-testnet deployment and frozen manifest IDs, signed issuer/key lineage, redacted invoice/transaction/recovery references and *actual* approver identity, role, timestamp and scope. Independently validate the artifacts, complete both positive and negative scenarios, then record separate accept/reject decisions for every gate. Missing artifacts or a failed test => BLOCKED. A CI PASS or synthetic signed JWT never substitutes.

At current evidence point **no external witness or approval was supplied**. Maintain `travel.bnb_booking=false`; no live payment, refund, payout, public booking activation, or claim of production acceptance. Keep PR #620 draft and unmerged. Level 3 repository phase closeout is separately scheduled at BNB-3.12.
