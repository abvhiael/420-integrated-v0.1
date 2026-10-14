# DOOBR R02.11 — Notifications, outbox, retries, signed callbacks and dead-letter recovery

Canonical R02.11, PR #601, branch `roadmap/doobr-bc-vancouver-infrastructure`. **Pending exact-SHA Level 1 qualification**.

Implementation: `0010_outbox.up.sql` creates tenant-forced-RLS durable `event_outbox` and `event_receipts`, unique tenant/command deduplication, indices, and a tenant-checked SECURITY DEFINER trigger on canonical R02.6 `order_commands`. Every newly committed canonical order command automatically enqueues an event in the SAME database transaction. Rollbacks cannot publish phantom events. Event JSON deliberately holds only order UUID, command UUID, revision and state — no exact GPS, names, IDs, payment data or proof.

`doobr/outbox.py` implements scoped worker `claim` with `FOR UPDATE SKIP LOCKED`, bounded leases, per-attempt fencing, exponential retry, maximum 8 attempts/dead-letter and explicit signed-callback adapter contract with receipt persistence. At-least-once semantics require downstream idempotency using the immutable event ID. Expired leases can be reclaimed, and stale acknowledgements fail. A consumer receiving duplicate delivery must deduplicate.

`test_outbox.py` validates negative arguments. `test_pg_outbox.py` checks real PostgreSQL trigger atomicity, private command publication, competing worker leases, retry scheduling, stale/stolen acknowledgements and delivery receipt uniqueness. Scoped workflow `doobr-r02-11-level1.yml` applies canonical migrations 0001–0010, verifies forced RLS and exact candidate SHA. **Do not treat queued/untriggered CI as qualified.**

Outstanding operational acceptance: real independently approved 420Notifications provider binding, signed callback key/rotation and verification, externally confirmed delivery receipts, tenant operator dead-letter replay authorization, consumer-specific subscription preferences, endpoint retry windows, deployed multiworker load and failover. The interface alone does not establish live integration or user notification. Application reconciliation and full cross-component Level 2 remain R02.13; Level 3 R05.10; real testnet/live dependencies remain R06.

Next canonical R02.12: consult authoritative roadmap before implementation.
