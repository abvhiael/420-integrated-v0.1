-- R03.9: opaque replay journal, no courier coordinates or regulated operations.
CREATE TABLE IF NOT EXISTS doobr_private.mobile_replay_receipts (
 tenant_id uuid NOT NULL,
 device_id uuid NOT NULL,
 command_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('REFRESH_STATUS','ACK_OPAQUE_NOTIFICATION')),
 opaque_ref text NOT NULL CHECK (length(opaque_ref) BETWEEN 8 AND 128 AND opaque_ref !~ '[[:space:]]'),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,device_id,command_id)
);
ALTER TABLE doobr_private.mobile_replay_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.mobile_replay_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY mobile_replay_tenant ON doobr_private.mobile_replay_receipts
 USING (tenant_id = nullif(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = nullif(current_setting('doobr.tenant_id',true),'')::uuid);
