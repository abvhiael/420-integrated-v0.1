-- R02.1 baseline: deploy ONLY with dedicated migration owner; Postgres 15 + PostGIS 3.
BEGIN;
SELECT pg_advisory_xact_lock(4202101);
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS doobr_private;
REVOKE ALL ON SCHEMA doobr_private FROM PUBLIC;
CREATE TABLE doobr_private.schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE doobr_private.tenants (
 tenant_id uuid PRIMARY KEY, label text NOT NULL CHECK(length(label) BETWEEN 1 AND 160),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE doobr_private.actors (
 tenant_id uuid NOT NULL REFERENCES doobr_private.tenants(tenant_id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL, identity_ref text NOT NULL CHECK(length(identity_ref) BETWEEN 1 AND 256),
 kind text NOT NULL CHECK(kind IN ('CONSUMER','COURIER','RETAILER','OPERATOR')),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','ACTIVE','SUSPENDED','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id),
 UNIQUE(tenant_id,identity_ref,kind)
);
CREATE TABLE doobr_private.service_regions (
 tenant_id uuid NOT NULL REFERENCES doobr_private.tenants(tenant_id) ON DELETE RESTRICT,
 region_id uuid NOT NULL, region_code text NOT NULL,
 country_code text NOT NULL, province_code text NOT NULL, municipality_ref text NOT NULL,
 boundary geometry(MultiPolygon,4326) NOT NULL,
 policy_ref text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,region_id), UNIQUE(tenant_id,region_code),
 CHECK(ST_IsValid(boundary)), CHECK(NOT ST_IsEmpty(boundary)), CHECK(ST_SRID(boundary)=4326)
);
CREATE INDEX doobr_regions_gist ON doobr_private.service_regions USING gist(boundary);
CREATE TABLE doobr_private.delivery_orders (
 tenant_id uuid NOT NULL REFERENCES doobr_private.tenants(tenant_id) ON DELETE RESTRICT,
 order_id uuid NOT NULL, consumer_id uuid NOT NULL, retailer_id uuid NOT NULL,
 region_id uuid NOT NULL,
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','ELIGIBILITY_PENDING','ELIGIBLE','RETAILER_READY','OFFERED','ASSIGNED','PICKED_UP','IN_TRANSIT','HANDOFF_PENDING','DELIVERED','CLOSED','DELIVERY_FAILED','RETURN_REQUIRED','RETURNED','RECONCILED','CANCELLED','EXPIRED','DISPUTED')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 retailer_order_ref text, policy_decision_ref text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,order_id),
 FOREIGN KEY(tenant_id,consumer_id) REFERENCES doobr_private.actors(tenant_id,actor_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,retailer_id) REFERENCES doobr_private.actors(tenant_id,actor_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,region_id) REFERENCES doobr_private.service_regions(tenant_id,region_id) ON DELETE RESTRICT
);
CREATE TABLE doobr_private.private_delivery_data (
 tenant_id uuid NOT NULL, order_id uuid NOT NULL,
 address_ciphertext bytea NOT NULL CHECK(octet_length(address_ciphertext)>28),
 address_key_version text NOT NULL CHECK(length(address_key_version)>0),
 recipient_ciphertext bytea, recipient_key_version text,
 location_ciphertext bytea, location_key_version text,
 retention_until timestamptz NOT NULL, legal_hold boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,order_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id) ON DELETE RESTRICT,
 CHECK((recipient_ciphertext IS NULL)=(recipient_key_version IS NULL)),
 CHECK((location_ciphertext IS NULL)=(location_key_version IS NULL))
);
CREATE TABLE doobr_private.custody_evidence (
 tenant_id uuid NOT NULL, evidence_id uuid NOT NULL, order_id uuid NOT NULL,
 evidence_type text NOT NULL CHECK(evidence_type IN ('PICKUP','HANDOFF','FAILED_HANDOFF','RETURN','INCIDENT')),
 evidence_ciphertext bytea NOT NULL CHECK(octet_length(evidence_ciphertext)>28),
 key_version text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 retention_until timestamptz NOT NULL, legal_hold boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,evidence_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id) ON DELETE RESTRICT
);
CREATE TABLE doobr_private.policy_evidence (
 tenant_id uuid NOT NULL, decision_id uuid NOT NULL, order_id uuid NOT NULL,
 policy_ref text NOT NULL, request_digest bytea NOT NULL CHECK(octet_length(request_digest)=32),
 decision text NOT NULL CHECK(decision IN ('ALLOW','DENY','UNKNOWN')),
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,decision_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id) ON DELETE RESTRICT
);
CREATE TABLE doobr_private.retention_audit (
 tenant_id uuid NOT NULL REFERENCES doobr_private.tenants(tenant_id) ON DELETE RESTRICT,
 audit_id bigint GENERATED ALWAYS AS IDENTITY, object_type text NOT NULL,
 object_ref uuid NOT NULL, disposition text NOT NULL,
 actor_ref text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,audit_id)
);
-- App role must not own tables / have BYPASSRLS; migration role is separate.
DO $$
DECLARE tbl text;
BEGIN
 FOR tbl IN SELECT unnest(ARRAY['tenants','actors','service_regions','delivery_orders','private_delivery_data','custody_evidence','policy_evidence','retention_audit']) LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING (tenant_id = nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)', tbl);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM PUBLIC;
COMMIT;
