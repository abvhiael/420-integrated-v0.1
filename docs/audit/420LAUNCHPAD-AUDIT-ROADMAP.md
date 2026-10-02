# 420Launchpad audit remediation roadmap

Stable numbering. Do not renumber completed or blocked steps.

## LAUNCHPAD-AUDIT-1 — canonical-definition reconciliation
Status: **COMPLETE**

- distinguish `420/service/launchpad/v1` protocol from `420/service/launchpad-crowdfunding/v1` consumer service;
- preserve V1 non-custodial architecture;
- record exact baseline repository/branch/PR history;
- add requirement matrix and readiness states;
- add machine-readable dependency reconciliation;
- add dedicated exact-head audit CI and adversarial contract tests.

Exit: dedicated audit verifier + focused tests pass on exact audit head.

### Durable qualification evidence

- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Implementation SHA: `e431fd58eeba14a071dc9e4eddc09a829a0c09f5`
- Audit branch: `audit/420launchpad-remediation`
- Pull request: **#489**
- Audit branch baseline / PR base at implementation start: `f529533ebe62b63ad3f30f685f0c1c44f69ec06b`
- Current observed `main` during closeout: `c3fbda60247e76f26a7e183069dd6782ed0da038`
- Exact-head qualification workflow: `420Launchpad audit qualification`
- Passing run: **37075504425**
- Passing job: **111064375101**
- Exact-head verification: **PASS**
- Audit model verifier: **PASS**
- Foundry formatting gate: **PASS**
- Launchpad contract build: **PASS**
- Focused `LaunchpadGenesis420.t.sol` + `LaunchpadAudit420.t.sol` qualification: **PASS**
- Forbidden-primitive/static scan: **PASS**
- Earlier run **37074522626** failed only at the formatting gate; the formatting defect was corrected before the passing exact-head run.
- Security/adversarial result: canonical-definition boundary, default-deny authorization coverage, pre-start contribution rejection, one-shot controller binding, unauthorized post-success claim rejection, successful-sale refund rejection, terminal cancellation behavior, and forbidden primitive scan are retained in the step-specific suite.
- Level 2 milestone qualification: **NOT REQUIRED** for this canonical-definition reconciliation step; no major shared authority/lifecycle dependency was introduced.
- Level 3 closeout qualification: **INTENTIONALLY DEFERRED** to complete Launchpad app-phase closeout.
- Remaining blockers for this step: **NONE**
- Completion state: **COMPLETE**
- Next canonical roadmap step: **LAUNCHPAD-AUDIT-2 — V1 contract hardening**

The evidence record above is documentation-only and references the already-qualified implementation SHA. Under the audit qualification model, this evidence-only closeout does not create a new implementation SHA requiring recursive qualification.

## LAUNCHPAD-AUDIT-2 — V1 contract hardening
Status: **COMPLETE**

- expand authorization, zero/boundary, state-transition, duplicate-operation and terminal-state tests;
- explicitly decide/document payment/delivery/refund commitment uniqueness semantics;
- explicitly decide/document allocation rounding-dust semantics;
- decide whether project `active` is immutable metadata or a real governed lifecycle control;
- add fuzz/property coverage for caps and allocation conservation;
- run forbidden-primitive/static analysis.

Frozen V1 semantics for this step:
- payment/delivery/refund commitments are required nonzero opaque audit references; V1 does not enforce global commitment uniqueness, and canonical settlement/replay binding is deferred to LAUNCHPAD-AUDIT-3;
- pro-rata allocation uses floor division; aggregate claims may leave unassigned accounting dust, with no custody or sweep authority in V1;
- `Project.active` is an immutable registration marker in V1; sale lifecycle authority is `LaunchpadSaleRegistry420.State`.

Exit: all V1 invariants have direct negative + boundary coverage and unresolved semantics are frozen.

### Durable qualification evidence

- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Implementation SHA: `39139692882b8d4d0342c5e3b0ad5187044e6140`
- Audit branch: `audit/420launchpad-remediation`
- Pull request: **#489**
- Audit branch merge-base / original PR base: `f529533ebe62b63ad3f30f685f0c1c44f69ec06b`
- Current observed `main` during closeout: `b58b09a17e641a42b81d832bad913a83c7caada9`
- Branch divergence at closeout: **17 ahead / 261 behind** current `main`; reconciliation is intentionally deferred to Level 3 app-phase closeout.
- Exact-head qualification workflow: `420Launchpad audit qualification`
- Passing run: **37078071858**
- Passing job: **111072650053**
- Exact-head verification: **PASS**
- Audit model / frozen V1 semantics verifier: **PASS**
- Foundry formatting gate: **PASS**
- Launchpad contract build: **PASS**
- Focused Foundry qualification: **25/25 PASS** across `LaunchpadGenesis420.t.sol` and `LaunchpadAudit420.t.sol`.
- Fuzz/property qualification: **PASS — 2,500 runs** for cap/accounting/allocation conservation and bounded floor-rounding dust.
- Forbidden-primitive/static scan: **PASS**
- Invariants covered directly: canonical/replay-safe identities; immutable sale economics; hard/per-wallet caps; soft-cap finalization; failed/cancelled versus successful refundability; successful/started claims; default-deny contribution/claim/refund authorization; non-custodial/no-mint boundary; nonzero payment/delivery/refund commitments; no unilateral 420Swap authority.
- Frozen commitment semantics: nonzero opaque audit references; global commitment uniqueness and canonical settlement/replay binding remain outside V1 and are deferred to **LAUNCHPAD-AUDIT-3**.
- Frozen allocation semantics: per-participant floor division; aggregate claims cannot exceed token allocation; residual rounding dust is unassigned accounting dust with no V1 custody/sweep authority.
- Frozen project-active semantics: immutable registration marker; sale lifecycle remains governed by `LaunchpadSaleRegistry420.State`.
- Implementation files changed for Audit-2: `contracts/test/LaunchpadAudit420.t.sol`, `contracts/config/interfaces/420launchpad-v1-hardening.json`, `scripts/verify-420launchpad-audit.py`, `.github/workflows/420launchpad-audit.yml`, `docs/audit/420LAUNCHPAD-AUDIT.md`, and this roadmap.
- Earlier deterministic harness failures were diagnosed and corrected: Foundry formatting drift, then a legacy `testFail*` naming collision. Neither was accepted as passing evidence.
- Level 2 milestone qualification: **NOT REQUIRED** — Audit-2 hardens the existing V1 contract boundary and introduces no new shared authority or dependency integration.
- Level 3 closeout qualification: **INTENTIONALLY DEFERRED** to the complete Launchpad app-phase closeout.
- Remaining blockers for this step: **NONE**
- Completion state: **COMPLETE**
- Next canonical roadmap step: **LAUNCHPAD-AUDIT-3 — crowdfunding dependency integration**

This closeout is documentation/evidence-only and references the already-qualified implementation SHA above. It does not change executable source, tests, workflows, configuration, dependencies, interfaces, generated artifacts, deployment state, or substantive requirements, so recursive qualification is not required.

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

