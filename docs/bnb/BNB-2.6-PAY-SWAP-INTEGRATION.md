# BNB-2.6 — 420Pay and 420Swap Integration

**Canonical roadmap step:** native $420 payment support, approved conversions, payment intents, independently verified finality, canonical transaction receipts.

**Source of authority:** BNB-1.5 Payment and Settlement Architecture; BNB-1.3 reservation/booking and inventory state machines; current canonical Pay MerchantRegistry420, InvoiceRegistry420, PaymentRegistry420, PaymentRouter420 and governed approved 420Swap conversion executor. BnB is **not** a Pay financial controller, invoice issuer, 420Swap executor or custodian. PR #600; previous BNB-2.5 implementation remains retained.

## Repository-side implementation

Migration `015_pay_swap_intents.sql` creates unique reservation-to-Pay invoice binding, immutable merchant/controller, amount/currency/asset/chain, quote identity, optional Pay-only conversion route, expiry, and a unique signed finality provenance/replay ledger. No wallet keys, escrow, refund balances, or payout custody reside in BnB.

`POST /v1/bnb/internal/pay/intents` rejects unsigned/unconfigured issuers by default. A trusted **independent** BNB_PAY issuer must sign purpose `pay-intent`, exact SHA-256 request digest and domain-bound merchant/payout activation, guest/host, chain, asset, amount, quote currency and integer total. Native $420 requires explicitly signed approved Pay route and canonical priced-asset conversion; 420Swap requires a separate Pay-bound approved conversion route and bound Swap quote ID, minimum delivered, payer ceiling and independent expiry. BnB only stores upstream references; it does not request signature creation or execute any transfer.

`POST /v1/bnb/internal/pay/finality` demands a separate signed `pay-finality` assertion from that approved issuer with exact request digest, canonical payment ID, invoice ID, asset, chain, amount, merchant, payout controller, FINALIZED or SETTLED classification and receipt provenance. BnB rechecks paid reservation and inventory under the same property transaction lock. While hold and invoice remain valid, it atomically marks reservation/hold confirmed and writes the canonical payment reference and outbox event. Expired/aborted/stale/invalid pending allocations are never reanimated; independently attested late receipts enter `recovery_required` for upstream Pay refund/reconciliation. Repeat signed JTIs and payment/receipt identities cannot double-credit a reservation; conflicting replay fails closed.

`GET /v1/bnb/reservations/{id}/payment` and `/receipt` are **private, read-only, guest-scoped** projections of received Pay assertion references, payment state, invoice, chain, asset, amount, receipt hash and finality. The receipt explicitly declares `source=420Pay_authorized_assertion` and `onchain_receipt_verified_by_bnb=false`. No wallet execution, payment button or synthetic finality claim is enabled.

## Adversarial and runtime qualification

Targeted CI loads migrations 001–015 and runs retained BnB PostgreSQL/HTTP security, two-Uvicorn-process inventory contention, runtime/container and guest/host browser checks. New Pay tests check no issuer/no proof, wrong quote total, wrong chain, unapproved native route, unproven finality, signed Pay receipt acceptance in the **test fixture**, private financial data and idempotent signed finality replay. Test-generated Pay RSA keys are **synthetic only**, not externally authorized operational issuers.

## Required operational/testnet acceptance remains blocked

An actual independently governed and deployed 420Pay merchant registry, invoice service, payment router, finality verifier and live 420Swap Pay-bound route/quote executor have **not been provisioned or accepted** by the repository. Authentic proof needs verified canonical payment inclusion/finality, chain/network asset IDs and Registry-resolved contract addresses, merchant activation/payout controller, Wallet consent, approved FX and rate/oracle policy, canonical settlement splits/refund/reorg/reversal reconciliation, secret/key rotation and approved operational issuer signatures. BnB's signature verification proves origin/claims **only when trusted upstream provisioning is real**, not direct blockchain verification. Do not call the step *operationally complete*, activate wallet transfers, or assert real settled payments from fixture tests.

These live acceptance requirements are tracked under `T-BNB-PAY-2` in `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`.

**Qualification model:** Level 1 exact-SHA BnB runtime only for this ordinary step, with retained shared 420Pay interfaces/authority checks as applicable. Level 2 only if canonical milestone/cross-app integration requires; Level 3 comprehensive single merge candidate with Solidity/Genesis canonical owners only at full app audit phase closeout.
