-- AUTH-5: optional account-owned wallet association. A link is NOT a login,
-- transaction authorization, 420Identity credential, 420Names registration,
-- payment entitlement, or wallet permission. No public profile join.
CREATE TABLE IF NOT EXISTS account420.wallet_links (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 chain_id bigint NOT NULL CHECK(chain_id>0),
 wallet_address text NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$' AND wallet_address <> '0x0000000000000000000000000000000000000000'),
 kind text NOT NULL CHECK(kind IN ('eoa','contract')),
 linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 unlinked_at timestamptz,
 CHECK(unlinked_at IS NULL OR unlinked_at>=linked_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS account420_wallet_active_account
 ON account420.wallet_links(account_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account420_wallet_active_address
 ON account420.wallet_links(chain_id,wallet_address) WHERE unlinked_at IS NULL;
CREATE INDEX IF NOT EXISTS account420_wallet_history ON account420.wallet_links(account_id,linked_at);
CREATE TABLE IF NOT EXISTS account420.wallet_link_challenges (
 id uuid PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 account_revision bigint NOT NULL CHECK(account_revision>0),
 session_id uuid NOT NULL REFERENCES account420.sessions(id) ON DELETE RESTRICT,
 app_id text NOT NULL,
 rp_id text NOT NULL,
 chain_id bigint NOT NULL CHECK(chain_id>0),
 wallet_address text NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$'),
 kind text NOT NULL CHECK(kind IN ('eoa','contract')),
 browser_digest bytea NOT NULL CHECK(octet_length(browser_digest)=32),
 nonce bytea NOT NULL CHECK(octet_length(nonce)=32),
 message text NOT NULL CHECK(char_length(message) BETWEEN 100 AND 1200),
 expires_at timestamptz NOT NULL,
 UNIQUE(account_id,app_id,rp_id)
);
CREATE INDEX IF NOT EXISTS account420_wallet_challenge_expiry ON account420.wallet_link_challenges(expires_at);
