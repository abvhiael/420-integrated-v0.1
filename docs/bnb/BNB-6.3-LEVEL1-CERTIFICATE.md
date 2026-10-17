# BNB-6.3 — Level 1 deployment-manifest qualification certificate

**Disposition: PASS — repository-side Level 1, not production or external-provider acceptance.**

## Canonical requirements and scope
Source: `docs/bnb/BNB-PHASE6-ROADMAP.md`, BNB-6.3 — **Production-equivalent deployment manifests**: reproducible API, worker, PostgreSQL, ingress and consumer deployment definitions; TLS, isolation, resource limits, health checks, nonroot execution and artifact provenance.

- **Qualified implementation SHA:** `a2c87ab31855545e26bd606079df6687083a4bcc`.
- **Branch / PR:** `audit/bnb-phase6-bnb-6-1-baseline-20261015`, draft PR [#667](https://github.com/abvhiael/420-integrated-v0.1/pull/667), **unmerged**.
- **Starting Phase 6 main base:** `19166dfbdafd1f51a9cd9bbd2a22abfe95b8d451`. Main later observed at `9fce5444bd009efe382a6874c0a5259498457454`; Phase 6 branch has not undergone final main reconciliation, reserved for BNB-6.12.
- **Qualification level:** Level 1, with no Level 2 or Level 3 asserted. This certificate is evidence-only and does not change runtime, tests, CI, manifests or release permissions. Its resulting evidence-commit SHA is distinct from the implementation SHA above.

## Requirements-to-evidence mapping
| Requirement | Repository implementation / verified boundary |
| --- | --- |
| Reproducible API and worker | `services/420bnb/compose.production.yml`: two API replicas, explicit worker profile, pinned image references supplied by operator; `deployment-topology.v1.json` and `validate_deployment.py` validate declared boundaries |
| PostgreSQL | Independently managed PostgreSQL 16+ specified as an external dependency, **not** an invented production database deployment; separate runtime/migrator mounted credentials, verified TLS, channel binding and controlled migration. Actual managed deployment remains externally gated |
| Ingress and TLS | Caddy HTTPS topology, 443 external to nonroot 8443, mounted TLS files, disabled admin interface, private API/Web backends; independently approved certificates are **not** present |
| Consumer deployment | Independent Search/Travel consumer topology and separately implemented consumer entrypoint inventoried; fixture-only consumer runner and independently signed acceptance remain **non-production**. No approved independently deployed consumers are claimed |
| Isolation and least privilege | Read-only filesystem, UID 10001, dropped capabilities, no-new-privileges, private backend network, separate migrator binding; negative tests protect activation and scope |
| Resource controls and health | Explicit CPU, memory and PID budgets; API `/health/ready`, Web and ingress checks, worker/migrator lifecycle correctly not mislabeled long-running health |
| Provenance and release gating | `@sha256:` image references, exact SHA/revision checks, CI recorded immutable parent manifest/config-image metadata; registry publication/approval remains unverified |
| Fail-closed negative behavior | `tests/test_bnb63_deployment.py` and existing BNB-3.2/Phase 5 runtime tests reject forbidden financial/booking activation, invalid image references, unsafe DB/consumer claims, insufficient limits and service-identity mismatches |

## Actual CI evidence on the exact implementation SHA

- [420BnB Runtime Slice run #38851574171](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38851574171), job **#116813714245** (`runtime`), **COMPLETED / SUCCESS**. Includes affected pytest tests, PostgreSQL/verified-TLS fixture, migrations, API/security tests, restore smoke, container builds, browser checks, topology/ingress validation and image evidence upload. The CI PostgreSQL and image-build fixtures are **not** a live production acceptance.
- BNB-1.1 Source Reconciliation #38851574222 — **SUCCESS**.
- BNB-1.2 Product Contract #38851574656 — **SUCCESS**.
- BNB-1.3 Domain/M1 #38851574318 — **SUCCESS**.
- BNB-1.4 Authority Boundaries #38851574580 — **SUCCESS**.
- BNB-1.5 Financial Architecture #38851574411 — **SUCCESS**.
- BNB-1.6 Backend Architecture #38851574459 — **SUCCESS**.
- BNB-1.7 Guest/Host Experience #38851574142 — **SUCCESS**.
- BNB-1.8 Security/Privacy/Abuse #38851574067 — **SUCCESS**.
- BNB-1.9 Deployment Operations #38851574009, job **#116813713370** — **SUCCESS**.
- Supplemental [420Oracle audit #38851574458](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38851574458) — **SUCCESS**, jobs **#116813714728**, **#116813714960**, **#116813715929**, **#116813716243**, all successful.
- 420Docs #38851574169 — **SKIPPED**, expressly **not** counted as a passing qualification check or required for this Level 1 step.
- No global Solidity, Genesis, Integrated, Geth or full Docs suites were launched for this certificate. No duplicate successful CI was dispatched.

## Boundaries and disposition

**BNB-6.3 repository-side Level 1: PASS.** No external consumer, certificate issuer, managed PostgreSQL, deployment promotion, live Search/Travel transport or production environment has been independently accepted. Such work remains governed by `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. Maintain `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`.

**Merge status:** PR #667 remains **draft, open, unmerged**; no merge authority granted by this certificate. **Level 2:** BNB-6.6 and BNB-6.11 only. **Level 3:** BNB-6.12 only. **Next canonical step:** BNB-6.4 — Database lifecycle and migration safety.
