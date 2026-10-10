#!/usr/bin/env bash
set -euo pipefail
: "${GROW_MIGRATION_DATABASE_URL:?set disposable test database}"
export PGCONNECT_TIMEOUT=8
python3 scripts/grow-v2-migrate.py
python3 scripts/grow-v2-migrate.py
psql -X -v ON_ERROR_STOP=1 "$GROW_MIGRATION_DATABASE_URL" -f grow/storage/test/negative.sql
# PostgreSQL service is for CI only. Operator/admin credentials never enter committed source.
psql -X -v ON_ERROR_STOP=1 "$GROW_MIGRATION_DATABASE_URL" <<'SQL'
CREATE ROLE grow_v2_test_runtime NOLOGIN NOBYPASSRLS;
GRANT USAGE ON SCHEMA grow_private TO grow_v2_test_runtime;
GRANT EXECUTE ON FUNCTION grow_private.current_tenant() TO grow_v2_test_runtime;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA grow_private TO grow_v2_test_runtime;
REVOKE ALL ON TABLE grow_private.schema_migrations FROM grow_v2_test_runtime;
INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES
('11111111-1111-4111-8111-111111111111','A','CA-SK'),
('22222222-2222-4222-8222-222222222222','B','CA-SK');
-- Role's tenant setting defaults unset: no readable rows even with SELECT grant.
SET ROLE grow_v2_test_runtime;
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.tenants) != 0 THEN
  RAISE EXCEPTION 'Missing tenant context exposed records';
 END IF;
END $$;
BEGIN;
SET LOCAL grow.tenant_id='11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.tenants) != 1 THEN
  RAISE EXCEPTION 'Tenant A isolation failed';
 END IF;
END $$;
-- INSERT for another tenant must be denied by RLS even with INSERT grant.
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES
  ('33333333-3333-4333-8333-333333333333','Forbidden','CA-SK');
  RAISE EXCEPTION 'cross-tenant INSERT incorrectly allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
COMMIT;
BEGIN;
SET LOCAL grow.tenant_id='22222222-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.tenants) != 1 THEN
  RAISE EXCEPTION 'Tenant B isolation failed';
 END IF;
END $$;
COMMIT;
RESET ROLE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='grow_v2_test_runtime' AND (rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'runtime role bypasses RLS';
 END IF;
END $$;
SQL
echo 'GROW-V2-03 PostgreSQL migration, replay, composite FK and RLS: PASS'
