-- R02.8 private location permission lifecycle, replay protection and retention.
BEGIN;
SELECT pg_advisory_xact_lock(4202108);
CREATE TABLE doobr_private.location_permissions (
 tenant_id uuid NOT NULL, order_id uuid NOT NULL, courier_id uuid NOT NULL,
 permission_id uuid NOT NULL, state text NOT NULL CHECK(state IN ('GRANTED','REVOKED')),
 granted_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, last_sequence bigint NOT NULL DEFAULT 0 CHECK(last_sequence>=0),
 last_observed_at timestamptz,
 PRIMARY KEY(tenant_id,order_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 FOREIGN KEY(tenant_id,courier_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 CHECK(expires_at>granted_at),
 CHECK((state='GRANTED' AND revoked_at IS NULL) OR (state='REVOKED' AND revoked_at IS NOT NULL))
);
CREATE TABLE doobr_private.location_samples (
 tenant_id uuid NOT NULL,order_id uuid NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),
 courier_id uuid NOT NULL,permission_id uuid NOT NULL,
 ciphertext bytea NOT NULL CHECK(octet_length(ciphertext)>28),
 key_version text NOT NULL CHECK(length(key_version)>0),
 observed_at timestamptz NOT NULL,retention_until timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,order_id,sequence),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.location_permissions(tenant_id,order_id),
 CHECK(retention_until>observed_at)
);
CREATE INDEX location_samples_retention ON doobr_private.location_samples(tenant_id,retention_until);
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['location_permissions','location_samples'] LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
REVOKE ALL ON doobr_private.location_permissions,doobr_private.location_samples FROM PUBLIC;
COMMIT;
