-- GROW-V2-07 tenant-owned equipment registry, monitoring state and replay reservation.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.equipment (
 tenant_id uuid NOT NULL, facility_id uuid NOT NULL, zone_id uuid NOT NULL,
 device_id uuid NOT NULL, device_type text NOT NULL CHECK(length(device_type) BETWEEN 1 AND 80),
 safe_minimum numeric NOT NULL, safe_maximum numeric NOT NULL,
 online boolean NOT NULL DEFAULT false, interlock_ok boolean NOT NULL DEFAULT false,
 manual_override boolean NOT NULL DEFAULT true,
 control_signing_key bytea CHECK(control_signing_key IS NULL OR octet_length(control_signing_key)=32),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,device_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 CHECK(safe_minimum<=safe_maximum)
);
CREATE TABLE grow_private.equipment_nonces (
 tenant_id uuid NOT NULL, device_id uuid NOT NULL, nonce bytea NOT NULL CHECK(octet_length(nonce)=16),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,device_id,nonce),
 FOREIGN KEY(tenant_id,device_id) REFERENCES grow_private.equipment(tenant_id,device_id)
);
ALTER TABLE grow_private.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.equipment FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.equipment USING(tenant_id=grow_private.current_tenant())
 WITH CHECK(tenant_id=grow_private.current_tenant());
ALTER TABLE grow_private.equipment_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.equipment_nonces FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.equipment_nonces USING(tenant_id=grow_private.current_tenant())
 WITH CHECK(tenant_id=grow_private.current_tenant());
COMMIT;
