# GROW-V2-03 — Persistent storage, schemas and migrations

**Implementation state:** PostgreSQL 15+ schema and one-way migration are implemented; exact-SHA Level 1 CI completion must be verified separately. This is an **app-only datastore**, not a Genesis service or on-chain store.

## Architecture decision
- PostgreSQL owns canonical private operational records; `grow_private` schema is invisible to the existing read-only `/v1/grow/places` directory. The V2 private API is not yet exposed or authenticated; database login and deployment secrets are operator-provisioned rather than committed.
- Every tenant-owned table includes a tenant ID, mandatory private visibility for tenants, tenant-keyed primary keys or uniqueness, composite foreign keys for nested resources, and **FORCE ROW LEVEL SECURITY** with transaction-scoped `SET LOCAL grow.tenant_id`. No runtime login may own tables, have `BYPASSRLS`, or access `schema_migrations`. Missing tenant context must return zero accessible rows. Privileged migration owner separate from runtime.
- Schema: tenants, memberships, facilities, zones, plants, lineage edges, observations, inventory lots/movements, harvests, consents, export jobs, audit events and migration ledger. UUID opaque IDs; server timestamps in UTC-compatible `timestamptz`, revisions and nonnegative quantities; idempotency uniqueness for stock events; lineage self-parent prohibited. General lineage graph cycle protection is a V2-05 domain-service responsibility.
- Foreign key links cannot cross tenant boundaries, including facility/zone, plant, lineage parent, lot and harvest references. Tenant-scoped indexes cover time and operational reads. Numeric measurement/unit validation beyond basic SQL types is a later domain requirement, not proof of device accuracy.
- Schema migration `0001_initial.up.sql` is atomic, guarded by advisory transaction lock, and recorded with SHA-256 checksum in private migration ledger. Operator must back up database, inspect migration/digest, run in staging, and verify after change. No blind destructive rollback. Corrective migrations must be forward-only; recovery is restore from verified backup/PITR under approved incident process.
- Runtime transactions must begin with verified authenticated membership in `grow/security`, select an active tenant, issue `SET LOCAL grow.tenant_id = <approved UUID>` on the same database transaction, and then use parameterized tenant-keyed queries. Database RLS is secondary defence in depth, not replacement for server-side subject-role authorization. Connection pool state must never carry tenant state across requests; transaction reset/rollback required on error.
- Least privilege: migration role owns DDL; provisioning operator grants runtime `USAGE` on schema and `EXECUTE` on `grow_private.current_tenant()`, and only necessary table SELECT/INSERT/UPDATE privileges, never DELETE for immutable event tables. A future migration should specify fine-grained per-operation grants. Security-definer functions forbidden by default, no bypass policy, no public schema exposure or external direct DB access.
- App auditing is append-only by operational policy: deny runtime UPDATE/DELETE on `audit_events` and `inventory_movements`; corrections are separate compensating events with attribution, validated against nonnegative lot balance in future transactional service code. Schema's `CHECK(balance>=0)` protects persisted balance but does not itself guarantee event-to-balance consistency.
- Security baseline: encrypted connections/at-rest volumes, secrets outside git, minimum retention and purpose, logical backup + restore and PITR drills, index rebuild against stored source data, explicit deleted/retained policy, no logging of addresses or photos. These are deployment prerequisites and not qualified in this repository-only step.
- No actual live database, user account, API, sensor, AI job, device control or compliant seed-to-sale export is represented as operational.

## Required Level 1 evidence
1. Execute migration against disposable PostgreSQL (not SQLite) and verify schema is created without errors; run migration twice and check checksum idempotence; mismatched checksum must be rejected.
2. Create two tenants and prove composite foreign keys reject cross-tenant references.
3. Run SELECT and INSERT under separate non-owner runtime DB role, with unset tenant and each tenant scope; prove RLS blocks cross-tenant read/write. Confirm runtime is not BYPASSRLS/owner.
4. Verify no cross-tenant composite relationship or orphan zone scope, negative balance check, immutability privilege restriction and no unapproved data access.
5. Python migration/verifier syntax; retained `420grow-v2-fast.yml` role/race/static checks and original `420grow-fast.yml` affected regression.
6. Evidence exact candidate SHA; Level 2 at V2-05 and repository-wide Level 3 at V2-15, neither rerun here.

## Data migration and restore operations
- Preflight with operator-supplied `GROW_MIGRATION_DATABASE_URL`, approved maintenance scope, required PostgreSQL major version, backups, target identity and expected hash.
- Apply using `python3 scripts/grow-v2-migrate.py` with psql installed. Abort on any error; checksum drift is an explicit failure.
- Release: provision separate non-owner runtime login, grant schema usage and selected object privileges, `EXECUTE` on current tenant function, revoke all public access. Authenticate user at API boundary, never accept tenant from client without checked membership.
- Rollback: stop writes, restore verified physical/PITR snapshot in isolated target, reconcile migrations and event/custody state, requalify before traffic; **no automatic DROP TABLE down migration**.

**Next canonical step:** GROW-V2-04 — Facility, room and zone management.
