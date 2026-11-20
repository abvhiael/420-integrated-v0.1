-- AUTH-6: optional presentation preference, not an on-chain identity, credential,
-- 420Names record, wallet authority or public directory. Verify each read.
CREATE TABLE IF NOT EXISTS account420.identity_names_preferences (
 account_id uuid PRIMARY KEY REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 chain_id bigint NOT NULL CHECK(chain_id>0),
 wallet_address text NOT NULL CHECK(wallet_address ~ '^0x[0-9a-f]{40}$'),
 identity_profile_id text NOT NULL CHECK(identity_profile_id ~ '^0x[0-9a-f]{64}$' AND identity_profile_id <> ('0x' || repeat('0',64))),
 name_label_hash text CHECK(name_label_hash IS NULL OR name_label_hash ~ '^0x[0-9a-f]{64}$' AND name_label_hash <> ('0x' || repeat('0',64))),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
