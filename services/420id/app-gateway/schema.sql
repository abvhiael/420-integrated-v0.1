-- AUTH-13. Operator-only: one separate PostgreSQL database and runtime
-- credential per approved application. No 420ID account database is shared.
CREATE SCHEMA IF NOT EXISTS app420_sso;

CREATE TABLE IF NOT EXISTS app420_sso.login_flows (
 flow_digest bytea PRIMARY KEY CHECK (octet_length(flow_digest)=32),
 state_digest bytea NOT NULL CHECK (octet_length(state_digest)=32),
 verifier_cipher bytea NOT NULL CHECK (octet_length(verifier_cipher) BETWEEN 61 AND 256),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS login_flows_expiry ON app420_sso.login_flows (expires_at);

CREATE TABLE IF NOT EXISTS app420_sso.sessions (
 cookie_digest bytea PRIMARY KEY CHECK (octet_length(cookie_digest)=32),
 subject_id text NOT NULL CHECK (subject_id ~
  '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
 token_cipher bytea NOT NULL CHECK (octet_length(token_cipher) BETWEEN 61 AND 256),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON app420_sso.sessions (expires_at);

CREATE TABLE IF NOT EXISTS app420_sso.rate_buckets (
 action text NOT NULL CHECK (action IN ('login','callback','status','logout')),
 peer_digest bytea NOT NULL CHECK (octet_length(peer_digest)=32),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 requests integer NOT NULL DEFAULT 1 CHECK (requests > 0),
 PRIMARY KEY(action,peer_digest)
);

-- Runtime role (replace example name with this app's dedicated runtime role):
-- GRANT USAGE ON SCHEMA app420_sso TO app420_runtime;
-- GRANT SELECT,INSERT,DELETE ON app420_sso.login_flows,app420_sso.sessions TO app420_runtime;
-- GRANT SELECT,INSERT,UPDATE,DELETE ON app420_sso.rate_buckets TO app420_runtime;
-- Never GRANT UPDATE/TRUNCATE on flows or sessions, or DDL/table ownership.
