# 420Launchpad audit remediation roadmap

Stable numbering. Do not renumber completed or blocked steps.

## LAUNCHPAD-AUDIT-1 — canonical-definition reconciliation
Status: **IMPLEMENTED; CI QUALIFICATION PENDING**

- distinguish `420/service/launchpad/v1` protocol from `420/service/launchpad-crowdfunding/v1` consumer service;
- preserve V1 non-custodial architecture;
- record exact baseline repository/branch/PR history;
- add requirement matrix and readiness states;
- add machine-readable dependency reconciliation;
- add dedicated exact-head audit CI and adversarial contract tests.

Exit: dedicated audit verifier + focused tests pass on exact audit head.

## LAUNCHPAD-AUDIT-2 — V1 contract hardening
Status: **PENDING**

- expand authorization, zero/boundary, state-transition, duplicate-operation and terminal-state tests;
- explicitly decide/document payment/delivery/refund commitment uniqueness semantics;
- explicitly decide/document allocation rounding-dust semantics;
- decide whether project `active` is immutable metadata or a real governed lifecycle control;
- add fuzz/property coverage for caps and allocation conservation;
- run forbidden-primitive/static analysis.

Exit: all V1 invariants have direct negative + boundary coverage and unresolved semantics are frozen.

## LAUNCHPAD-AUDIT-3 — crowdfunding dependency integration
Status: **PENDING**

- define exact contract/API boundary to canonical 420Pay settlement records;
- bind contribution evidence to canonical paid/settled state rather than arbitrary nonzero hashes;
- define refund settlement linkage;
- define Identity/eligibility proof linkage;
- define Arbitration dispute/cancellation/refund escalation;
- publish creator/project delivery-history inputs to 420Reputation without creating universal reputation authority;
- publish lifecycle events to 420Notifications;
- add replay/idempotency rules for all cross-service references;
- keep securities/equity disabled.

Exit: repository integration tests prove reward/donation/community-project/preorder flows against canonical dependency interfaces.

## LAUNCHPAD-AUDIT-4 — deterministic deployment and Registry publication
Status: **PENDING**

- freeze deployment order and constructor arguments;
- generate ABI/runtime identities from exact build;
- create deterministic deployment/materialization package;
- publish `420/service/launchpad/v1` through canonical Registry discovery;
- reconcile router address with canonical address authority;
- add smoke and code-hash verification;
- retain exact-head evidence.

Exit: reproducible deployment package and exact runtime identity evidence exist.

## LAUNCHPAD-AUDIT-5 — user-facing application and service layer
Status: **PENDING**

- implement actual Launchpad project/campaign discovery and detail UI;
- Wallet/network validation and canonical address discovery;
- contribution transaction workflow using integrated settlement;
- claim/refund status workflow;
- loading/empty/error/transaction/recovery states;
- responsive/accessibility baseline;
- application API/indexer only where canonical chain reads are insufficient;
- creator campaign-management workflow with bounded authority;
- tests for frontend-contract-service integration.

Exit: production build succeeds from clean checkout and primary user/creator workflows are covered.

## LAUNCHPAD-AUDIT-6 — production-equivalent testnet qualification
Status: **BLOCKED — LIVE TESTNET REQUIRED**

- deploy exact qualified artifacts;
- verify Registry resolution, bytecode and constructor/state bindings;
- execute funded contribution/success/claim and failure/refund paths;
- execute cancellation/dispute paths;
- verify event indexing/reorg recovery;
- verify notifications/reputation side effects;
- retain run IDs, tx hashes, code hashes and exact repository SHA.

Exit: all production-equivalent testnet evidence is durable and exact-head bound.

## LAUNCHPAD-AUDIT-7 — Genesis closeout
Status: **BLOCKED — depends on 1–6**

- reconcile docs/config/roadmaps;
- verify no stale Launchpad addresses or service IDs;
- record known limitations and operating procedures;
- final exact-head build/test/static/application qualification;
- mark Genesis readiness only if all required dependencies are themselves Genesis-ready.

## LAUNCHPAD-AUDIT-8 — production operations/security closeout
Status: **BLOCKED — production stage**

- production deployment/rollback/runbook;
- monitoring/alerting;
- credentials/secrets procedures;
- independent external security review or documented release exception;
- post-deployment verification and incident response.

