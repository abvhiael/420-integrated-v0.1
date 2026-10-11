# DOOBR — Testnet and deferred qualification roadmap

Date: 2026-10-09. Origin: DOOBR audit PR #598, completed repository-scoped DOOBR-AUDIT-1 through DOOBR-AUDIT-8.
Frozen source of truth: `config/genesis-applications.json`, `config/genesis-consumer-services.json`, `config/420travel-genesis.json`, `docs/genesis-services/GEN-SVC-3-TRAVEL.md`.
**Deferred steps retain their exact original identifiers DOOBR-AUDIT-9 and DOOBR-AUDIT-10; they are not marked completed or renumbered.** Exact independently approved standalone product requirements were not established by the compatibility audit; this roadmap does not itself authorize an independent DOOBR application.

## Existing qualified baseline
Four structural DOOBR Travel compatibility records and seven unconditionally disabled `GenesisTravelTransactions` methods. No live DOOBR service, identity/provider verification, delivery, payment, escrow, custody, operations, or deployment authority. Release configuration defaults false.

## R02.3 external retailer and canonical prepaid authority — deferred acceptance register (2026-10-10)
These are **external/testnet/operational acceptance gates**, not unfinished local coding tasks. Original roadmap IDs R02.3, R04.4, R06.4, R06.5, R06.9, R06.10 and DOOBR-AUDIT-9/10 remain unchanged. Do not mark any completed merely because the interface or PostgreSQL test passes.

- [ ] **R06.5 / R06.9 — Retailer/regulatory source authorization:** obtain genuine independently authorized BC retail licence/municipal verification source and qualified reviewer/legal scope approval for Vancouver. Confirm provenance, effective validity, licence/site/seller-of-record mapping, revocation, renewal, municipality and three delivery carrier classes. Legal agreements and regulator contacts can proceed **before** testnet; testnet is not itself the issuer of these approvals.
- [ ] **R06.1 / R06.4 — Trusted service endpoints and credentials:** approve the precise provider endpoints, issuer identity and service account access; provision scoped credentials in a managed secret store, test TLS/service identity and credential rotation/revocation, timeouts, outages, audit trace and no client-side secrets. Do not invent regulator API URLs or store credentials in Git.
- [ ] **R04.4 / R06.3 / R06.4 — Canonical prepaid-payment acceptance:** establish independently authorized retailer merchant/payment service and approved 420Pay contract/registry deployment, exact seller/order/payment reference mapping, actual settled/prepaid finality, replay/reversal/refund handling, reconciliation and production-compatible acceptance. Do not infer cannabis payment approval from a generic Pay test or wallet balance.
- [ ] **R06.2 / R06.4 / DOOBR-AUDIT-9 — Deployed transactional integration:** deploy DOOBR backend and PostgreSQL; exercise genuine signed authentication, licence expiry/revocation during order admission, duplicate callbacks, simultaneous transactions, failed issuer/payment requests, network partitions and restored service. Capture exact deployed SHA, authenticated provider responses, redacted credentials evidence, receipt and incident traces.
- [ ] **R06.9 / R06.10 / DOOBR-AUDIT-10 — Independent acceptance:** collect authorized retailer contracts, municipal/provincial legal interpretation, payment-provider acceptance, privacy/insurance approvals, operational owner signoff, and a formal go/no-go at the exact deployment SHA. An approved testnet or live sandbox does not confer legal authorization to deliver cannabis.

**Prerequisites before promotion:** Repository-side R02.3 application admission authorization, correct atomic persistence, real concurrent PostgreSQL tests and exact-SHA Level 1 qualification must remain qualified; later R02.13 Level 2 and R05.10 Level 3 still apply. A green CI run is not proof of approved external authority. Live transactions remain disabled. These obligations are **deferred, NOT COMPLETE**, and do not block development of unrelated subsequent repository steps once the applicable R02.3 scoped local exit criteria are met.

## R03.7 — Private consoles: live/testnet/external acceptance register (2026-10-11)
The original canonical R03.7 identifier is preserved. **Only genuine external/deployment acceptance is deferred**. Repository code and local Level 1 obligations are NOT waived. All items below are **NOT COMPLETE**; no mocks, client-side assertions, unit tests or PostgreSQL sandbox qualify a live regulated service.

- [ ] **R03.7 / R06.1–R06.4 / DOOBR-AUDIT-9:** Independently approve and configure production-equivalent 420Identity/Verify/Registry issuer, grant/revocation sources and separate operator/safety/compliance roles; verify authentic issuer/audience, MFA/device posture, subject/token revocation, tenant-scoped permissions, provider outage and secret/TLS rotation with real services.
- [ ] **R03.7 / R06.4 / DOOBR-AUDIT-9:** Independently published 420Compliance policy decisions and safety/incident review evidence. Authenticate signed/versioned decisions, replay/expiry/revocation, policy effective scope, case ID, tenant, actor separation, evidence digest and purpose; deny unsupported policy exceptions, cross-tenant scope and mismatched signatures.
- [ ] **R03.7 / R06.2 / DOOBR-AUDIT-9:** Deploy authenticated *private* HTTPS API and operator/safety/compliance console ingress. Establish server-verified CSRF/origin/MFA (browser-supplied true flags do not count), session and secret management, private network perimeter, least-privilege operator admission, accessibility and live authorization. Never deploy `web/doobr-private` under public static `web/doobr`.
- [ ] **R03.7 / R06.2 / DOOBR-AUDIT-9:** Apply the controlled entire DOOBr migration chain on a production-equivalent PostgreSQL deployment using non-owner roles; validate RLS and database ownership/privileges, concurrency, forced failure rollback, audit durability/append-only enforcement, retention, backups, PITR/restore, failover and zero-secret release configuration. Isolated PostgreSQL 16 migration-0007 CI checks alone do not satisfy this.
- [ ] **R03.7 / R06.3–R06.4 / DOOBR-AUDIT-9:** Connect canonical external case execution; verify independent durable effect attestations, approved two-person workflow, retries/expiry/revocation races, no duplicate effects, reconciled audit events, cross-service outage and compensation. A simulated `verify_executed=True` is not a signed live effect.
- [ ] **R03.7 / R06.9–R06.10 / DOOBR-AUDIT-10:** Qualified legal/safety/compliance and operations signoff, production incident escalation, privacy review, break-glass process, testnet to production promotion/rollback and exact deployed-SHA security acceptance.

**Release posture:** private case commands and regulated delivery remain fail closed without externally authorized infrastructure; evidence for these checkboxes requires the actual approved live/testnet environment. Deferral does not imply production readiness. Proceeding beyond R03.7 in the repository roadmap requires an exact-SHA passing Level 1 covering the local implementation, and R03.12 Level 2 / R05.10 Level 3 remain future milestones.

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
