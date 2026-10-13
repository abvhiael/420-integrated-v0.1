-- Staging-only replay receipt migration. Requires reviewed 001 setup.
-- No changes to 420Travel objects, doobr_private or public schema.
BEGIN;
CREATE TABLE doobr_staging.mobile_replay_receipts (
 tenant_id uuid NOT NULL, device_id uuid NOT NULL, command_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('REFRESH_STATUS','ACK_OPAQUE_NOTIFICATION')),
 opaque_ref text NOT NULL CHECK (length(opaque_ref) BETWEEN 8 AND 128
   AND opaque_ref !~ '[[:space:]]'),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,device_id,command_id)
);
ALTER TABLE doobr_staging.mobile_replay_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_staging.mobile_replay_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY doobr_staging_replay_tenant ON doobr_staging.mobile_replay_receipts
 USING (tenant_id = NULLIF(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('doobr.tenant_id',true),'')::uuid);
REVOKE ALL ON doobr_staging.mobile_replay_receipts FROM PUBLIC;
GRANT SELECT,INSERT ON doobr_staging.mobile_replay_receipts TO doobr_staging_runtime;
GRANT SELECT ON doobr_staging.mobile_replay_receipts TO doobr_staging_readonly;
-- Migrator must explicitly be granted from its own approved provisioning principal.
COMMIT;
