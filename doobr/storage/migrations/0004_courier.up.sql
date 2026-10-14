-- DOOBR R02.4 credential reference store; deploy with privileged migration owner.
BEGIN;
SELECT pg_advisory_xact_lock(4202104);
CREATE TABLE doobr_private.courier_credentials (
 tenant_id uuid NOT NULL,
 credential_id uuid NOT NULL,
 courier_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('IDENTITY','COURIER_AUTHORITY','TRAINING','VEHICLE')),
 carrier_class text NOT NULL CHECK(carrier_class IN ('LICENSEE_EMPLOYEE','DELIVERY_PERSON','COMMON_CARRIER')),
 issuer_ref text NOT NULL CHECK(length(issuer_ref)>0),
 evidence_digest bytea NOT NULL CHECK(octet_length(evidence_digest)=32),
 jurisdiction_ref text NOT NULL CHECK(length(jurisdiction_ref)>0),
 vehicle_ref text,
 valid_from timestamptz NOT NULL,
 valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,credential_id),
 FOREIGN KEY(tenant_id,courier_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 UNIQUE(tenant_id,courier_id,kind,carrier_class,jurisdiction_ref),
 CHECK(valid_until>valid_from),
 CHECK(kind<>'VEHICLE' OR vehicle_ref IS NOT NULL)
);
CREATE INDEX courier_credential_expiry_idx
 ON doobr_private.courier_credentials(tenant_id,courier_id,valid_until);
ALTER TABLE doobr_private.courier_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.courier_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON doobr_private.courier_credentials
 USING (tenant_id=nullif(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=nullif(current_setting('doobr.tenant_id',true),'')::uuid);
REVOKE ALL ON doobr_private.courier_credentials FROM PUBLIC;
COMMIT;
