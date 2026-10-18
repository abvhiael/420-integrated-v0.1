# LIFTd PT-08 — Durable Level 1 operational recovery qualification

**Disposition:** repository-side scoped **PASS**. Official deployed/testnet recovery and independent operational acceptance **NOT ACCEPTED**.

- **Definition:** Prepare and test local backup/restore, durable recovery jobs, incident escalation, controlled rollback, audit integrity and failure-safe restoration by reusing L03.6–L03.8.
- **Exact qualified implementation SHA:** `1ff869c961b59b9c000003dc35411b02473cdf15`.
- **Reconciliation base SHA:** `70b7bdf9c79b8a2952679200a72af0c8c854c242` (main when branch created).
- **PR:** [#721](https://github.com/abvhiael/420-integrated-v0.1/pull/721); branch `audit/liftd-pt08-operational-recovery-20261018`.
- **Qualification owner:** [LIFTd PT-08 Level 1 run #39094407483](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39094407483), job `117577741932`, **SUCCESS**. The implementation passed scoped app tests and actual isolated PostgreSQL dump/restore.
- **App tests:** **143 PASS / 0 FAIL** retained and PT-08 unit/security tests.
- **PostgreSQL recovery integration:** **4 PASS / 0 FAIL**, including lease/reclaim/fencing and restricted privileges.
- **Actual database restore:** `rideshare/scripts/test-backup-restore.sh` output `LIFTD_BACKUP_RESTORE_ISOLATED_PASS`. Verified seeded job roundtrip and migration checksum agreement, then migrated restored database.
- **Security:** dual-person rollback precondition, exact 40-character release SHA, 64-hex image/migration/data/audit/hold digests, stale revision rejection, unchanged held evidence, rollback receipt, paused/disabled traffic, confirmed escalation/audit, allowlisted durable worker. Negative tests include corruption and missing audit/recovery authority.
- **Files:** `rideshare/src/operational-recovery.mjs`, `rideshare/test/operational-recovery.test.mjs`, `.github/workflows/liftd-pt08-level1.yml`, `docs/rideshare/PT-08-OPERATIONAL-RECOVERY.md`.
- **Existing dependencies reused without modifications:** L03.6 admitted runtime/security, L03.7 `reliability.mjs` and PostgreSQL backup/restore, L03.8 operator safety and escalation.
- **Failure triage:** first run #39094349725 failed 2 unit assertions because the implementation incorrectly validated a Git SHA as a 64-character digest. Corrected only release SHA format; 64-hex integrity digests remain mandatory. Final run #39094407483 qualified the corrected exact SHA. Earlier failed run is not reused as PASS.
- **Test ownership:** scoped Level 1 app + directly affected PostgreSQL and restore drills. No global Foundry/Genesis/Integrated/Geth/Docs suites initiated; no Level 2/3 closeout.
- **Known boundary:** local proof comparison and injected adapter contracts do **not** demonstrate deployed PITR, independent signed operator permissions, completed real backup/restore RTO/RPO, encrypted vault restoration, durable external audit sink, production recovery process or acceptance of passenger transport. The original TN-0–TN-6 production/deployed obligations remain **NOT ACCEPTED**.
- **Merge:** pending explicit user authority and current-main compatibility check. Exact-SHA evidence must survive merger.
- **Next step:** retain canonical L03.8 → L03.9 → L03.10 → M-L03-B → L03.11 → L03.12; PT series does not renumber them.

This document is evidence-only and does not change the qualified implementation, workflow or test inputs.
