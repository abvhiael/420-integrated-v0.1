# GROW-V2-02 — Level 1 exact-SHA qualification evidence

**Disposition (2026-10-08): COMPLETE at Level 1 for the architecture/policy step only.** No private cultivation API, live authentication, PostgreSQL, device actuation, production deployment or externally validated legal compliance has been implemented by this scope.

- **Canonical step:** GROW-V2-02 — Architecture, tenancy, roles and security model.
- **Substantive qualified implementation SHA:** `2533e22b501802eeb913d0b143a68f8d2637ce97`.
- **Main/reconciliation base SHA:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`, branch 14 ahead / 0 behind at closeout inspection.
- **PR/branch:** [#582](https://github.com/abvhiael/420-integrated-v0.1/pull/582), `audit/420grow-v2-01-product-decision-20261008`; draft, no phase merge.
- **Implementation files:** `docs/audit/420GROW-V2-02-ARCHITECTURE-TENANCY-SECURITY.md`, `grow/security/policy.go`, `grow/security/policy_test.go`, `scripts/verify-grow-v2-02.py`, `.github/workflows/420grow-v2-fast.yml`, `docs/audit/420GROW-V2-ROADMAP.md`. Previously qualified V2-01 and original GROW-01–10 boundaries retained.
- **Functional scope:** tenant and authenticated subject equality, active membership, least-privilege OWNER/MANAGER/TECHNICIAN/REVIEWER/MAINTAINER role matrix, facility/zone scoping, deny unknown actions/roles/principals/tenants/states, reject cross-tenant and revoked access, and hard-deny all DEVICE_CONTROL until V2-07's separate reviewed capability. Policy is explicitly not an authentication provider or a deployed API.
- **Security/threat scope:** private cultivation versus anonymous public directory separation, IDOR/scope confusion, no unauthenticated promotion, device control denial, later session revocation/CSRF/MFA strategy, tenant-filtered persistence and audit requirements. No source changed in original public `grow/web` or `grow/service`.
- **[420Grow V2 fast run 37862864718](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37862864718)** — exact SHA `2533e22b501802eeb913d0b143a68f8d2637ce97`, job **113602515673 SUCCESS**. Steps: exact checkout, V2-01 verifier, Go security unit tests including negative roles/tenants/scopes, race detector, go vet, V2-02 architecture verifier and Python syntax all PASS.
- **[Retained 420Grow fast run 37862864805](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37862864805)** — exact SHA, job **113602515723 SUCCESS**. Original Grow Go/frontend/Location/GEN-SVC-2 build, app race/integration/security/static and GROW-01–10 verifiers all PASS. No skip/cancel counted as green.
- **Diagnosed repairs:** original V2 workflow miscompared synthetic PR-merge checkout versus declared PR head; fixed by pinning checkout to `github.event.pull_request.head.sha || github.sha`. Later V2-02 verifier required the literal phrase `public directory` despite documentation using `public 420Location`; fixed verifier phrase to its actual normative section. Neither changed authorization behaviour or relaxed substantive tests; both repairs qualified afresh at the above SHA.
- **Unrelated check observations:** `governance-deployment-audit.yml` may report failure without a job, and global Docs/Oracle may trigger/skip due to broad repository triggers. These are not claimed as V2-02 green evidence or used as a reason to duplicate unrelated full suites.
- **Milestones:** V2-02 is Level 1 only; V2-05 accumulates V2-02–05 into Level 2, V2-10 next Level 2.
- **Deferred:** V2-03 persistence, V2-04 actual facilities, V2-07 authorized actuation, V2-12 ecosystem, V2-15 global Level 3, V2-16 testnet live acceptance. Historical 420Grow Foundry gate from PR #567 remains separately unresolved; no waiving of future full qualification.
- **Blockers for this step:** none. Live security beyond this pure policy kernel remains out of scope.
- **Next exact canonical step:** **GROW-V2-03 — Persistent storage, schemas and migrations**.

This is evidence-only closeout inheriting the tested substantive SHA; no executable, test, workflow, dependency, configuration, API interface or substantive requirement is changed by this record.
