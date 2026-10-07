# DoobTube — repository audit and remediation record

Application: **DoobTube** (the application originally requested as `420Video`)
Original audit base: `main` @ `43a3690422e934dcd1fe9da595df4a9dfed37a75`
Audit branch: `audit/doobtube-baseline-20261006`
Current remediation state: **DOOBTUBE-0 through DOOBTUBE-10 complete**
Date: 2026-10-07

## Executive determination

At the original audited `main` SHA, no canonical DoobTube/420Video application existed. The repository did contain the separate mature **420Media** service at `420/service/media/v1`.

The remediation branch now contains a repository-qualified DoobTube V1 application/client through DOOBTUBE-10:

- canonical architecture and product scope;
- dependency/trust and lifecycle definitions;
- contract-free protocol adapters;
- backend/API/indexing control plane;
- upload/processing/playback/livestream integration;
- user-facing static web application;
- retained Level 2 ecosystem integration;
- app-scoped security/abuse/moderation qualification.

DoobTube remains a replaceable application over canonical 420Media and does **not** rename or replace 420Media, create a second Media service authority, add a frozen Genesis application, allocate a reserved/frozen address, introduce a DoobTube Solidity contract, or take custody of user funds/private keys.

The application is **not yet repository-phase complete** because DOOBTUBE-10 documentation/operator closeout and DOOBTUBE-11 Level 3 exact-head repository closeout remain. Public-testnet and production/Genesis readiness remain DOOBTUBE-12/13.

## 1. Canonical identity and architecture

Canonical sources:

- `docs/DOOBTUBE-NAME-DECISION.md`
- `docs/DOOBTUBE-ARCHITECTURE.md`
- `docs/DOOBTUBE-PRODUCT-SCOPE.md`
- `docs/DOOBTUBE-DEPENDENCIES-TRUST.md`
- `docs/DOOBTUBE-DATA-LIFECYCLE.md`
- `docs/DOOBTUBE-CONTRACTS-ADAPTERS.md`
- `docs/DOOBTUBE-BACKEND-CONTROL-PLANE.md`
- `docs/DOOBTUBE-MEDIA-INTEGRATION.md`
- `docs/DOOBTUBE-WEB-APPLICATION.md`
- `docs/DOOBTUBE-ECOSYSTEM-INTEGRATION.md`
- `docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md`
- `docs/DOOBTUBE-ROADMAP.md`

Canonical relationship:

- DoobTube is a replaceable user-facing video application/client.
- `420/service/media/v1` remains canonical 420Media.
- DoobTube has no second Media protocol/service ID.
- DoobTube is not added to the frozen Genesis application catalog.
- DoobTube is not added as a Genesis consumer-service.
- No DoobTube-owned contract/frozen address is required for V1.
- Wallet/private signing remains external.
- raw/high-volume media remains off-chain.
- Pay/Compute remain transitive through 420Media.

## 2. Repository state

Original audit findings remain historical evidence: the original audited main contained no DoobTube source tree, tests, CI, app roadmap or qualification evidence.

Current audit-branch state now includes:

- `doobtube/integrations/` — external authority/adapter policy;
- `doobtube/api/` — backend/control-plane;
- `doobtube/media/` — media integration;
- `doobtube/web/` — static user-facing application;
- `doobtube/integration/` — retained Level 2 integration harness;
- `doobtube/security/` — app abuse/privacy/logging policy;
- `doobtube/tests/` — adapter/backend/media/integration/security suites;
- app-specific baseline CI;
- retained Level 2 integration CI;
- exact-head qualification evidence for completed roadmap steps.

No DoobTube Solidity namespace exists.

## 3. Component inventory

| Component | Current state |
|---|---|
| Canonical identity | COMPLETE |
| Stable roadmap | COMPLETE through DOOBTUBE-9 |
| Architecture/product/trust/lifecycle docs | COMPLETE |
| Protocol adapters | COMPLETE for V1 |
| DoobTube-owned contracts | NOT REQUIRED |
| Backend/API/control plane | IMPLEMENTED + Level 1 qualified |
| Persistence/migrations | IMPLEMENTED through schema v2 |
| Projection/index state | IMPLEMENTED as derived/rebuildable state |
| Media upload/playback/process/live integration | IMPLEMENTED + Level 1 qualified |
| Static web application | IMPLEMENTED + Level 1 qualified |
| Ecosystem integration | COMPLETE for Level 2 repository scope |
| Security/abuse/moderation | COMPLETE for app repository scope |
| User/developer/operator/release documentation | PARTIAL — DOOBTUBE-10 |
| Repository Level 3 closeout | PENDING — DOOBTUBE-11 |
| Public testnet | PENDING/BLOCKED — DOOBTUBE-12 |
| Genesis/production release | PENDING/BLOCKED — DOOBTUBE-13 |

## 4. Smart-contract and custody audit

DOOBTUBE-4 confirmed no DoobTube-owned Solidity contract is required for canonical V1.

DoobTube therefore introduces no:

- contract storage;
- upgrade/admin role;
- contract pause mechanism;
- app settlement ledger;
- escrow;
- refund ledger;
- token custody;
- DoobTube signing domain;
- DoobTube reserved/frozen address.

Relevant canonical protocol/service authority remains outside the application.

This makes app-specific reentrancy, contract storage corruption, MEV-sensitive settlement and app-custody errors non-applicable to current V1. Underlying protocol-contract security remains owned by the relevant protocol and final Level 3 repository qualification.

## 5. 420Integrated integration

Direct required V1 dependencies:

- ProtocolRegistry;
- Wallet;
- Smart Accounts;
- 420Media;
- 420Rights;
- 420Storage / Resource Protocol;
- 420Search;
- 420Notifications.

Direct optional:

- 420Identity.

Media-transitive:

- 420Pay;
- 420 Compute Market.

Not adopted V1:

- Names;
- Explorer;
- Analytics;
- Verify;
- Arbitration;
- AppStore;
- Governance;
- Treasury;
- Bridge;
- AI;
- Oracle;
- Stake;
- Token;
- Swap;
- Attention;
- Gaming and unrelated services.

DOOBTUBE-8 qualified the retained dependency graph together on one exact implementation SHA.

## 6. Application implementation

### Backend/API

Implemented:

- versioned `/v1` routes;
- Wallet/chain/network/capability authorization;
- durable idempotency;
- stable errors;
- bounded pagination/cursors;
- SQLite persistence/migrations;
- durable bounded-retry jobs;
- reorg/finality-aware derived feed projection;
- rebuild/recovery;
- health/readiness;
- protected metrics;
- secret-provider reference boundary;
- actor/operation abuse limits;
- privacy-safe durable error redaction.

### Media integration

Implemented:

- video metadata validation;
- scanner fail-closed gate;
- exact upload-plan/Storage manifest binding;
- DNS-aware SSRF validation;
- safe playback locator admission;
- static processing profiles;
- runtime/memory/CPU/PID bounds;
- provider/operator/result verification;
- livestream controller validation;
- persisted desired-live recovery;
- bounded reconnects;
- privacy-safe transport error persistence.

### Web application

Implemented canonical V1 surfaces for:

- public discovery;
- Search;
- media playback/detail;
- creator/channel presentation;
- creator library;
- upload;
- livestream create/control;
- subscriptions/preferences;
- report/appeal;
- honest delete/export availability status;
- Wallet/network/service status.

Runtime configuration remains fail-closed until deployment values are materialized.

## 7. Build/dependency audit

Current repository app surfaces build/compile successfully under app-specific qualification:

- Python package compilation;
- dependency-free static web structural/security check;
- browser/service fixture tests;
- deterministic static web build.

No DoobTube Solidity build is applicable because no contract exists.

Production deployment configuration, reproducible operator runbooks and release manifest remain DOOBTUBE-10.

## 8. Test audit

Completed retained suites include:

- protocol adapter negative/boundary tests;
- backend authorization/idempotency/persistence/reorg/retry tests;
- media malicious-input/SSRF/provider/recovery tests;
- static web structural/security/browser fixture tests;
- Level 2 ecosystem authority/dependency tests;
- app security/abuse/privacy tests.

Focused 420Media security/API dependency qualification is retained where DoobTube relies on Media sessions, moderation, webhook replay protection and scanner/rate boundaries.

Repository-wide Level 3 inventories are intentionally deferred to DOOBTUBE-11.

## 9. Security audit

Canonical security record:

`docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md`

**SECURITY QUALIFIED: YES for current app repository scope.**

DOOBTUBE-9 explicitly dispositions every original threat class:

- broken access control — CLOSED;
- privilege escalation — CLOSED;
- authorization replay — CLOSED;
- nonce/domain mistakes — CLOSED/DELEGATED to canonical Media signing intent;
- reentrancy — N/A for DoobTube V1, no contract;
- accounting/custody/refund — N/A for V1, no monetary/custody path;
- front-running/MEV — N/A for current app logic;
- stale oracle/bridge — N/A, services not adopted;
- content-rights abuse — CLOSED by Rights/public eligibility gate;
- moderation abuse — CLOSED by Media actor/capability/rate/audit boundaries;
- spam/Sybil — CLOSED to application authority scope with bounded sensitive operations;
- malicious uploads — CLOSED at repository layer by scanner/isolation/resource/egress controls;
- rate/resource exhaustion — CLOSED at app repository layer; distributed edge proof deferred;
- webhook replay — no DoobTube receiver; inherited Media HMAC/timestamp/event replay verifier qualified;
- operator compromise — CLOSED at repository authority boundary; live response operations deferred;
- secrets/logging/privacy leakage — CLOSED at app repository layer with no key custody, redaction and visibility controls.

No unresolved repository-level DoobTube vulnerability is known at DOOBTUBE-9.

Live infrastructure security evidence remains explicitly deferred and does not imply production readiness.

## 10. Documentation status

Present:

- name decision;
- architecture;
- product scope;
- dependency/trust model;
- data/lifecycle model;
- contracts/adapters decision;
- backend/API/control-plane reference;
- media integration/security reference;
- web application reference;
- ecosystem integration milestone record;
- security/abuse/moderation threat review;
- per-step qualification evidence through DOOBTUBE-9.

Still required by DOOBTUBE-10:

- app/root README reconciliation;
- consolidated architecture/component map;
- final roles/permissions reference;
- config/env reference;
- clean build/test/non-production deployment instructions;
- migration/upgrade instructions;
- troubleshooting;
- user/developer/operator guides;
- known limitations;
- rollback/recovery operations;
- monitoring/SLO definition;
- release manifest.

## 11. Genesis/deployment readiness

DoobTube remains intentionally absent from the frozen Genesis application catalog and Genesis consumer-service map.

Current repository work does not claim:

- production endpoint;
- DNS/domain;
- public testnet deployment;
- production TLS;
- live Registry publication for a DoobTube service identity;
- production secret manager evidence;
- production scanner/provider/CDN evidence;
- production monitoring/SLO/backup evidence.

Readiness remains:

- TESTNET READY: **NO**
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

## 12. Current requirement matrix

| Requirement | State |
|---|---|
| canonical identity/architecture | COMPLETE |
| V1 product workflows | COMPLETE |
| dependency/trust graph | COMPLETE |
| data/lifecycle architecture | COMPLETE |
| contract/adapters scope | COMPLETE |
| backend/API/control plane | COMPLETE |
| media integration | COMPLETE |
| web application | COMPLETE |
| Level 2 ecosystem integration | COMPLETE |
| app security/abuse/moderation | COMPLETE |
| consolidated docs/operator/deployment closeout | COMPLETE |
| repository Level 3 exact-head closeout | PENDING DOOBTUBE-11 |
| public-testnet qualification | PENDING DOOBTUBE-12 |
| Genesis/production release | PENDING DOOBTUBE-13 |

## 13. Qualification policy

Ordinary steps use targeted app-specific Level 1 qualification.

DOOBTUBE-8 is the retained Level 2 app integration milestone.

DOOBTUBE-11 owns the one expensive Level 3 exact-head repository closeout, including canonical Solidity and Genesis owners without duplicate full Foundry inventory.

Evidence-only commits may inherit an exact qualified implementation SHA only when they change no executable/test/workflow/config/interface/deployment/substantive state.

## 14. Current blockers / deferred work

Repository blockers remaining before app-phase closeout:

1. DOOBTUBE-11 exact-head Level 3 repository closeout.

External/live blockers after repository closeout:

3. approved public testnet and production-equivalent infrastructure;
4. live service endpoints/TLS/Registry bindings;
5. live scanner/provider/storage/CDN behavior;
6. monitoring/backups/rollback/operator response;
7. production/Genesis release approval and final security review/exception.

## 15. Readiness state

- CODE COMPLETE: **NO** — final repository-phase declaration is reserved for DOOBTUBE-11 after DOOBTUBE-10 closeout.
- BUILD COMPLETE: **NO** — app builds pass, but final exact-head Level 3 build/deployment/config closeout remains.
- CONTRACT COMPLETE: **YES for current V1 scope** — no DoobTube contract is required and external bindings are qualified.
- TEST COMPLETE: **NO** — app suites pass through DOOBTUBE-10; final Level 3 repository qualification remains.
- DOCUMENTATION COMPLETE: **YES for repository app scope** — root/app README, reference, user/developer/operator, deployment/config, migration/recovery, troubleshooting, SLO and release-manifest documentation are complete; final global Docs reconciliation remains DOOBTUBE-11.
- INTEGRATION COMPLETE: **YES for repository Level 2 scope** — live production-equivalent integration remains DOOBTUBE-12.
- SECURITY QUALIFIED: **YES for current app repository scope** — final Level 3 security/static/deployment reconciliation remains DOOBTUBE-11.
- TESTNET READY: **NO**.
- GENESIS READY: **NO**.
- PRODUCTION READY: **NO**.

## Final determination

**DoobTube is NOT COMPLETE as a full repository/release phase.**

The application implementation, security, documentation and non-production operator closeout are complete through DOOBTUBE-10. Remaining canonical repository work is the final exact-head Level 3 repository qualification, followed by separate public-testnet and production/Genesis phases.

**DOOBTUBE-0 through DOOBTUBE-10 are complete. Next: DOOBTUBE-11 — Repository Level 3 exact-head closeout.**
