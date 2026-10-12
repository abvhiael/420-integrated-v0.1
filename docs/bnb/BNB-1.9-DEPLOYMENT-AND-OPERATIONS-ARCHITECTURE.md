# BNB-1.9 — Deployment and Operations Architecture

**Status:** Architecture / operations readiness specification only. This step does not deploy a BnB API, database, website, funds adapter or testnet service. **PR:** #600. **Inputs:** BNB-1.1–BNB-1.8; GEN-SVC-0/3; `docs/apps/pay/deployment-operations.md`. **Next canonical step:** BNB-1.10 — Phase Qualification and Reconciliation.

## Deployment topology and separation of authority

Proposed deployment has a stateless guest/host web client; edge routing/WAF/TLS; versioned BnB API with independent identity/property permissions; PostgreSQL primary and tested replica/backups; migration job; transactional booking/hold workers; durable inbox/outbox and DLQ; media gateway and per-object ACL; internal financial-proof verifier; reconciliation queue; and derived Search/Travel/Notifications/Analytics projections. Public and private interfaces use separate routing and permissions. Non-production staging and production-equivalent testnet use isolated credentials, databases, domains, rate limits, data and service identities. No preview environment may access production guest addresses, authentication tokens or payout controls.

**420Pay is the canonical financial authority** for invoices, settlement, payment finality, refunds, merchant/payout-controller binding and payouts. BnB owns accommodation booking and inventory only, never independently authorizing custody, settlement, refunds or payouts. **420Swap** is the approved asset-conversion authority only through canonical Pay-bound conversion and permitted PaymentRouter execution. **ProtocolRegistry** resolves deployed Pay components under approved governance; neither application DNS nor a local JSON address implies production chain identity. The Pay deployment document retains Registry-resolved residents with unset addresses until independently deployed and verified. No BnB Genesis application promotion is authorized. Travel `GenesisTravelTransactions` remains fail-closed.

## Configuration, secrets, release gates and rollback

Mandatory per-environment configuration: API/base URL and allowed origins, database DSN via secret manager, KMS/encryption key references, queue/outbox settings, authorized Identity/Registry service endpoints and chain/network identifiers, Pay/Swap/Arbitration manifest sources and version pins, media ACL/CDN and geoprivacy mode, feature flags, telemetry redaction policy, alert contact, rollback artifact digest and build provenance SHA. Secrets and tenant PII cannot appear in committed config, logs, client bundles or CI artifacts. Require signed artifact provenance, dependency scanning, migration review, immutable image digest and least-privilege deployment credentials.

**Deployment order:** (1) verify exact audited code SHA and approved environment; (2) validate disabled feature flags and frozen Genesis/Travel constraints; (3) verify migration checksums, backup/PITR ability and restore evidence; (4) deploy stateless components behind disabled transactional routes; (5) migrate and validate database constraints; (6) run health/ready, auth and private-data smoke tests with synthetic fixture identities; (7) verify Registry/Identity/Pay network, version, code hash and separately governed authorization; (8) exercise non-funds booking concurrency / replay and recovery drills in test environment; (9) authorize staged feature rollout only after documented go/no-go decision; (10) monitor service and economic reconciliation before extending exposure.

**Rollback:** stop creation of new holds/financial intents first; preserve already-finalized canonical Pay truth and recovery queue; rollback application binaries only if schema remains compatible and no data loss; use reversible/expand-contract migrations, verified backup restore when unavoidable, audit operator decision and reconcile inflight payments. Never replay a refund, charge or host payout as a rollback shortcut. Emergency kill switch disables BnB transaction entry points independently of external canonical Pay ledger state. A deployment failure must fail closed, not silently expose booking routes.

## Health, operational observability and alerting

Separate `/health/live` from `/health/ready` (proposed, not currently registered). Readiness validates database and critical dependency availability without requiring public exposure of internal state. Structured logs contain correlation/request ID, immutable application SHA, tenant scope pseudonym, operation, result and authoritative event ID; redact PII, private addresses, access credentials, financial references and signatures. Trace queue lag, outbox age, failed publish, hold contention, booking conflict, occupancy invariant violation, Pay finality lag, refund/payout reconciliation backlog, reorg/reversal, search freshness, API 4xx/5xx, latency, database saturation, backup age and security rate-limit attacks. Page on overbooking, unbacked economic state, unauthorized beneficiary changes, privacy leaks, stalled reconciliation and missing backup verification.

Define SLO/SLA and on-call ownership before a real launch; **proposed readiness targets** must be established from load tests, not invented as achieved uptime. Ensure immutable evidence and human authorization for incident severity, containment, customer communications, regulator obligations and recovery. No synthetic test receipt is presented as a production payment.

## Business continuity and recovery

Record approved RPO/RTO by booking/identity/financial data class; automate encrypted backups and PITR, regularly restore to isolated environments, check referential and booking-capacity invariants, and test multi-instance failover. Worker crash during payment requires canonical Pay verification and inbox deduplication, not recharging. Retry limits, exponential backoff, poison-message DLQ and runbook-guided replay must preserve idempotency and chain finality. Hold expiration and cancellation must be transactional; late Pay-finalized payment after hold expiry enters authorized refund/recovery without violating inventory. Partial refunds must not be terminalized as full refunds. Reorged payment and stale Search/Travel results cannot mark a booking confirmed. Access to emergency tooling is separately authenticated, least-privilege, audited and time-bounded.

## Security, legal and deployment acceptance

Production-equivalent acceptance demands testnet evidence for real Registry, Identity, Pay/Swap, governance-approved refund/payout execution, approved Arbitration remedies, property/host eligibility and lawful booking policy per region; privacy, PII, protection of private guest identity, private addresses, booking information, access credentials and financial references; browser/mobile accessibility; signed webhooks; rate limits; content rights; incident response and auditability. Ensure Terms/consumer cancellation disclosures, lodging licensing/tax and accessibility compliance are reviewed per jurisdiction. Deployment of a static site alone is not qualification of backend execution.

## BNB-1.9 acceptance matrix

| ID | Required implementation and operational evidence |
| --- | --- |
| BNB-O01 | Reproducible environment topology, build provenance and immutable artifact SHA |
| BNB-O02 | Versioned config, signed manifests, secrets/KMS and no client secrets or PII |
| BNB-O03 | TLS, edge WAF, least-privilege services and public/private routing |
| BNB-O04 | Migrations, PostgreSQL transactional constraints and tested backup/PITR restore |
| BNB-O05 | Multi-instance booking concurrency, queue/outbox/inbox and idempotent recovery |
| BNB-O06 | Correct chain, Registry, Identity and canonical Pay/Swap/Arbitration readiness |
| BNB-O07 | BnB booking authority isolated from custody, refund, settlement and payout |
| BNB-O08 | Health/readiness, telemetry, alerting, SLO and incident response ownership |
| BNB-O09 | Phased rollout, safe rollback, kill switch, version and change approval |
| BNB-O10 | Browser/API acceptance, privacy/PII, geolocation, accessibility and abuse tests |
| BNB-O11 | Canonical Pay finality, partial refund, payout and reorg recovery smoke |
| BNB-O12 | Disabled Genesis Travel booking/escrow, frozen addresses and testnet gating |

## Verification scope and blockers

**Level 1 for BNB-1.9:** source-backed deployment-architecture consistency checks against BNB-1.5–1.8, GEN-SVC-0/3 feature flags and canonical Pay deployment policy, exact PR-head check. This is **not** a completed deployment or operational smoke test. No new runtime or configuration changes are authorized by this architecture document.

**Level 2:** Retained M1/M2 milestones are already qualified for architecture; the deployment milestone's actual end-to-end integration cannot be claimed until executable services and a production-equivalent environment exist. **Level 3 at BNB-1.10** must establish a single reconciled merge candidate and apply the canonical full Solidity inventory once, separate Genesis/address checks, app/client/security/config integration and documentation reconciliation without redundant Foundry inventory.

**Open blockers:** No BnB transactional server or durable booking database; no signed deployable client; no production-equivalent BnB testnet; no live Pay/Swap financial adapter, registry-qualified environment, smoke or real browser acceptance. Operational go-live remains blocked even if the architecture Level 1 passes.

**Next canonical roadmap step: BNB-1.10 — Phase Qualification and Reconciliation.**
