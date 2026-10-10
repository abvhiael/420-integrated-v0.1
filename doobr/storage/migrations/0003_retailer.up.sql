-- R02.3 immutable evidence references; actual regulatory proof remains externally authoritative.
BEGIN;
SELECT pg_advisory_xact_lock(4202103);
CREATE TABLE doobr_private.retailer_authorizations (
 tenant_id uuid NOT NULL, authorization_id uuid NOT NULL,
 retailer_id uuid NOT NULL, legal_seller_ref text NOT NULL,
 licence_ref text NOT NULL, municipality_ref text NOT NULL,
 retail_site_ref text NOT NULL, issuer_ref text NOT NULL,
 evidence_digest bytea NOT NULL CHECK(octet_length(evidence_digest)=32),
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL,
 revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,authorization_id),
 FOREIGN KEY(tenant_id,retailer_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 UNIQUE(tenant_id,retailer_id,licence_ref,retail_site_ref),
 CHECK(valid_until>valid_from),
 CHECK(length(legal_seller_ref)>0 AND length(licence_ref)>0 AND length(municipality_ref)>0
       AND length(retail_site_ref)>0 AND length(issuer_ref)>0)
);
CREATE TABLE doobr_private.retailer_prepaid_evidence (
 tenant_id uuid NOT NULL, order_id uuid NOT NULL, authorization_id uuid NOT NULL,
 retailer_order_ref text NOT NULL, canonical_payment_ref text NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor>0),
 currency char(3) NOT NULL, proof_digest bytea NOT NULL CHECK(octet_length(proof_digest)=32),
 verified_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,order_id),
 UNIQUE(tenant_id,retailer_order_ref),
 UNIQUE(tenant_id,canonical_payment_ref),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 FOREIGN KEY(tenant_id,authorization_id) REFERENCES doobr_private.retailer_authorizations(tenant_id,authorization_id),
 CHECK(length(retailer_order_ref)>0 AND length(canonical_payment_ref)>0)
);
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['retailer_authorizations','retailer_prepaid_evidence'] LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING (tenant_id = nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM PUBLIC;
COMMIT;
