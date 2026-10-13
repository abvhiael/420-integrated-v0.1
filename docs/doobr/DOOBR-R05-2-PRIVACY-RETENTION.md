# DOOBr R05.2 — Privacy, address/GPS exfiltration, retention and deletion conflict testing

Canonical R05.2; Level 1 app-scoped, PR #601 on `roadmap/doobr-bc-vancouver-infrastructure`. Main/base checked `bc0faa5dafecda3de0620a9581f9953b89cd95fb`, branch 379 ahead and 1110 behind before changes. R04.11 Level 2 qualified on its earlier implementation SHA. R05.10 Level 3 awaits main reconciliation.

**Implementation SHA:** `aa52bafe67177bbd154e31b5166f74f391f55f13`. `doobr/privacy_retention.py` adds a strict privacy-safe public projection schema forbidding addresses, GPS, recipient/courier identifiers and arbitrary added fields; public commerce flags are always denied. It adds a canonical-retention-verifier gate that denies deletion when record/subject/tenant binding is wrong, approval missing, legal hold exists, retention period remains active, authorization is revoked, or the retention authority is unavailable. It does **not** erase data: downstream systems must perform authorized, auditable, transactional deletion only after this decision. This adapter must not be used to supersede jurisdictional legal holds or statutory retention.

**Tests:** `doobr/storage/tests/test_r05_2_privacy_retention.py` exercises address/GPS/identity field exfiltration, schema abuse, public checkout escalation, legal hold and contradictory deletion requests, trust mismatch and revocation/outage. `.github/workflows/doobr-r05-2-level1.yml` checks exact SHA, these adversarial tests, Travel/Compliance/mobile privacy regressions and R04.1 frozen gateway. No global Foundry/Genesis/Docs/Integrated inventory invoked.

**Qualification:** CI run/job must be inspected and passed before status COMPLETE. External live retention/deletion service authentication, production encrypted-data lifecycle, retention schedule approvals, verified backups erasure, independent BC/Vancouver legal-source acceptance and production privacy review remain explicitly deferred to DOOBR-AUDIT-9/10 and testnet requirements; DOOBr stays NON-OPERATIONAL.

**Next canonical step:** R05.3 Concurrent assignments, replay, callbacks, failover and chaos cases.
