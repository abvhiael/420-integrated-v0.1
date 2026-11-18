# 420Pay application roadmap — PAY-APP

Owner-approved product scope, 2026-11-17. Normative product decision: [PAY-APP-0](PAY-APP-0-PRODUCT-SPECIFICATION.md). Existing PAY-AUDIT-1–8 numbering and historical results remain unchanged. All steps are unqualified unless exact-head evidence is retained. PAY-APP-0 product decision and staged candidate are implemented; configuration promotion and qualification remain open. PAY-APP-1–18 are planned, not implemented. Steps 0–17 are repository-side, including configuration transition; only real external/device/provider blockers may be deferred. Step 18 requires the live public testnet. Independent security review remains PAY-AUDIT-8.

## PAY-APP-0 — Genesis catalogue amendment and product specification

**Status:** PARTIAL — product approval recorded; catalogue promotion and qualification pending. **Testnet required:** No.

Exit criteria: Promote approved v10 candidate only with explicit configuration version transition, rematerialization of all affected residents, catalogue/docs/discovery/verifier reconciliation and exact-head evidence. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-1 — Shared application architecture and payment SDK

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Inventory reusable clients, ABI bindings, domain types, validation, private persistence, projection/HTTP boundaries; pin architecture and test contracts. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-2 — Registry, Wallet, Names and Identity integration

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Verified chain/service/code/origin resolution, account selection, exact Wallet simulation/confirmation and scoped revocation; reject wrong network and spoofed identities. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-3 — Consumer web dashboard and account management

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Responsive personal account UI, derived balances, history, receipts, settings, accessibility and explicit fixture mode. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-4 — Send, request, QR codes and payment links

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Validate recipients, invoice and address QR distinction, links, expiry, sharing, retries and duplicate protection. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-5 — Hosted checkout, quotes and payment confirmation

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Canonical prices, 42-second quote and fees, asset/settlement choices, explicit Wallet handoff, atomic failure and status. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-6 — Merchant registration and business dashboard

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Controller-bound onboarding, credential status, tenant isolation, authorized roles/locations/cashiers and reports. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-7 — Invoice builder and merchant payment management

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Online merchant acceptance, offline drafts, modes/tips/expiry, sharing, outstanding balances and canonical lifecycle. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-8 — Split settlement, refunds and tips

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Canonical split limits/rounding, actual refund asset delivery vs evidence, authorization and replay protections. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-9 — Accounting, reports and reconciliation

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Exact frozen 15-field export, private metadata/reporting, reconciliation, CSV/JSON and printable report. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-10 — Merchant POS and customer-facing display

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Quick pay, retail cart/tax/tip, cashier session, QR and verified settlement; offline draft only. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-11 — Developer APIs, webhooks and checkout integrations

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Versioned SDK/API, scoped credentials, hosted/embedded checkout, authenticated idempotent delivery and compensating reorg events; no signing. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-12 — Progressive Web App

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Installability, offline safe cache, camera/share support, authenticated navigation and stale-state protections. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-13 — Android application

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Shared SDK with native QR, verified Wallet links, secure sessions, notification privacy, build and device tests. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-14 — iOS application

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Same domain parity, verified universal links, native QR/share, session security, build and device tests. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-15 — Ecosystem integration and downstream consumers

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Reconcile Wallet/Swap/Registry/Indexer/Oracle/Commerce/Market and other authorized consumers; verify canonical state and recovery; no duplicate ledger. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-16 — Security, privacy, accessibility and adversarial qualification

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Static/adversarial and local-EVM tests; injection, authorization, replay, cross-tenant, stale quote, reorg, restart and device/accessible journeys. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-17 — Documentation, deployment preparation and local closeout

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Operator/user/developer manuals; deterministic packages, exact-SHA CI, release gates, security review preparation, merge only qualified candidate. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-18 — Public testnet deployment and live acceptance

**Status:** PLANNED. **Testnet required:** Yes.

Exit criteria: Bind deployed Pay/Wallet/Registry/Indexer; real receipts, runtime and recovery evidence, live web/mobile/POS flows; coordinate PAY-AUDIT-7 and -8 without duplicating authority. Retain reproducible scoped qualification at exact implementation SHA.
