# LIFTd — Milestone B repository-local exit, exact-SHA Level 2 qualification

**Disposition:** repository-local Milestone B **LEVEL 2 PASS**. **Canonical M-L03-B — NOT ACCEPTED** pending independent deployed integration, operational and safety acceptance. Neither live pilot nor public passenger service is authorized.

- **Requested scope:** Local operational and pilot controls implemented, tested and disabled for unauthorized public use; actual pilot and independent recovery approval deferred.
- **Exact qualified implementation SHA:** `f611e09b50734bcd4f435e31cde97c09a5096db0`.
- **Reconciliation base SHA:** `259ae64f2d4003095852f6053b8de1677cef1cc0`.
- **Branch:** `audit/liftd-milestone-b-local-exit-20261018`; [PR #722](https://github.com/abvhiael/420-integrated-v0.1/pull/722).
- **Successful scoped Level 2:** [GitHub Actions run #39095024254](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39095024254), job `117579566619`, **SUCCESS**; exact `git checkout --force f611e09b50734bcd4f435e31cde97c09a5096db0`.
- **Retained LIFTd and local milestone unit/security:** 147 PASS / 0 FAIL.
- **Real PostgreSQL recovery tests:** 4 PASS / 0 FAIL, including durable lease fencing and least-privileged role checks.
- **Real PostgreSQL privacy/retention:** 1 PASS / 0 FAIL.
- **Isolated DB dump/restore:** `LIFTD_BACKUP_RESTORE_ISOLATED_PASS` (data and migration checksums).
- **Total automated tests:** **152 PASS / 0 FAIL**, plus the separate physical backup/restore drill.
- **New cross-control suite:** `rideshare/test/milestone-b-local-exit.test.mjs`, validates dual default-off deployment and pilot admission, nonadmission of a zero-capacity rider trip, immutable audit/legal hold restoration and rollback remaining traffic-disabled.
- **CI owner:** `.github/workflows/liftd-milestone-b-local-level2.yml`. Retained app-specific integration only, no global Foundry, Genesis, Integrated, Geth or Docs inventories.
- **Local exit matrix:** `docs/rideshare/MILESTONE-B-LOCAL-EXIT.md`; reuses fully qualified PT-04/05/06/07/08 and L03.6–L03.8 artifacts without repeating their unrelated exact-SHA workflows.
- **Independent acceptance withheld:** canonical M-L03-B, L03.9, L03.10, L03.11 and production recovery, official testnet, insurer/regulator/driver/vehicle, independent safety authority, deployed vault/Identity/Registry, RTO/RPO and privacy remain **NOT ACCEPTED** under unchanged TN-0–TN-6. CI cannot substitute for external proof.
- **Level 3:** not initiated. Canonical L03.12 closeout cannot start until all applicable gate evidence accepted and implementation frozen.
- **Merge:** not performed; assess current-main compatibility and GitHub policy before any user-authorized merge.

This document records a non-executable evidence-only commit against the successful implementation SHA; it does not change tests, workflows or qualified runtime behavior.
