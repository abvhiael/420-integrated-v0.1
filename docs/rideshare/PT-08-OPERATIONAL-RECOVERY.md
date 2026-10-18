# LIFTd PT-08 — Operational recovery readiness

**Objective:** Prepare/test local backup/restore, fenced durable jobs, incident escalation, controlled rollback, audit integrity, and failure-safe restoration by reusing the qualified L03.6–L03.8 inventory, without reenacting independent production acceptance.

## Reused tested machinery
- L03.6 `deployment-security.mjs` readiness, exact release pinning and loopback-disabled admitted gateway.
- L03.7 `reliability.mjs` PostgreSQL durable recovery queue, lease tokens, bounded retries, dead letter, provider guard and allowlisted worker; `scripts/test-backup-restore.sh` real isolated `pg_dump`/`pg_restore`, migration checksums, seeded-data comparison.
- L03.8 `operational-safety.mjs` staffed 3-role coverage / escalation and existing `safe-gates-execution.mjs` independent safety workflows.

## New integration
`operational-recovery.mjs` composes the retained queue worker and safety roster, requires confirmed pause then independently receipted escalation and append-only audit, verifies source/restored release/migration/data/audit/hold digests before controlled dual-person rollback, checks revision fencing and returns traffic disabled. No HTTP endpoint, public dispatch enablement, or production authority is introduced.

## Qualification
Scoped PT-08 Level 1: retained LIFTd unit and security regression suite, real PostgreSQL L03.7 queue tests and actual qualified-database dump/restore drill; negative tests cover corruption, incompatible release, missing custody/hold evidence, unaudited stop/rollback, stale revision and denied self-approval. CI exact SHA required.

## External NOT ACCEPTED
Current TN-0–TN-6 still requires independent infrastructure owner, provisioned scheduler/recovery service, encrypted managed backups/PITR, deployed multi-node fencing, IAM and signed incident authority, time-bound RTO/RPO, real service rollback, evidence-preserving restore of private vault/data/logs, privacy/legal acceptance, external negative drills and signed production release. Local database does not demonstrate independent live disaster-recovery qualification. Original L03.8–L03.11 statuses unchanged.
