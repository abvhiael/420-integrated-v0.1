-- AUTH-2: private off-chain email identities and WebAuthn credentials.
CREATE TABLE IF NOT EXISTS account420.email_identities (
 email text PRIMARY KEY CHECK(length(email) BETWEEN 3 AND 254),
 account_id uuid NOT NULL UNIQUE REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 user_handle bytea NOT NULL UNIQUE CHECK(octet_length(user_handle)=32),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS account420.email_throttle (
 email text PRIMARY KEY,
 last_sent timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS account420.email_challenges (
 id uuid PRIMARY KEY,
 email text NOT NULL REFERENCES account420.email_throttle(email) ON DELETE CASCADE,
 digest bytea NOT NULL CHECK(octet_length(digest)=32),
 expires_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 consumed boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS account420_email_challenges_expiry ON account420.email_challenges(expires_at);
CREATE TABLE IF NOT EXISTS account420.passkey_challenges (
 id uuid PRIMARY KEY,
 purpose text NOT NULL CHECK(purpose IN ('register','login')),
 challenge bytea NOT NULL CHECK(octet_length(challenge)=32),
 origin text NOT NULL,
 rp_id text NOT NULL,
 account_id uuid REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 account_revision bigint,
 expires_at timestamptz NOT NULL,
 CHECK((purpose='register' AND account_id IS NOT NULL AND account_revision IS NOT NULL)
 OR (purpose='login' AND account_id IS NULL AND account_revision IS NULL))
);
CREATE INDEX IF NOT EXISTS account420_passkey_challenges_expiry ON account420.passkey_challenges(expires_at);
CREATE TABLE IF NOT EXISTS account420.passkeys (
 credential_id bytea PRIMARY KEY CHECK(octet_length(credential_id) BETWEEN 1 AND 1023),
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 rp_id text NOT NULL,
 public_key bytea NOT NULL CHECK(octet_length(public_key)=65),
 sign_count bigint NOT NULL CHECK(sign_count BETWEEN 0 AND 4294967295),
 backup_eligible boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,rp_id)
);
