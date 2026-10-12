-- Run only by the approved administrator of a DEDICATED BnB database.
-- No passwords/keys are stored here. Provision SCRAM credentials separately.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bnb_owner') THEN
    CREATE ROLE bnb_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bnb_migrator') THEN
    CREATE ROLE bnb_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='bnb_runtime') THEN
    CREATE ROLE bnb_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT bnb_owner TO bnb_migrator;
REVOKE bnb_owner FROM bnb_runtime;
ALTER SCHEMA public OWNER TO bnb_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO bnb_runtime, bnb_migrator;
DO $$ BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO bnb_runtime, bnb_migrator', current_database());
  EXECUTE format('GRANT CREATE ON DATABASE %I TO bnb_owner', current_database());
END $$;
-- Runtime DML is granted atomically by controlled_migration after ledger validation.
-- No blanket future-table write grant: the migration ledger must remain read-only.
ALTER DEFAULT PRIVILEGES FOR ROLE bnb_owner IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE bnb_owner IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
COMMIT;
