\set ON_ERROR_STOP on
-- Execute as migration owner. Create unprivileged app principal to prove FORCE RLS.
CREATE ROLE doobr_test_app LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
GRANT USAGE ON SCHEMA doobr_private TO doobr_test_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA doobr_private TO doobr_test_app;
INSERT INTO doobr_private.tenants(tenant_id,label) VALUES
 ('00000000-0000-4000-8000-000000000001','Tenant A'),
 ('00000000-0000-4000-8000-000000000002','Tenant B');
-- In app role, absent tenant context can see nothing and cannot insert.
SET ROLE doobr_test_app;
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.tenants) <> 0 THEN RAISE EXCEPTION 'Missing tenant context leaked rows'; END IF;
END $$;
BEGIN;
SET LOCAL doobr.tenant_id = '00000000-0000-4000-8000-000000000001';
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.tenants) <> 1 THEN RAISE EXCEPTION 'Tenant A view incorrect'; END IF;
END $$;
INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind) VALUES
 ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000010','issuer:user-a','CONSUMER');
DO $$
BEGIN
 BEGIN
  INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind) VALUES
  ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000020','issuer:user-b','CONSUMER');
  RAISE EXCEPTION 'Cross tenant insert unexpectedly allowed';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
COMMIT;
BEGIN;
SET LOCAL doobr.tenant_id = '00000000-0000-4000-8000-000000000002';
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.actors)<>0 THEN RAISE EXCEPTION 'Cross tenant actor leaked'; END IF;
END $$;
COMMIT;
RESET ROLE;
-- Introspect every tenant table: RLS + FORCE, all private columns ciphertext rather than plaintext.
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='doobr_private' AND c.relkind='r'
 AND c.relname NOT IN ('schema_migrations') AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n <> 8 THEN RAISE EXCEPTION 'Expected 8 FORCE RLS business tables; got %',n; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='postgis') THEN RAISE EXCEPTION 'Missing PostGIS'; END IF;
END $$;
DROP ROLE doobr_test_app;
