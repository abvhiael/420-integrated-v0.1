# DOOBr R03.9 — Isolated shared-Postgres staging design

**Target Render workspace:** reefer review (`tea-db3riuei0phs73baf850`)
**Existing database instance:** 420travel-staging-postgres (`dpg-db4j78k9v7es738ajh8g-a`, PostgreSQL 16, Oregon).
**Status:** Designed and committed; NOT APPLIED. Existing 420Travel resources remain unchanged.

## Isolation decision
Use a new `doobr_staging` schema, never `doobr_private`, `public` or any existing 420Travel schema. The staging replay ledger now accepts an explicit allowlisted `schema="doobr_staging"` argument; other names fail closed. Keep the canonical `doobr_private` default for unaffected existing deployment paths.

Review-only SQL:
1. `doobr/storage/staging/001_isolated_schema_roles.sql`: aborts on existing schema/role names; creates four NOLOGIN NOBYPASSRLS group roles, a dedicated schema, no default public grants and no database-wide role/schema changes.
2. `doobr/storage/staging/002_replay_receipts.sql`: create the `doobr_staging.mobile_replay_receipts` journal, FORCE ROW LEVEL SECURITY and per-tenant policy, grant only SELECT/INSERT to runtime and SELECT to readonly. Run solely with the isolated staging migrator and owner-approved grants.

The two SQL files are intentionally not applied automatically. They require a qualified administrator to inventory live ownership, role membership, table access and available privileges before execution. DO NOT grant the application login the schema owner/migrator role or BYPASSRLS; DO NOT reuse 420Travel credentials. Set `search_path` explicitly or continue with qualified table names; tenant GUC is set with `set_config(...,true)` within each transaction.

## Controlled runbook
1. Take a verified PostgreSQL backup/snapshot and inspect the existing roles/schemas and free-tier backup/restore limitations. Record database ID, before-state privileges and migration candidate SHA.
2. Establish independent secret-managed LOGIN principals for setup/migration and runtime outside git. Review privilege and role inheritance; do not rotate or alter 420Travel credentials.
3. In an approved administrative session, apply file 001, confirm all new objects reside in `doobr_staging`; as an isolated migration role, apply 002. Test an unprivileged runtime insert+read under its own tenant and a cross-tenant denial. Verify inability to list/read/write 420Travel business data. Verify schema owner and runtime have no privilege to modify public/420Travel schemas.
4. Restart staging using a *private* TLS/authenticated service and the runtime credential, with no device or issuer secrets in client assets. Exercise duplicate inserts across restarts, backup recovery, migration rollback via explicit change management, operator revoke and database outage. Do not drop shared database or run destructive whole-cluster rollback.
5. Release only with exact-SHA passing R03.9, verified constrained ingress/JWT/device trust, provider acceptance, monitoring and explicit signoff. Keep regulated DOOBr operations disabled.

## Rollback
If **and only if** the DOOBr staging schema was newly created and has no externally owned objects, stop DOOBr staging traffic, preserve redacted audit evidence and backup, revoke DOOBr runtime access and execute a separately approved `DROP SCHEMA doobr_staging CASCADE` scoped exclusively to the newly created schema. Never drop database, `public`, `doobr_private`, Travel schemas, shared roles or global extensions. Database-wide restoration is inappropriate on a shared instance without a 420Travel change window.

## Limitations
Render's database inspection API could not connect because the existing database has an empty external IP allowlist. This isolation boundary was deliberately preserved. There was no SQL execution or live privilege validation; DOOBr staging remains **unprovisioned inside the existing database** until approved administrator access is available. Only repository-side design/code/CI changes are presently eligible for qualification. Physical-device reconnect acceptance remains deferred to the testnet acceptance register.

## Deferred acceptance transfer (2026-10-12)
The outstanding actual private HTTPS deployment, shared Render PostgreSQL live access/migration and role isolation, independently authenticated identity and device service, live backup/restart/rollback evidence, and physical-device reconnect acceptance are registered as **NOT COMPLETE** under **R03.9 — Live staging, canonical identity/device and reconnect acceptance** in `docs/audit/DOOBR-TESTNET-DEFERRED-QUALIFICATION-ROADMAP.md`. This is an acceptance handoff only; it neither authorizes regulated operations nor excuses offline-reproducible code/security deficiencies. Prior R03.9 Level 1 PASS belongs to implementation SHA `c80f67941b602cd67681de4e9825c87b23345442`, workflow #38280438309. No changes were applied to the Render database.
