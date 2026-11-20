-- AUTH-2 live acceptance request boundary. No session or financial authority.
CREATE TABLE IF NOT EXISTS account420.acceptance_flows (
 challenge_id uuid PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('email','register','login')),
 browser_digest bytea NOT NULL CHECK(octet_length(browser_digest)=32),
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS account420_acceptance_flows_expiry ON account420.acceptance_flows(expires_at);
CREATE TABLE IF NOT EXISTS account420.acceptance_rate (
 scope text NOT NULL,
 bucket bigint NOT NULL,
 count integer NOT NULL CHECK(count>0),
 PRIMARY KEY(scope,bucket)
);
CREATE TABLE IF NOT EXISTS account420.acceptance_receipts (
 id uuid PRIMARY KEY,
 kind text NOT NULL CHECK(kind IN ('email_verified','passkey_registered','passkey_verified')),
 created_at timestamptz NOT NULL DEFAULT now()
);
