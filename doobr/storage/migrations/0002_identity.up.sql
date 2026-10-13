-- R02.2 identity/consent: migrate with restricted owner; no application role DDL.
BEGIN;
SELECT pg_advisory_xact_lock(4202102);
CREATE TABLE doobr_private.identity_sessions (
 tenant_id uuid NOT NULL, session_id uuid NOT NULL, actor_id uuid NOT NULL,
 issuer_ref text NOT NULL, token_jti_digest bytea NOT NULL CHECK(octet_length(token_jti_digest)=32),
 audience text NOT NULL CHECK(audience='doobr-api'), wallet_consent boolean NOT NULL DEFAULT false,
 wallet_consent_expires_at timestamptz, expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,session_id),
 UNIQUE(tenant_id,token_jti_digest),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 CHECK (wallet_consent IS FALSE OR wallet_consent_expires_at IS NOT NULL)
);
CREATE TABLE doobr_private.role_grants (
 tenant_id uuid NOT NULL, actor_id uuid NOT NULL, grant_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('CONSUMER','COURIER','RETAILER','OPERATOR')),
 resource_ref text NOT NULL, granted_by text NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 revoked_at timestamptz, PRIMARY KEY(tenant_id,grant_id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES doobr_private.actors(tenant_id,actor_id)
);
CREATE INDEX role_grants_active_idx ON doobr_private.role_grants(tenant_id,actor_id,role,expires_at);
CREATE TABLE doobr_private.access_audit (
 tenant_id uuid NOT NULL, event_id uuid NOT NULL, actor_id uuid NOT NULL,
 session_id uuid NOT NULL, operation text NOT NULL, decision text NOT NULL CHECK(decision IN ('ALLOW','DENY')),
 at_time timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,event_id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 FOREIGN KEY(tenant_id,session_id) REFERENCES doobr_private.identity_sessions(tenant_id,session_id)
);
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['identity_sessions','role_grants','access_audit'] LOOP
 EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',tab);
 EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',tab);
 EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING (tenant_id = nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA doobr_private FROM PUBLIC;
COMMIT;
