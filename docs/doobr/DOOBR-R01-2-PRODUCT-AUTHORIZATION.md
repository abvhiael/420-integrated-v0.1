# DOOBR R01.2 — standalone product authorization decision
Date: 2026-10-09. PR #601. Canonical step: **R01.2 Standalone product authorization decision (not a new frozen Genesis app without explicit catalogue decision)**.
Baseline: merged main `c5a4f220d1fbda01f707d359aa9bb32921a138b1`. Predecessor: qualified R01.1 inventory and DOOBR-AUDIT-1–8 compatibility-only phase in PR #598.

## Decision — standalone product development scope accepted; privileged operation NOT authorized
Product owner has explicitly requested building DOOBR as a premium, BC/Vancouver-first independently branded cannabis delivery/courier application with consumer, courier, retailer and operational web/mobile interfaces, operational backend, canonical protocol integrations, wallet consent and 420Travel/Maps coarse regional presence. **This provides product-direction authorization to design, build and test disabled-by-default standalone infrastructure.** It is NOT an independently verified on-chain governance vote, signed deployment decision, license, carrier agreement or permission to execute any regulated service or move funds.

**Catalog classification:** POST-GENESIS STANDALONE REPLACEABLE CONSUMER APPLICATION (proposed classification for DOOBR). DOOBR is **NOT** an added frozen Genesis app. Preserve `config/genesis-applications.json` unmodified and do not claim a permanent catalog service ID or on-chain contract address. `config/genesis-consumer-services.json` remains non-promoting and `travel.doobr_transactions` stays false. Any future Genesis-facing promotion requires a separate approved frozen-catalog decision and appropriate reconciliation.

## Approved for engineering and test harness development
- Architecture, docs, versioned interfaces, isolated backends/datastores, non-production mocks and simulation fixtures, mobile/web shells, observability, negative/adversarial tests, and controlled non-live staged configuration may be built under this roadmap.
- No live cannabis listings/advertising, eligible order execution, regulated courier assignment or delivery, real payment collection, custody or payouts, active production backend, or independently authorized testnet/mainnet contract deploy is granted by this decision. Any service that could dispatch is default disabled and must fail closed absent a separate approved execution authority and qualified integration.
- Existing `GenesisTravelTransactions` remains unconditionally disabled; never substitute a feature toggle as authorization. 420Travel/Maps can consume only separately approved aggregate coarse availability projections and a handoff, not user-address data, orders, precise courier coordinates, or checkout.
- Geography baseline BC and City of Vancouver. `420Compliance` separately owns versioned jurisdiction decisions, and missing/expired/revoked/compliance-unavailable responses deny eligible dispatch. BC's legal requirements and municipal licensing are subject to expert, partner and regulator review at actual operating gates.
- Canonical 420Identity/Verify/Registry/Location/Search/Pay/Wallet/Notifications/Arbitration authority remains external; DOOBR cannot mint credentials, declare regulated eligibility, seize custody or independently settle funds.
- Premium eligible **net protocol revenue** allocations use existing `DevelopmentCompensationVault420` under frozen Application Revenue Policy V1, through approved 420Pay routes and Capability Registry grants. No fee on gross cannabis sales/customer deposits/courier wages by default and no new developer wallet/vault. The policy's maximum allocation is 1,000 bps (10%) of eligible net protocol revenue, not an automatically adopted take rate. Actual fee schedule is a later controlled decision.
- Official selected brand asset remains as approved in roadmap; binary still must be materialized/versioned before website launch.

## Decisions NOT granted, and responsible sign-offs
| Decision / entitlement | Current disposition | Required source before activation |
| --- | --- | --- |
| Standalone development program | PRODUCT DIRECTION ACCEPTED, constrained | Product-owner instructions and this decision |
| Frozen Genesis app status | NOT AUTHORIZED | Separate frozen catalog governance decision |
| Stable service ID and Registry publication | NOT RESERVED OR GRANTED | Canonical service/namespace collision verification and authorized Registry publication |
| Privileged smart contracts, service capability grants, beneficiary | NOT DEPLOYMENT AUTHORIZED | Protocol governance, Capability Registry and deployment acceptance |
| Live courier/retailer/consumer operation | NOT AUTHORIZED | BC/Vancouver licensing, retailer/carrier agreements, legal + operator acceptance |
| Actual 420Pay/Swap and vault routing | NOT AUTHORIZED | Supported merchant routes, exact fees, net revenue basis, grants, external acceptance |
| 420Compliance operational decision authority | NOT INTEGRATED | Independently qualified service, signed policies and controlled versioned adapter |
| Testnet/production promotion | DEFERRED | R05.10 Level 3 and R06 testnet/mainnet gates; DOOBR-AUDIT-9/10 |

## Threat / failure boundaries
Unauthorized source-app promotion, registry ID collision, counterfeit credential/regulatory signature, self-issued compliance pass, stale municipality policy, cross-tenant/order access, direct wallet debit, duplicate fee routing, bypassing 420Pay, Travel checkout bypass, live feature-toggle mistake and absent recipient verification must all fail closed. These are R01.6 onward implementation/security requirements; this documentary decision grants none of those paths.

## R01.2 exit criteria and qualification
- [x] Separately classify standalone DOOBR as proposed non-Genesis replaceable consumer app; preserve frozen app list.
- [x] Document what product direction authorizes **now** and what independent governance/legal/financial approval remains outstanding.
- [x] Resolve 420Compliance, 420Travel/Maps, 420Pay, DevComp, Wallet, Identity and licensed retailer authority owners, without creating parallel implementations.
- [x] Preserve BC/Vancouver first and original DOOBR-AUDIT-9/10 deferred testnet/release status.
- [x] Verify Level 1 exact-SHA documentary decision invariants via app-scoped CI: [run #38024372945](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38024372945), inventory job PASS at implementation SHA `814be5fe4bdd7b56628d923da8cd5c258ffe1e5e`.

R01.2 is NOT a chain governance approval or deployment permission; those external approvals remain blocked and may not be manufactured for step completion. R01.8 Level 2 and R05.10 Level 3 deferred. Next canonical step **R01.3 Consumer/courier/retailer/operator roles, journeys, abuse cases and operational limits**.

## Qualified R01.2 closeout
**Status: COMPLETE — R01.2 documentary decision and bounded product-development authority only.** Required Level 1 fast qualification PASSED at `814be5fe4bdd7b56628d923da8cd5c258ffe1e5e`, GitHub Actions `DOOBR R01 Level 1` run #38024372945, inventory job SUCCESS. The modified `scripts/verify-doobr-r01-1.py` verifies decision text, frozen-catalog exclusion, Travel fail-closed flags, existing roadmap step and authority references; workflow also verifies exact checkout SHA, scoped Python syntax, prior DOOBR authority and GEN-SVC-3 configuration. Main/reconciliation base: `c5a4f220d1fbda01f707d359aa9bb32921a138b1`. PR #601 branch `roadmap/doobr-bc-vancouver-infrastructure` remains open. This document-only evidence closeout inherits the qualified SHA; no source, test, workflow, configuration, dependency or interface is altered by this closeout.

Level 2 deferred to R01.8; Level 3 deferred to R05.10. External governance, service ID and capability authorization, 420Compliance runtime, financial route and licensure remain NOT AUTHORIZED / not complete, as documented above. Next: **R01.3 Consumer/courier/retailer/operator roles, journeys, abuse cases and operational limits**.
