# BNB-6.10 — Recovery and disaster-readiness rehearsal

Canonical requirement: isolated multi-instance failure, backup/restore, interrupted rollout, consumer recovery, rollback and measured objectives.

## Rehearsal controls and evidence
- `recovery_rehearsal.py` defines strict bounded measurable results for the five scenario classes, including RTO elapsed time, committed-event RPO, pending delivery reconciliation, PostgreSQL schema 30, replica recovery and independent operator authorization. Failed or missing evidence is never counted as a rehearsal pass. A fixture result explicitly does not grant live recovery authority.
- `tests/test_bnb610_rehearsal.py` exercises all five scenario types with adversarial objective failures and independent PostgreSQL reconnect/ledger checks; these are controlled simulated failure inputs, not a live regional failover.
- `bnb-runtime.yml` already performs a real isolated PostgreSQL dump/restore into a separate database and verifies schema content. BNB-4.10 recovery tests exercise expired leases, pending/outbox recovery and forbidden replay/rollback. BNB-6.4 asserts migration ledger integrity and interrupted-upgrade fail-closed behavior. Retained deployment/consumer tests cover dual-API/worker topology and Search/Travel synchronization evidence.
- The **RTO target** for this repository rehearsal is 300000 ms (five minutes); **RPO target** is zero committed events. These are test-policy thresholds, **not measured production service-level objectives**.

## Approved disaster-recovery playbook
1. **Declare incident and freeze promotion:** identify qualified release SHA, exact registry digests, operations personnel and two independent API instances; block booking, Pay execution and Travel booking.
2. **Isolate faults:** use separate database identities and network paths for each fault domain. Suspend one instance at a time; verify remaining instance readiness without treating process liveness alone as readiness; record time-to-recover against monotonic clock.
3. **Backup/restore:** capture immutable backup with auditable checksum, restore to separately isolated PostgreSQL and verify all 30 migration records plus row-level conservation/replay/revocation inventories. Never point live traffic to an unchecked restore.
4. **Interrupted rollout:** refuse binary promotion on unknown backward compatibility or partial migration ledger; recover only through authorized forward-only migrator, with no automatic database down-migration.
5. **Consumers:** verify real signed Search/Travel acknowledgments, completed outbox delivery and dead-letter reconciliation. Resume only after independent consumer catch-up and no duplicate event consumption.
6. **Rollback:** preserve prior image digest; require independent operator authority and proven schema compatibility for binary rollback, or independently approved verified backup recovery. Do not auto-restore or rewrite the ledger.
7. **Close and measure:** archive timestamped RTO/RPO, schema and delivery proofs, exact SHA, scoped operator approvals, lost-event count and blocked actions; fail the drill if evidence is missing or objectives were breached.

Real multi-zone/multi-instance failure injection, actual production backup/restore, provider transport recovery, independent on-call authorization, authenticated telemetry and a measured live RTO/RPO report remain testnet/production acceptance gates under `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. **No fixture grants production approval.**
