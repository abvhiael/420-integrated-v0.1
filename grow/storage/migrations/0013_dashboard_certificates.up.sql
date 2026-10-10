-- GROW-V2-13: certificate identity bindings and immediate revocation for private sessions.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.dashboard_identities(
 tenant_id uuid NOT NULL,
 subject_id text NOT NULL,
 cert_fingerprint bytea NOT NULL CHECK(octet_length(cert_fingerprint)=32),
 enabled boolean NOT NULL DEFAULT true,
 enrolled_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 PRIMARY KEY(tenant_id,subject_id,cert_fingerprint),
 UNIQUE(tenant_id,cert_fingerprint),
 FOREIGN KEY(tenant_id,subject_id) REFERENCES grow_private.memberships(tenant_id,subject_id)
);
ALTER TABLE grow_private.dashboard_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.dashboard_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.dashboard_identities
 USING(tenant_id=grow_private.current_tenant())
 WITH CHECK(tenant_id=grow_private.current_tenant());
ALTER TABLE grow_private.dashboard_sessions
 ADD COLUMN identity_fingerprint bytea CHECK(identity_fingerprint IS NULL OR octet_length(identity_fingerprint)=32);
ALTER TABLE grow_private.dashboard_sessions
 ADD CONSTRAINT dashboard_session_identity_fk
 FOREIGN KEY(tenant_id,subject_id,identity_fingerprint)
 REFERENCES grow_private.dashboard_identities(tenant_id,subject_id,cert_fingerprint);
CREATE INDEX dashboard_identities_active ON grow_private.dashboard_identities(tenant_id,subject_id,cert_fingerprint)
 WHERE enabled AND revoked_at IS NULL;
COMMIT;
