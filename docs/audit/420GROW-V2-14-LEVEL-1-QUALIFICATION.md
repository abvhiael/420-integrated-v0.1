# GROW-V2-14 — Security, privacy, adversarial and recovery Level 1 qualification

**Canonical roadmap step:** GROW-V2-14 — Security, privacy, adversarial and recovery qualification.
**Disposition:** **COMPLETE — Level 1 PASS** for the app-audit phase; this is not a production deployment, security certification, or the V2-15 comprehensive closeout.

## Exact implementation and repository state

- **Qualified implementation SHA:** `e6049e4d3ef134afabcc43af1438ba9350c5a801`.
- **PR:** [#582](https://github.com/abvhiael/420-integrated-v0.1/pull/582), draft, unmerged, audit branch `audit/420grow-v2-01-product-decision-20261008`.
- **Main at qualification:** `0ec695481fc84e6066aeae50baf6e0fd3c7f8731`; PR original base `ffc6a4028676907c266714b5c1ae8ba3af9a7137`; branch approximately 326 commits ahead and 84 behind current main. **No main reconciliation or merge performed.**
- **V2 fast:** [run 37892233748](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37892233748), job `113695496169`: **SUCCESS**, including dedicated step `GROW-V2-14 security privacy adversarial recovery Level 1` **SUCCESS**, all required prior Grow V2 app stages successful.
- **Retained Grow fast:** [run 37892233870](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37892233870): **SUCCESS**.
- Workflow checkout checks the exact GitHub head SHA before tests. Evidence-only documentation commits after this SHA inherit implementation qualification **only if they change no executable source, test, workflow, config, dependency, deployment or substantive requirement**.

## Repository-grounded scope and repaired defects

V2-14 is the security/privacy/adversarial/recovery **Level 1 app-audit step** following V2-13's now-qualified dedicated TLS private service, revocable certificate-backed sessions, tenant-scoped PostgreSQL SQLReader and domain-authorized frontend writes, export, and human review. Existing V2-01–13 qualifications and production-equivalent deployment gates remain separate.

**Fixed real security defect:** `grow/dashboard/projection.go` formerly used an incorrect positional SQL placeholder for the facility list, then retained an unused argument after initial repair. The final implementation filters facilities with the verified tenant's actual facility scope and supplies precisely the expected bind parameters. It cannot enumerate another same-tenant facility through a facility-/zone-limited member.

**Additional V2-14 tests / coverage:**

| Risk/requirement | Test/evidence | Result |
| --- | --- | --- |
| Cross-tenant confidentiality and same-tenant horizontal facility/zone isolation | `grow/dashboard/integration_test.go` with two tenants, separate restricted zone and second restricted facility; real non-superuser PostgreSQL role | PASS |
| Active membership and permissions on every read/write | Session-backed read/action endpoints; technician/reviewer forbidden action tests; suspension while cookie remains active denies subsequent reads and mutation | PASS |
| Database failure/recovery confidentiality | PostgreSQL pool shut down following successful session and CRUD paths; subsequent requests cannot return previous private rows | PASS |
| Authentication and session integrity | Retained `certificate_integration_test.go`: real TLS client certificate/CA, enrolled fingerprint and SPIFFE identity, forged forwarding header rejected; revoked certificate/session denied | PASS |
| CSRF, method, untrusted origin and route/path attacks | New `security_v214_test.go` denies missing/invalid CSRF token, wrong origin, null origin, GET mutation and unrecognized private routes | PASS |
| Anonymous, missing service, expired session, malicious cross-tenant projection and database outage | `security_v214_test.go` verifies fail-closed status and noncacheable private errors; prior handler negative tests retained | PASS |
| Replay/idempotency, stale revision, cross-tenant mutations, arithmetic/record invariants | Retained V2-01–13 Go services and integration/SQL suites; domain service remains the only mutation authority, with stable per-request UUID on writes | PASS |
| Mobile-browser privacy, inaccessible controls, XSS and session recovery | Retained real Chromium mobile/desktop, keyboard accessible labels, hostile text rendering, revoked-session data clearing, login recovery, logout | PASS |
| Affected builds/static tests and app regression | Both successful Grow-specific workflows: Go build/unit/race/vet/gofmt; PostgreSQL schema + fixture, Node checks, static distribution, browser; no skipped required stage in exact-SHA successful runs | PASS |

**Changed source/test/CI:** `grow/dashboard/projection.go`, `grow/dashboard/integration_test.go`, `grow/dashboard/security_v214_test.go`, `grow/dashboard/qualify.sql`, `.github/workflows/420grow-v2-fast.yml`. The new explicit V2-14 job gate is a small targeted `go test -run '^TestV214'` plus targeted race test. The retained V2-13 stage already qualifies actual PostgreSQL integration and Chromium; these expensive parts were not duplicated simply for a second V2-14 label. Trigger coverage for Grow dashboard, private server, frontend and Go module inputs was reconciled.

## Qualification boundaries and milestone policy

**Level 1: COMPLETE**, exact implementation SHA above. **Level 2:** V2-05 and V2-10 app milestones are already retained; this final V2-14 step did not require a redundant new Level 2, since the active app-specific workflow executed the affected private integration stack. **Level 3:** Intentionally **DEFERRED to canonical GROW-V2-15** against a newly reconciled single exact merge-candidate SHA. At that phase gate, full Solidity inventory belongs solely to Solidity Contracts, and Genesis verifies frozen-address/manifest/address authority without reproducing full Foundry inventory. Global 420 Integrated, Docs/global reconciliation and applicable retained app/clients/deployment/static/security checks belong at Level 3 only.

**V2-16:** production-equivalent testnet/live service installation, real operator CA/key and certificate issuance, hardened PostgreSQL credentials/TLS, production hosting, device/browser matrix, operational monitoring and recovery exercises remain testnet/operator deployment work. The current private service is **not** represented as deployed or connected to genuine customer cultivation records. This Level 1 pass does not certify an external security audit, live-service penetration test, or real customer data retention compliance.

**Next canonical step:** **GROW-V2-15 — Documentation, exact-SHA phase reconciliation and complete Level 3**. Do not merge this draft PR prior to successful exact-SHA Level 3 and main reconciliation.
