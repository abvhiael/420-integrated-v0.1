# BNB-4.10 — Disaster Recovery & Operations: fail-closed runbook

Canonical step: [BNB-PHASE4-ROADMAP.md](BNB-PHASE4-ROADMAP.md), BNB-4.10. This runbook describes repository-qualification-safe procedures only. Production managed PostgreSQL backups, backup custody, RTO/RPO, multi-instance failover, approvals and operator signoff remain gated at **T-BNB-OPS-214** and **T-BNB-SECURITY-213**; no live restore is approved.

## Operational sequence

1. **Isolate and classify.** Record the target exact release SHA and deployment image digests separately from credentials. Confirm independent operator authority, protected change ticket, legal/privacy hold constraints, freeze status, and that `travel.bnb_booking=false`, `booking_enabled=false`, and `financial_execution=false`. Never interpret a web dashboard or guest request as recovery authorization.
2. **Quiesce writes.** Stop outbox workers and new booking intake without destroying durable holds, reservations, financial-case receipts, manual moderation or immutable audit history. Run service restart only from pinned image and production secret mounts using the existing non-root release contract.
3. **Verify backup off-host.** On an isolated target using separate migration credentials, inspect backup integrity, provenance, encryption and custody approval; do not connect the restore to production Pay, Wallet or notification providers. Restore a logical copy, validate all 26 migration versions and their SHA-256 checksums with the existing controlled migrator. Reject untracked schema, missing history, address/issuer mismatch and permission escalation.
4. **Reconcile durable outbox.** Query `recovery_operations.assess(... action='restore', approved=True)` with independent operator proof supplied outside the library. A nonzero pending/expired/dead-letter count blocks a clean restore declaration; compare the original and restored outbox event identities, terminal receipts, dead-letter history and consumer checkpoints before any resumption. No data may be auto-acknowledged, deleted or replayed solely to satisfy a dashboard.
5. **Replay explicitly.** Only an independently authorized operator can use the existing `outbox.replay` primitive on an eligible dead-letter event. It emits an audit record, retains immutable event identity, and requires a distinct idempotent consumer receipt. Duplicate delivery after a crash is expected; replays never create Pay authority, booking finality or a second disbursement.
6. **Restart and verify.** Run retained `health/ready` schema and permission checks, verified-TLS PostgreSQL, non-root container and restricted ingress readiness. An expired lease stays fenced by the PostgreSQL outbox claim logic; a competing worker must never acknowledge it. Audit only fixed labels and counts using `recovery_operations.alert_summary`, with no raw token, customer, payment or address content.
7. **Rollback carefully.** Application image rollback to a pinned compatible image requires separately reviewed operator approval and current schema compatibility, not database DDL rollback. `assess(action='rollback')` always denies automatic database rollback. Never undo immutable schema history or financial receipt finality. Forward-fix or isolated restorative migration must have separate authority and a fresh qualification SHA.
8. **Unfreeze and accept externally.** Re-enable only after independent Identity/Pay/Compliance/Travel, legal, accessibility, restore, security, custody and operator gates succeed. No CI fixture proves production RTO, RPO or multi-node failover.

## Deterministic fault injection and test coverage

- Unauthorized restart/restore/replay/rollback fail before database access; enabled live bookings/financial execution forbid unaudited recovery.
- Migration ledger gap or checksum drift is rejected; existing migration tests cover concurrent writers and checksums.
- Expired PostgreSQL lease, pending outbox, dead letter and provider errors cannot be declared fully reconciled; available only as minimized counts.
- Existing retained BNB-4.2 tests cover competing worker reclaim, signed manual replay callback, stale acknowledgment rejection, crashed adapter and poison payload isolation.
- Existing BNB-3.2 runtime suite covers isolated logical backup/restore, non-root pinned container, verified TLS and startup-denial behavior.
- No direct network transport, external payment or wallet execution, production backup custody, runtime job scheduling, or legal approval is enabled by this step.

## Qualification evidence and status

The exact implementation SHA and required terminal CI job/run numbers are recorded separately in the BNB-4.10 Level 1 certificate **only after** successful app-specific terminal qualification. Neither cancelled/pending runs nor skipped global Docs are proof of success. The next milestone is **BNB-4.11 — M4-B end-to-end app milestone**; Level 3 only at BNB-4.12.
