-- Apply with a separately authenticated migration administrator.
BEGIN;
SELECT pg_advisory_xact_lock(420038);
CREATE TABLE IF NOT EXISTS compliance_publication_fences (
 scope TEXT PRIMARY KEY,
 sequence BIGINT NOT NULL CHECK (sequence > 0),
 revocation_epoch BIGINT NOT NULL CHECK (revocation_epoch > 0),
 policy_digest TEXT NOT NULL CHECK (policy_digest ~ '^[0-9a-f]{64}$'),
 dependency_digest TEXT NOT NULL CHECK (dependency_digest ~ '^[0-9a-f]{64}$'),
 expires_at TIMESTAMPTZ NOT NULL
);
-- Provision compliance_reader / compliance_publisher as NOLOGIN group roles.
-- Login credentials must be provisioned out of band by the database operator.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='compliance_reader') THEN
  CREATE ROLE compliance_reader NOLOGIN;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='compliance_publisher') THEN
  CREATE ROLE compliance_publisher NOLOGIN;
 END IF;
END $$;
REVOKE ALL ON compliance_publication_fences FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO compliance_reader,compliance_publisher;
GRANT SELECT ON compliance_publication_fences TO compliance_reader,compliance_publisher;
GRANT INSERT,UPDATE ON compliance_publication_fences TO compliance_publisher;
COMMIT;
