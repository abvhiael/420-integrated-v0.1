# DOOBR — Testnet and deferred qualification roadmap

Date: 2026-10-09. Origin: DOOBR audit PR #598, completed repository-scoped DOOBR-AUDIT-1 through DOOBR-AUDIT-8.
Frozen source of truth: `config/genesis-applications.json`, `config/genesis-consumer-services.json`, `config/420travel-genesis.json`, `docs/genesis-services/GEN-SVC-3-TRAVEL.md`.
**Deferred steps retain their exact original identifiers DOOBR-AUDIT-9 and DOOBR-AUDIT-10; they are not marked completed or renumbered.** Exact independently approved standalone product requirements were not established by the compatibility audit; this roadmap does not itself authorize an independent DOOBR application.

## Existing qualified baseline
Four structural DOOBR Travel compatibility records and seven unconditionally disabled `GenesisTravelTransactions` methods. No live DOOBR service, identity/provider verification, delivery, payment, escrow, custody, operations, or deployment authority. Release configuration defaults false.

## DOOBR-AUDIT-9 — deferred to testnet / approved external-service acceptance
- [ ] First confirm the original canonical step description and independently approved scope. Do not equate the conditional AUDIT-5 design with governance approval.
- [ ] If DOOBR standalone execution is approved, deploy separately authorized testnet identity/age/credential issuer, provider license and jurisdiction verification, delivery provider gateway, service area restrictions, Pay-bound financial routes (Swap only where approved), refund/dispute authority, and Wallet consent.
- [ ] Exercise real network authentication, expired/revoked tokens, role changes, cross-tenant access, idempotency/replay, duplicated/out-of-order provider callbacks, timeout/retry, private delivery address confidentiality, unauthorized jurisdictions, provider outage, payment conservation, cancellation/partial refunds and failover.
- [ ] Gather immutable deployment SHA, manifests, environment/secret inventories (redacted), operational audit traces, receipt reconciliation, independent regulator/provider acceptance evidence and negative tests. No testnet mock may substitute for untested live provider boundaries.
- [ ] Otherwise (if no independent approval), record testnet gate as **not authorized**, leave transaction methods disabled and do not fabricate a passing integration result.

## DOOBR-AUDIT-10 — deferred to testnet / operational release acceptance
- [ ] Confirm original canonical step description and prerequisite completion of AUDIT-9, including legal, operational, user-facing and production safety approvals.
- [ ] Against the exact approved deployment SHA, validate deployment promotion/rollback, migrations and recovery where present, monitoring/SLOs/on-call, incident escalation, secret rotation, privacy/retention/deletion, user/courier/dispatcher acceptance, end-to-end failure journeys, money/settlement reconciliation, regulatory and provider eligibility, and all relevant browser/accessibility tests.
- [ ] Reconcile Release/QA evidence with main, owner approvals and canonical protocol authority. Record explicit PASS/FAIL and residual conditions; neither a green static verifier nor successful Genesis compatibility tests qualify a live delivery business.
- [ ] Preserve disabled Genesis Travel DOOBR gateway unless independent protocol/governance acceptance explicitly permits a separate adapter. Never activate via a feature-flag toggle alone.

## Execution and CI ownership
The testnet roadmap is a deferral record only. Stage-dependent Level 2 retained app integration should run when actual dependencies exist; final Level 3 app-phase reconciliation only once at the exact merge candidate. At Level 3 Solidity owns full Foundry inventory and Genesis owns address-authority checks without repeating the full Foundry suite. Unrelated Cloudflare Worker failures are not substitutes for DOOBR verification.

## Status
DOOBR-AUDIT-9: TESTNET/EXTERNAL AUTHORIZATION GATED — NOT COMPLETE.
DOOBR-AUDIT-10: TESTNET/RELEASE GATED — NOT COMPLETE.
