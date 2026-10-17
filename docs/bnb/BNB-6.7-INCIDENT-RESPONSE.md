# BNB-6.7 — Operational observability and incident response

Canonical scope: bounded redacted logs, metrics, tracing and alerts; honest health/readiness, incident procedures, and tests against misleading healthy responses or private-data exposure.

## Repository implementation

- `api.py` retains process liveness separate from PostgreSQL/schema readiness: database outage or ledger mismatch is 503, and never reported as a transactional-ready service.
- `synchronization_monitor.py` computes aggregate Search/Travel acknowledgments, projection lag, dead letters and age from database clock; absent or stale consumers are not healthy. `operational_controls.py` requires scoped operator authority for recovery assessments, dead-letter inspection and replay.
- `incident_signals.py` adds a deterministic bounded incident summary and safe structured events. It requires verified healthy signals for database, schema, discovery, issuer/provider and audit pipeline; stale/missing acknowledgments, backlog and dead letters fail readiness. Output only exposes enumerated alerts, aggregate integer counts and bounded latency/trace identifiers; no payload, authorization header, raw exception, DSN or user identifier.
- `tests/test_bnb67_incident_signals.py` covers missing/stale dependencies, incident persistence across restart simulation, bounded input types, invalid values and secret-label rejection.

## Incident procedures (operator-controlled, not automatic)

1. **Detect and scope:** compare `/health/live` with `/health/ready`, delivery synchronization snapshot and aggregate incident signals. Process liveness is not readiness. Do not mark production approved from an application ping.
2. **Contain:** keep booking, Travel booking, Pay execution and outbound acceptance disabled. For missing database/schema or provider authorization, stop promotion; for stale consumers or backlog, halt dependent publication and preserve event/ledger state.
3. **Escalate:** contact authorized on-call owner for database, independent issuer/Pay authority or Search/Travel delivery as appropriate. Use only fixed-label telemetry and sanitized request IDs, never full bearer tokens, payment details, private addresses or DSNs.
4. **Recover conservatively:** require independently authorized operator session and approval. Use read-only operator reconciliation and existing `recovery_operations.py` assessments. Do not truncate queues, rewrite ledgers, delete backups, replay events or rollback databases automatically.
5. **Verify and close:** verify exact schema ledger, fresh independent Search/Travel acknowledgments, zero unresolved delivery errors, operator audit trail and restored genuine authority. Archive redacted evidence with incident timeline and exact release SHA. Retest before any release promotion; external authorization remains separate.

Production monitoring backend, authenticated alert delivery, on-call organization, incident drills and independent signoff require approved deployment and remain governed by `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. These are external acceptance gates, not locally simulated proof.
