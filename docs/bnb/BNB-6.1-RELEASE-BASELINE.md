# BNB-6.1 — Phase 5 inheritance and operational release baseline

**Scope:** repository-side inventory and provenance only. The BNB-6.1 Level 1 exit requires a verified merged Phase 5 foundation, deployment/configuration inventory, dependency/gap register and directly affected checks. It does not reopen BNB-5.14 or qualify live external providers.

## Verified provenance

- At initial discovery, `main` = **`19166dfbdafd1f51a9cd9bbd2a22abfe95b8d451`**. PR #644 (Phase 5) and PR #665 (Docs-only qualification witness) are merged/closed; the final main merge commit is `19166dfbdafd1f51a9cd9bbd2a22abfe95b8d451`.
- Phase 5 canonical certificate: `docs/bnb/BNB-5.14-PHASE5-LEVEL3-CLOSEOUT.md`; qualified executable `7bed67de5833778a070b60e8d87aafc637a75a05`. Certificate and later docs-only evidence retained in the merged main tree.
- Canonical global owner results are attributed to their **original exact SHAs**, not retrospectively to Phase 6: Foundry #38809310678, Genesis #38809360126, Integrated #38809400514 on `f6989e22b55c7511466957f44d3fdfe7ffb3f496`; full Docs #38837681871 on `0e1128934a80fa8817f0100341499ad14550e979`. Reuse rationale and boundaries: `BNB-5.14-GLOBAL-EVIDENCE-INHERITANCE.md`.
- BnB Runtime Slice #38830601652 (479 application + 8 ops passes, original SHA `ab0316c7d09e0f7d369733e647e60605a4215abb`); nine retained BNB-1.1–1.9 guards passed on that original SHA. No requalification is implied merely by recording inheritance.
- Main's Phase 5 merge tree was verified identical to the audited merged head (zero file differences). This is historical provenance, not a fresh Phase 6 test.

## Existing repository-side deployment inventory

| Surface | Repository evidence | Existing boundary / remaining Phase 6 verification |
| --- | --- | --- |
| API image | `services/420bnb/Dockerfile` | Python 3.12, unprivileged UID 10001, revision label; Phase 6 validates complete release assembly and image provenance |
| Web and ingress images | `services/420bnb/Dockerfile.web`, `services/420bnb/Caddyfile.production` | Container and TLS topology exist; independent approved image digest and actual certificates not present |
| API/worker/ingress orchestration | `services/420bnb/compose.production.yml` | Two API instances, optional worker and migrator profiles, nonroot/read-only/cap-drop, managed PostgreSQL bindings; rolling updates, worker external transport and independent operations still unaccepted |
| Release template and trust configuration | `services/420bnb/deployment.template.json`, `services/420bnb/production.py` | Placeholder exact release SHA, image digests, HTTPS origins, issuer approval references and mounted keys are *unresolved operator inputs*, not existing live approval |
| Database | `services/420bnb/migrate.py`, `services/420bnb/migrations/001_initial.sql` through `030_message_device_lifecycle.sql` | 30 tracked migrations, migration ledger and repeated CI/restore exercise; real managed PostgreSQL deployment and independent restore/rollout acceptance remain external |
| Worker and projections | `services/420bnb/worker.py`, `outbox.py`, `consumer_delivery.py`, `projection_refresh.py` | Bounded supervised local transport and durable state were qualified; live independently authorized Search/Travel and notification consumers remain external |
| CI | `.github/workflows/bnb-runtime.yml`, `.github/workflows/bnb-1-1.yml` through `bnb-1-9.yml` | Existing targeted runtime/security/migration/TLS/browser/packaging and legacy guardrail coverage; no new comprehensive global test for ordinary BNB-6.1 |

## Gap register — repository-side work for planned Phase 6

| IDs | Required work, do not assume already absent or broken | Exit check |
| --- | --- | --- |
| BNB-6.2 | Reconcile versioned release environment schema, feature-flag denial, secret/service identity policy and full startup negative test matrix | Validate each required config and forbidden enablement |
| BNB-6.3 | Determine deployment topology completeness, image pinning, least privilege, TLS, resource budgets, independent consumer entrypoints and service health | Deploy topology/manifest verifier plus isolated nonprod smoke |
| BNB-6.4 | Verify migration/rolling-compat/restore/interruption guarantees with existing 30-step ledger | Isolated PostgreSQL destructive failure/recovery tests |
| BNB-6.5 | Reconcile actual provider adapters/transport interfaces with release trust roots and fail-closed defaults; no invented approvals | Authenticated negative/offline adapter tests |
| BNB-6.7/6.9 | Investigate monitoring, alerts, redaction, replay, session/issuer compromise, abuse and cross-tenant coverage gaps from existing qualified tests | Targeted adversarial and operational tests |
| BNB-6.8/6.10 | Formalize promotion/rollback, immutable provenance, upgrade and recovery exercises; do not label local rehearsals independent prod proof | Immutable release/rollback ledger and isolated drills |

This register identifies required **verification/remediation scopes**, not claims that code is missing or failing. Before implementation each future step must compare with the existing repository feature and test inventory and eliminate already satisfied work. Intermediate M6-A/M6-B Level 2 and final Level 3 are preserved at BNB-6.6/6.11/6.12.

## Separately deferred external/testnet dependencies

Authoritative ledger: `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`, including official Identity/issuer trust and key custody; independent property and media issuer approval; calendar provider; tax/quote/420Pay/420Swap/finality/settlement/refunds; Travel/Location/maps/jurisdiction, reputation and Compliance; manual WCAG assistive technology acceptance; production-equivalent multi-instance security, restore and operational acceptance. Those are **not** BNB-6.1 repository omissions to be hidden, nor release permissions. Preserve `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`.

## Qualification decision

**BNB-6.1: READY FOR TARGETED LEVEL 1 VALIDATION, not a claim of new CI PASS.** No executable implementation changed. Validate this inventory with the existing `BNB-1.1 Source Reconciliation` CI against the new branch SHA; separately preserve its run ID and exact SHA in a Level 1 evidence-only certificate after completion. No global Solidity, Genesis, Integrated, Docs or unrelated inventories are required for this documentation-only baseline. BNB-6.2 follows only after the Level 1 owner check succeeds.
