# BNB-6.4 — Database lifecycle and migration safety

Canonical requirements: forward-only migrations, rolling deployment compatibility, restore/replay, migration locking, retention, and interrupted-upgrade recovery.

## Qualified inheritance and gaps
- `migrate.py` already executes numbered SHA-256 migration files under one PostgreSQL advisory **transaction** lock, with all DDL and ledger writes inside a transaction. No automatic down migration exists.
- Existing BNB-2.14 tests prove repeated invocation, concurrent writers, tamper denial and no half-committed outbox events; BNB Runtime CI uses PostgreSQL 16, exercises the 30-step ledger and a logical backup/restore clone.
- `recovery_operations.py` blocks unapproved restore/replay, disallows automatic DB rollback and guards pending/expired delivery; actual operator approval remains external.
- Added `migration_lifecycle.py` for exact migration ledger replay checks and controlled safety **assessments** for rolling compatibility, retention proof and interrupted upgrade; `tests/test_bnb64_lifecycle.py` adds adversarial and real PostgreSQL evidence.
- Compatibility is **fail closed**: no previous binary is asserted compatible with schema 30 merely because migrations are forward-only. A future proven overlap requires an explicit schema/build compatibility authority. New upgrade execution is not permitted by this assessment.
- Retention remains **disabled**, including with approval and backup proof. No irreversible delete is performed and no unsafe unverified time-based retention period is invented.
- A partial upgrade ledger or unknown migration digest requires operator reconciliation; no automatic repair, backfill, rollback, or replay authorization is synthesized.

All actual production backup custody, immutable restore proof, rolling replica deployments, provider acceptance, and independent disaster recovery remain at `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. Release restrictions remain `booking_enabled=false`, `travel.bnb_booking=false`, `financial_execution=false`.

BNB-6.4 Level 1 evidence should cite the original exact implementation SHA and real CI job results once complete; Phase 6 Level 2 occurs at 6.6/6.11 and Level 3 at 6.12. Keep PR #667 draft and unmerged.
