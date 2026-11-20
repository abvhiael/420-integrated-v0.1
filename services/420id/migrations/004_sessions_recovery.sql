-- AUTH-3: private, revocable application sessions and passkey recovery.
-- No wallet capability or cross-application SSO is conferred.
CREATE TABLE IF NOT EXISTS account420.session_proof_uses (
 proof_id uuid PRIMARY KEY,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS account420_session_proofs_expiry ON account420.session_proof_uses(expires_at);
CREATE TABLE IF NOT EXISTS account420.sessions (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 app_id text NOT NULL,
 account_revision bigint NOT NULL CHECK(account_revision >= 1),
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
 method text NOT NULL CHECK(method IN ('email','passkey')),
 issued_at timestamptz NOT NULL,
 idle_until timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 FOREIGN KEY(account_id,app_id) REFERENCES account420.app_subjects(account_id,app_id) ON DELETE RESTRICT,
 CHECK(issued_at < idle_until AND idle_until <= expires_at)
);
CREATE INDEX IF NOT EXISTS account420_sessions_account ON account420.sessions(account_id,app_id);
CREATE INDEX IF NOT EXISTS account420_sessions_expiry ON account420.sessions(expires_at);
CREATE TABLE IF NOT EXISTS account420.recovery_challenges (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 account_revision bigint NOT NULL CHECK(account_revision >= 1),
 origin text NOT NULL,
 rp_id text NOT NULL,
 challenge bytea NOT NULL CHECK(octet_length(challenge)=32),
 browser_digest bytea NOT NULL CHECK(octet_length(browser_digest)=32),
 expires_at timestamptz NOT NULL,
 UNIQUE(account_id,rp_id)
);
CREATE INDEX IF NOT EXISTS account420_recovery_expiry ON account420.recovery_challenges(expires_at);
