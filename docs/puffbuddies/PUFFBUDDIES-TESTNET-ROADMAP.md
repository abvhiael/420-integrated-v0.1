# PuffBuddies testnet / live-release work roadmap

## Status
Repository implementation and repository-side audit work through **PB-16 — Security/privacy audit** is complete.

This document is the canonical home for PuffBuddies work that cannot be honestly completed without deployed environments, live credentials, production-equivalent dependencies, operator access, device/store signing, or other external release infrastructure.

It does not mark any live phase complete merely because repository scaffolding exists.

## Entry gate
The following repository phases are prerequisites and are complete:
- PB-0 — canonical architecture/foundation
- PB-1 through PB-14 — implementation and integration
- PB-15 — accumulated app-specific qualification / Level-2 milestone E
- PB-16 — security/privacy audit

The live roadmap begins at **PB-17 — Closed testnet**.

---

## PB-17 — Closed testnet

### Purpose
Deploy PuffBuddies into the approved production-equivalent closed testnet environment and prove that the repository-qualified application behaves correctly with real deployed dependencies, secrets/configuration, persistence, operators and clients.

### Required environment prerequisites
- operational 420Integrated testnet and canonical RPC/service endpoints;
- approved testnet 420Wallet/session path;
- approved testnet 420Identity / adult-eligibility path;
- approved testnet 420Names where used for presentation;
- approved testnet 420Messenger;
- approved testnet 420Notifications;
- approved testnet 420Pay;
- approved Registry/AppStore/service-discovery state;
- required Indexer/Search/Explorer/Analytics/Verify endpoints where applicable;
- deployable backend/API runtime;
- production-shaped database/persistence topology;
- object/media storage;
- test secrets/credentials and operator access;
- test web/mobile distribution path.

### Deferred repository findings / live obligations moved here
1. Bind the PB-14 API transport to a real deployed application gateway.
2. Configure canonical HTTPS host/proxy/TLS behavior and verify forwarded-header policy at ingress.
3. Configure production-shaped session provider and prove expiry/revocation under real dependency failure.
4. Deploy replay/idempotency storage and verify restart/failover semantics.
5. Deploy rate-limit/anti-automation controls and validate realistic burst/Sybil/resource-abuse behavior.
6. Validate production-equivalent secrets storage, rotation and least-privilege service credentials.
7. Validate real database transactions, isolation, concurrency, replicas and failure recovery.
8. Rehearse schema migration/backfill against production-shaped persistence.
9. Validate backup creation, restore and deletion reprocessing/anti-resurrection.
10. Validate data-at-rest encryption and key-lifecycle assumptions for private stores and media.
11. Validate real profile-media upload/content-type/object-storage/CDN behavior and privacy.
12. Verify no precise location or protected metadata leaks through deployed APIs, CDN/object keys, logs or telemetry.
13. Validate live 420Identity minimum-disclosure eligibility verification, expiry/revocation, issuer/policy/version handling and outage behavior.
14. Validate live Wallet/session sign-in and account/session revocation.
15. Validate live 420Messenger authorization, post-block/unmatch revocation and delayed/offline delivery behavior.
16. Validate live 420Notifications minimization, lock-screen/push payload privacy, stale-event suppression and device deregistration.
17. Validate live 420Pay settlement→premium entitlement mapping while proving payment cannot create consent/private access.
18. Validate Registry/AppStore/Verify/service-version compatibility against deployed service identities.
19. Validate Search/Indexer/Explorer/Analytics boundaries do not enumerate private PuffBuddies membership or relationship/safety state.
20. Validate production-shaped observability without protected relationship/profile/location/message/report leakage.
21. Validate moderator/operator IAM, role separation, protected audit trails and access revocation.
22. Exercise report/moderation/appeal workflows with real persistence and least-privilege operator access.
23. Exercise block, suspension, ban, eligibility hold and deletion propagation across all live dependencies.
24. Run deletion drills across primary storage, media, caches, indexes, notifications, analytics/telemetry and backups subject to canonical exceptions.
25. Validate incident response, dependency outage, circuit-breaker/fail-closed behavior, rollback and restore runbooks.
26. Validate device-bound mobile session handling on signed test builds where hardware/platform access exists.
27. Validate universal/app links and push registration on real test devices.
28. Validate web runtime configuration against the deployed closed-testnet API.
29. Perform closed-user abuse/scraping/triangulation/automation exercises.
30. Record exact deployment/config/version evidence and unresolved external limitations.

### Required qualification
- app-scoped deployed smoke/integration suite;
- live dependency compatibility checks;
- migration rehearsal;
- fault/recovery/deletion/restore drills;
- security/privacy review against deployed telemetry and configuration;
- closed-testnet operator/client evidence;
- exact deployment/config/version binding.

### Exit criteria
PB-17 may be COMPLETE only when the production-equivalent closed testnet exists and every applicable required deployed gate above passes with durable evidence.

---

## PB-18 — Public testnet

### Purpose
Promote the qualified closed-testnet candidate into a public testnet and validate broader user/load/abuse/dependency behavior without claiming mainnet readiness.

### Required work
- public testnet deployment from the qualified PB-17 candidate;
- public onboarding/eligibility/session flows;
- wider web/mobile distribution;
- public dependency availability and version compatibility;
- load/capacity/rate-limit tuning;
- anti-scraping/Sybil/automation validation;
- moderation/support operational readiness;
- telemetry/privacy review under real public usage;
- incident/rollback/on-call rehearsal;
- deletion and account-recovery behavior at public-testnet scale;
- public-testnet security/adversarial findings remediation;
- exact release/deployment evidence.

### Exit criteria
PB-18 may be COMPLETE only after the public testnet runs successfully with no unresolved blocker for mainnet preparation.

---

## PB-19 — Mainnet

### Purpose
Prepare and deploy the production/mainnet PuffBuddies release candidate using only canonically approved production dependencies, configuration, credentials and release controls.

### Required work
- reconcile the final release candidate with then-current main;
- complete the applicable comprehensive Level-3 closeout against one exact merge/release candidate SHA;
- canonical Solidity full inventory once under Solidity Contracts ownership where applicable;
- Genesis/address-authority qualification under Genesis ownership without duplicating the Solidity inventory;
- 420 Integrated/global and Docs/global reconciliation where applicable;
- retained PuffBuddies app/client/service qualification;
- production configuration and secrets review;
- production Wallet/Identity/Messenger/Notifications/Pay/Registry dependency validation;
- production database/media/backup/restore/deletion configuration;
- operator/moderator IAM and audit configuration;
- production monitoring/alerting/incident/rollback controls;
- production web/mobile signing/distribution evidence;
- final security/privacy and unresolved-risk acceptance;
- deployment approval and exact mainnet deployment evidence.

### Exit criteria
PB-19 may be COMPLETE only after the production deployment is proven healthy and all required release blockers are closed or explicitly rejected as unacceptable.

---

## PB-20 — Public launch

### Purpose
Open the qualified production deployment to intended public use and validate post-launch safety, privacy, reliability and operations.

### Required work
- controlled public enablement;
- post-launch smoke and dependency-health checks;
- signup/eligibility/profile/discovery/matching/messaging/safety/payment/deletion validation;
- monitoring and alert verification;
- moderation/support staffing and incident-response activation;
- rollback readiness;
- privacy-safe telemetry review;
- early abuse/Sybil/scraping monitoring;
- deletion/retention operational verification;
- post-launch issue triage and durable launch evidence.

### Exit criteria
PB-20 is COMPLETE only when public launch has occurred successfully and immediate post-launch validation has no unresolved critical blocker.

---

## External blockers and truthfulness rule
Until the required environment exists, PB-17 through PB-20 remain **NOT COMPLETE**.

Repository mocks, documentation, local tests, CI, placeholders, sample configuration, or synthetic dependency adapters are not substitutes for deployed testnet/mainnet evidence.

## Relationship to repository roadmap
The repository implementation/audit roadmap stops at PB-16. All unfinished live environment, deployment, operational, testnet, mainnet and public-launch work is owned by this document beginning with PB-17.
