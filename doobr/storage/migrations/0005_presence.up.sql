-- R02.5 private tenant regional capacity; no public courier-level grants
BEGIN;
SELECT pg_advisory_xact_lock(4202105);
CREATE TABLE doobr_private.courier_region_presence (
 tenant_id uuid NOT NULL, courier_id uuid NOT NULL, region_id uuid NOT NULL,
 capacity integer NOT NULL CHECK(capacity BETWEEN 0 AND 100),
 eligibility_verified_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,courier_id),
 FOREIGN KEY(tenant_id,courier_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 FOREIGN KEY(tenant_id,region_id) REFERENCES doobr_private.service_regions(tenant_id,region_id),
 CHECK(expires_at>updated_at)
);
CREATE INDEX presence_region_expiry_idx ON doobr_private.courier_region_presence
 (tenant_id,region_id,expires_at);
ALTER TABLE doobr_private.courier_region_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.courier_region_presence FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON doobr_private.courier_region_presence
 USING(tenant_id=nullif(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('doobr.tenant_id',true),'')::uuid);
REVOKE ALL ON doobr_private.courier_region_presence FROM PUBLIC;
COMMIT;
