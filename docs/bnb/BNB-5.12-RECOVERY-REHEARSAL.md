# BNB-5.12 — isolated multi-instance deployment and recovery rehearsal

**Scope:** repository-controlled isolated CI only. No independent permission for production recovery, public delivery, payments or external provider activation.

## Preconditions / evidence to record

1. Record candidate executable SHA, current `main` and PR #644 divergence. Preserve app Level 1 ownership; BNB-5.13 and BNB-5.14 are separate milestones.
2. Run verified-TLS PostgreSQL fixture with controlled ordered migration ledger versions **1–30** and least-privilege runtime DB roles. Check startup/ready semantics before any application instance starts. Refuse ledger drift, missing privileges, bad TLS CA, hostname mismatch or secret permissions.
3. Use two separately instantiated API clients and two worker supervisors on the **same** PostgreSQL database. Keep financial execution, live booking and provider delivery **disabled**.
4. Simulate concurrent claims (one durable receipt per event), worker interruption after durable sink acceptance but before local acknowledgement, expired lease takeover, repeated crash/attempt exhaustion to dead letter, and restart from a **fresh database connection**. Retained `test_bnb52_worker.py` includes an actual process crash and SIGTERM coverage; `test_bnb512_multi_instance.py` composes the shared-state failure sequence.
5. Validate fail-closed reconciliation: `recovery_operations.assess(action="restore", approved=True)` rejects pending/dead-letter work, and `action="rollback"` always rejects destructive database migration rollback. No automatic destructive restore. Never redrive without independently authorized, auditable event-specific authority.
6. Verify migration compatibility during interrupted rollout using retained `test_bnb32_infrastructure.py` controlled-migration repeatability and concurrent migrator cases; no simultaneous uncontrolled schema mutation by API/worker processes. Shut down one instance, confirm surviving instance can finish in-flight work; recover the replaced instance without duplicate acceptance.
7. Run app-owned `420BnB Runtime Slice` and the applicable BnB retained guardrails against **one exact executable SHA**. Record real run/job IDs, terminal job results, test counts, artifacts and exceptions. A queued run, expected denial, skipped global Docs, or synthetic local credential is not independent production acceptance.

## Reproducible CI execution

`pytest -q services/420bnb/tests/test_bnb512_multi_instance.py services/420bnb/tests/test_bnb52_worker.py services/420bnb/tests/test_bnb410_recovery.py services/420bnb/tests/test_bnb32_infrastructure.py`

Use the existing GitHub `.github/workflows/bnb-runtime.yml` for verified-TLS PostgreSQL, environment restrictions, static deployment topology and retained full BnB regression inventory; do not bypass that workflow with a local-only mock. Record exact SHA from the actual runner output.

## Negative scenarios and authority boundaries

- Race / lease loss: competing worker cannot double-consume or revive an expired lease.
- Crash / restart: accepted durable receipts survive restart, delivery is idempotent.
- Exhaustion: no unlimited retry; dead-letter blocks automatic restore.
- Migration drift: incompatible schema is rejected rather than auto-repaired by runtime.
- Interrupted rollout: one instance can fail while another continues with independent DB connection; no loss of completed operations.
- Cross-account and consumer authority: existing BNB-5.6/5.9 tests remain enabled; never weaken them.
- Operator action: a readiness/assessment response never authorizes destructive rollback or settlement.
- Data minimization: event bodies, private addresses, issuer secrets and financial fields are never included in aggregate health/incident evidence.

## Separate external acceptance

Production-equivalent multi-host failover, external identity/operator approvals, live Search/Travel and Pay/Wallet transport, independently approved backup/restore infrastructure, region/Jurisdiction and alert delivery are **external/testnet gates**; record only actual independent evidence when available. Keep `booking_enabled=false`, `travel.bnb_booking=false` and `financial_execution=false`.

**Milestone:** BNB-5.12 is ordinary Level 1. BNB-5.13 is the M5-B accumulated Level 2 milestone and BNB-5.14 the comprehensive current-main-reconciled Level 3 phase closeout.
