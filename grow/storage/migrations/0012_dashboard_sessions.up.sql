-- GROW-V2-13 private authenticated sessions; opaque random bearer tokens are hashed at rest.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.dashboard_sessions(
 tenant_id uuid NOT NULL,
 session_id uuid NOT NULL,
 token_hash bytea NOT NULL CHECK(octet_length(token_hash)=32),
 subject_id text NOT NULL CHECK(length(subject_id) BETWEEN 1 AND 180),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 PRIMARY KEY(tenant_id,session_id),
 UNIQUE(tenant_id,token_hash),
 FOREIGN KEY(tenant_id,subject_id) REFERENCES grow_private.memberships(tenant_id,subject_id),
 CHECK(expires_at>issued_at AND expires_at<=issued_at+interval '12 hours')
);
CREATE INDEX dashboard_sessions_lookup ON grow_private.dashboard_sessions(tenant_id,token_hash)
 WHERE revoked_at IS NULL;
ALTER TABLE grow_private.dashboard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.dashboard_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.dashboard_sessions
 USING(tenant_id=grow_private.current_tenant())
 WITH CHECK(tenant_id=grow_private.current_tenant());
COMMIT;
