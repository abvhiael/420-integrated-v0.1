-- AUTH-7: confidential approved-client authorization-code + PKCE handoff.
-- App sessions remain opaque per-app subjects. Central browser cookies
-- and internal account UUIDs never become application credentials.
ALTER TABLE account420.sessions DROP CONSTRAINT IF EXISTS sessions_method_check;
ALTER TABLE account420.sessions ADD CONSTRAINT sessions_method_check
 CHECK(method IN ('email','passkey','sso'));
ALTER TABLE account420.sessions ADD COLUMN IF NOT EXISTS sso_source_id uuid
 REFERENCES account420.sessions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS account420_sso_parent_idx
 ON account420.sessions(sso_source_id) WHERE sso_source_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS account420.sso_codes (
 code_digest bytea PRIMARY KEY CHECK(octet_length(code_digest)=32),
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 account_revision bigint NOT NULL CHECK(account_revision>=1),
 source_session_id uuid NOT NULL REFERENCES account420.sessions(id) ON DELETE CASCADE,
 client_app text NOT NULL CHECK(client_app ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
 redirect_uri text NOT NULL CHECK(char_length(redirect_uri)<=512),
 pkce_digest bytea NOT NULL CHECK(octet_length(pkce_digest)=32),
 browser_digest bytea NOT NULL CHECK(octet_length(browser_digest)=32),
 expires_at timestamptz NOT NULL,
 UNIQUE(source_session_id,client_app)
);
CREATE INDEX IF NOT EXISTS account420_sso_codes_expiry ON account420.sso_codes(expires_at);
