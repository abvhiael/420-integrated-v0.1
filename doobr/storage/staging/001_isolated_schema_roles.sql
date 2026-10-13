-- DOOBr staging role isolation on SHARED 420Travel PostgreSQL instance.
-- ADMINISTRATOR REVIEW ONLY. Not automatically applied. Run as approved DB admin.
-- All object ownership and grants limited to dedicated doobr_staging schema.
-- Never modify 420Travel schemas/roles, public search_path or database-wide privileges.
BEGIN;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='doobr_staging') THEN
  RAISE EXCEPTION 'doobr_staging already exists: manual inventory required before any change';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('doobr_staging_owner','doobr_staging_migrator','doobr_staging_runtime','doobr_staging_readonly')) THEN
  RAISE EXCEPTION 'DOOBr staging roles already present: reconcile before setup';
 END IF;
END $$;
CREATE ROLE doobr_staging_owner NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE doobr_staging_migrator NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE doobr_staging_runtime NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE doobr_staging_readonly NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE SCHEMA doobr_staging AUTHORIZATION doobr_staging_owner;
REVOKE ALL ON SCHEMA doobr_staging FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA doobr_staging TO doobr_staging_migrator;
GRANT USAGE ON SCHEMA doobr_staging TO doobr_staging_runtime,doobr_staging_readonly;
-- Objects created by migrator default to no public privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE doobr_staging_migrator IN SCHEMA doobr_staging
 REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE doobr_staging_migrator IN SCHEMA doobr_staging
 REVOKE ALL ON SEQUENCES FROM PUBLIC;
-- Explicit migration promotion grants will be audited after each migration.
-- No LOGIN members or passwords are created. A separate secret-provisioning
-- operation must grant these group roles to independently approved DB users.
COMMIT;
