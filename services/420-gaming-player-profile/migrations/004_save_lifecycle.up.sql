-- SPDX-License-Identifier: GPL-3.0
-- R05.5 durable save lifecycle metadata. No raw cloud-save payloads are stored in PostgreSQL.
CREATE TABLE gaming_datastore.save_lifecycle_schema(version integer PRIMARY KEY CHECK(version=5),digest text NOT NULL);
CREATE TABLE gaming_datastore.save_backups(
 account_id gaming_datastore.opaque_id NOT NULL,game_id gaming_datastore.commitment NOT NULL,backup_id gaming_datastore.opaque_id NOT NULL,
 source_revision gaming_datastore.uint64 NOT NULL,
 provider_id text NOT NULL,object_ref text NOT NULL,
 state_hash text NOT NULL,byte_length gaming_datastore.uint64 NOT NULL,
 schema_label text NOT NULL,created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
 expires_at gaming_datastore.uint64 NOT NULL,
 deleted_at gaming_datastore.uint64,
 PRIMARY KEY(account_id,game_id,backup_id),
 FOREIGN KEY(account_id,game_id,source_revision) REFERENCES gaming_datastore.save_references(account_id,game_id,revision),
 CHECK(backup_id ~ '^[A-Za-z0-9:_-]{1,128}$'),
 CHECK(provider_id ~ '^[A-Za-z0-9:_-]{1,128}$'),
 CHECK(object_ref ~ '^[A-Za-z0-9:_-]{1,128}$'),
 CHECK(state_hash ~ '^0x[0-9a-f]{64}$'),
 CHECK(byte_length<=67108864),
 CHECK(expires_at>created_at)
);
CREATE TABLE gaming_datastore.save_redactions(
 account_id gaming_datastore.opaque_id NOT NULL,game_id gaming_datastore.commitment NOT NULL,
 revision gaming_datastore.uint64 NOT NULL, reason text NOT NULL CHECK(reason IN ('RETENTION','USER_DELETE','CONSENT_REVOKED')),
 deleted_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
 PRIMARY KEY(account_id,game_id,revision),
 FOREIGN KEY(account_id,game_id,revision) REFERENCES gaming_datastore.save_references(account_id,game_id,revision)
);
CREATE TABLE gaming_datastore.save_deletion_jobs(
 account_id gaming_datastore.opaque_id NOT NULL,game_id gaming_datastore.commitment NOT NULL,job_id gaming_datastore.opaque_id NOT NULL,
 object_ref text NOT NULL,provider_id text NOT NULL,
 reason text NOT NULL CHECK(reason IN ('RETENTION','USER_DELETE','CONSENT_REVOKED')),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','LEASED','DONE','RETRY','DEAD_LETTER')),
 lease_token text,lease_until gaming_datastore.uint64,attempts integer NOT NULL DEFAULT 0 CHECK(attempts<=30),
 created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
 completed_at gaming_datastore.uint64,
 PRIMARY KEY(account_id,game_id,job_id),
 UNIQUE(account_id,game_id,provider_id,object_ref),
 CHECK(job_id ~ '^[A-Za-z0-9:_-]{1,128}$')
);
ALTER TABLE gaming_datastore.save_redactions OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.save_backups OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.save_deletion_jobs OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.save_lifecycle_schema OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.save_redactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.save_redactions FORCE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.save_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.save_backups FORCE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.save_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.save_deletion_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY redaction_scope ON gaming_datastore.save_redactions FOR SELECT
 USING (current_user='gaming_datastore_migrator' OR EXISTS(SELECT 1 FROM gaming_datastore.runtime_scopes s WHERE s.role_name=current_user
 AND s.account_id=save_redactions.account_id AND s.game_id=save_redactions.game_id));
CREATE POLICY redaction_migrator_mutation ON gaming_datastore.save_redactions FOR ALL
 USING (current_user='gaming_datastore_migrator') WITH CHECK(current_user='gaming_datastore_migrator');
CREATE POLICY backup_scope ON gaming_datastore.save_backups
 FOR SELECT USING (current_user='gaming_datastore_migrator' OR EXISTS(SELECT 1 FROM gaming_datastore.runtime_scopes s WHERE s.role_name=current_user
 AND s.account_id=save_backups.account_id AND s.game_id=save_backups.game_id));
CREATE POLICY backup_migrator_mutation ON gaming_datastore.save_backups FOR ALL
 USING (current_user='gaming_datastore_migrator') WITH CHECK(current_user='gaming_datastore_migrator');
CREATE POLICY r055_hide_deleted_backups ON gaming_datastore.save_backups
 AS RESTRICTIVE FOR SELECT USING(current_user='gaming_datastore_migrator' OR (deleted_at IS NULL AND expires_at>gaming_datastore.now_seconds()));
CREATE POLICY deletion_scope ON gaming_datastore.save_deletion_jobs
 FOR SELECT USING (current_user='gaming_datastore_migrator' OR EXISTS(SELECT 1 FROM gaming_datastore.runtime_scopes s WHERE s.role_name=current_user
 AND s.account_id=save_deletion_jobs.account_id AND s.game_id=save_deletion_jobs.game_id));
CREATE POLICY deletion_migrator_mutation ON gaming_datastore.save_deletion_jobs FOR ALL
 USING (current_user='gaming_datastore_migrator') WITH CHECK(current_user='gaming_datastore_migrator');
GRANT SELECT ON gaming_datastore.save_backups,gaming_datastore.save_redactions TO gaming_datastore_runtime;
GRANT SELECT,INSERT,UPDATE ON gaming_datastore.save_backups,gaming_datastore.save_deletion_jobs,gaming_datastore.save_redactions TO gaming_datastore_migrator;

-- A restrictive policy intersects every existing R05.1 permissive scoped policy.
-- Runtime DB roles cannot recover a redacted provider locator through direct SQL.
-- Trusted R05.3/R05.5 migrator retain immutable audit/reference access.
CREATE POLICY r055_hide_redacted_save_references ON gaming_datastore.save_references
 AS RESTRICTIVE FOR SELECT
 USING (current_user='gaming_datastore_migrator' OR NOT EXISTS(
   SELECT 1 FROM gaming_datastore.save_redactions d
   WHERE d.account_id=save_references.account_id
     AND d.game_id=save_references.game_id
     AND d.revision=save_references.revision
 ));
