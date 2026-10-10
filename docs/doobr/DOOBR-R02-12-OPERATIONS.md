# DOOBR R02.12 — Audit trails, observability, backup, restore and multi-instance operations

Canonical R02.12, PR #601. Repository implementation **PARTIAL; targeted qualification pending**.

Migration `0011_operations.up.sql` introduces a tenant-isolated, append-only, hash-chained operational audit for canonical order command receipts and an instance heartbeat registry. The command audit is triggered inside the same PostgreSQL transaction; rollback also rolls back audit. The audit contains order UUID, command ID, actor UUID, action and revision-derived digest, not identity proofs, delivery addresses, GPS, signatures, raw tokens or external callback credentials. Modifications to audit rows are prohibited by database trigger. All tables force tenant RLS. A database owner or superuser can still tamper: a separately protected signed/WORM audit export and verification must be accepted before production claims of tamper resistance.

`doobr/operations.py` exposes tenant-scoped heartbeat with monotonic timestamps, fixed role identity and minimal aggregate-only readiness and queue counters. No sensitive payloads are logged or published. It is designed for concurrent app processes using shared PostgreSQL state, but not itself a deployed health endpoint or alerting backend. Outbox multiworker lease tests were retained in R02.11.

Level 1 workflow `doobr-r02-12-level1.yml` compiles affected Python, migrates PostgreSQL 0001–0011, and tests restricted-role heartbeat, tenant separation, stale-instance detection, forced RLS, and audit immutability trigger existence. CI outcome remains unverified until exact SHA success.

**Open R02.12 acceptance gaps:** implement and test backup/restore automation with encrypted storage, PITR/WAL continuity and isolated actual restore; validate restored tenant RLS, command/outbox audit chain and return/custody data; exercise real audit insert chain and reject malicious updates/deletes; verify live dashboard redaction, alert thresholds, key management, instance crash/restart, horizontal capacity and disaster recovery RPO/RTO. These gaps cannot be marked completed by a successful schema-only CI test. Production credentials, external storage and operational recovery acceptance remain future environment-dependent.

Level 2 R02.13, Level 3 R05.10. Do not merge before phase closeout.
