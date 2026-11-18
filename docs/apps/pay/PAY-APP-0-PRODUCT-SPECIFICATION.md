# PAY-APP-0 — Owner-approved Genesis 420Pay product specification

Decision date: 2026-11-17. Product scope approved and active in the frozen V3 catalogue. Application delivery and live deployment qualification are tracked separately. This decision supplements PAY-AUDIT-1–8; it neither certifies implementation nor authorizes live deployment.

## Catalogue and configuration authority

420 Pay is approved as GENESIS_PROTOCOL_AND_USER_APP, using existing ServiceIds420.PAY (420/service/pay/v1) and existing Registry-resolved contracts. The proposed public origin is https://pay.420integrated.org; DNS, TLS, verified launch manifest and mobile association files remain deployment gates. The complete candidate catalogue is config/candidates/genesis-applications-pay-v10.json. It adds exactly one entry to the V2-committed v9 catalogue and preserves all existing entries, Arcade deferral, rules and amendments.

The active `config/genesis-applications.json` is committed by FROZEN_V3 (`0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d`). The commitment supersedes the retained V2 record and binds the approved V10 catalogue bytes. Pay uses Registry resolution and the existing contract inventory. Native artifact qualification is tracked in PAY-APP-0.4.

## Approved expressions

- Responsive consumer and merchant web application at the proposed origin; one account selector with Personal, Business and POS modes.
- Installable PWA; Android and iOS clients sharing domain rules and typed SDK, using native scanning, sharing and verified Wallet handoff. No second key store or signer.
- Physical retail POS: quick amount entry, cart/tax/tip display, cashier permissions, QR checkout and customer display; browser/tablet/phone first. Optional peripheral integrations are not mandatory to launch.
- Hosted checkout, payment links/QR, developer SDK, authenticated merchant API and signed replay-safe webhooks. Embedded checkout is presentation only. No arbitrary transfer via API credentials.

## Consumer journeys

Connect verified 420Wallet and select account/network; show available assets as Wallet-derived balances, not a hosted Pay balance. Send/request via address, verified .420 resolution, link or QR. Distinguish direct receiving-address QR from a specific invoice; validate chain, merchant, invoice, amount, expiry and origin before review. Require Wallet simulation and explicit approval of recipient, asset, amount, minimum output, fees, tip, quote expiry and network; refresh expired quotes and require renewed approval when terms change. Display submitted/included/certified/finalized/settled/failed/refund states accurately; pending is never settled. History and downloadable receipts derive from canonical evidence; reorgs invalidate stale projections. Optional contacts and notification delivery are private.

## Merchant journeys

Register with canonical merchant controller; display UNVERIFIED, REGISTERED, CREDENTIALED and REGULATED only from qualified evidence, not self-assertion. Create invoice drafts, validate accepted assets, currency, expiry, mode, tax commitment, tip, refund and split policy, then obtain merchant-authorized online creation. Share canonical invoice via link/QR. Dashboard includes payments, invoices, receipts, refunds, accounting, location/cashier views, authorized roles, developer integrations and settings. Merchant profile, line items, customer references and location metadata remain private off-chain; no metadata can redirect payout. Scoped access and revocation use existing authority; deny cross-merchant access. POS offline supports drafts/cart only; no fabricated acceptance. Refund UI must distinguish authorization, actual asset delivery and reconciliation; no unilateral chargeback. Split recipient limits, 10,000 bps and rounding follow contracts.

## Frozen economic rules

contracts/config/pay/420pay-parameters.json and Decisions 1–4 remain normative: CAD/USD/420 invoice denomination; 42-second quote lifetime; FINALIZED default, supported FAST/HIGH_VALUE per policy; SINGLE_USE default, partial opt-in only; atomic swap or revert, fail closed on price/health and no silent settlement substitution; disclosed tip/refund policy; full/partial refunds; no public payer identity required. Accounting exports preserve exact 15 frozen fields and order. CSV/JSON and printable reports derive from authorized projections, never an independent ledger. Fiat denomination is not fiat custody, bank transfer or guaranteed redemption.

## Architecture and trust

Registry verifies service/deployment identities, version, chain and code hash. Wallet/Smart Accounts own signing and capability authorization. Names resolves presentation identities; Identity supplies optional credentials. Pay contracts own canonical invoice/payment/settlement/refund authorization; Swap/Oracle supply eligible conversion/health; Indexer reconstructs events with checkpoints, idempotence and reorg handling. Explorer, Search, Analytics, Notifications and Mail are replaceable read/delivery surfaces with privacy and consent controls. Merchant metadata, access-scoped reports and webhook delivery records are application state only. API tokens cannot sign or authorize spending. No parallel payment protocol or financial ledger. Use existing repository client conventions; TypeScript shared logic is the approved design direction, exact web/mobile framework selection belongs to architecture reconciliation.

## Acceptance boundaries

Local EVM, deterministic fixtures, ABI-backed clients and negative tests must qualify actual behavior; fixture mode clearly marked and cannot enable production. Tests cover wrong chain/runtime/origin, forged invoice/merchant, stale quote, replay, unauthorized spending/refund/split, malicious tokens, atomic rollback, tenant isolation, webhook signatures/replays, reorg and restart, privacy, accessibility and device handoff. Build web/PWA/Android/iOS and exercise actual devices where available before local closeout; record any genuinely external device/store blockers separately. App-store approval, DNS/provider credentials, applicable legal/merchant eligibility and live testnet deployment remain distinct external gates. No claim of payment licensing, fiat rails or production readiness.

| Acceptance boundary | Current evidence | Remaining owner |
| --- | --- | --- |
| Catalogue class, canonical service ID and public documentation | Frozen V3 catalogue and reconciled inventories | PAY-APP-0 |
| Canonical contract and Registry deployment identity | Repository deployment package and local rehearsal | PAY-AUDIT-7 live binding |
| Consumer, merchant, POS and client acceptance | Approved scope and acceptance criteria | PAY-APP-1 through PAY-APP-18 |
| Public origin and environment availability | Proposed origin and deployment gates | PAY-APP-17 and PAY-APP-18 |

## Status

The product decision is approved and the V10 catalogue is integrated under V3. See [the canonical roadmap](PAY-APP-ROADMAP.md) for qualification status.
