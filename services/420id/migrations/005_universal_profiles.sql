-- AUTH-4: account-owned universal profile, deliberately not a 420Names or Identity420 record.
-- Nothing is public without explicit visibility opt-in; no email, wallet, or account ID in public projections.
CREATE TABLE IF NOT EXISTS account420.profiles (
 account_id uuid PRIMARY KEY REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 profile_id uuid NOT NULL UNIQUE,
 username text,
 display_name text NOT NULL DEFAULT '',
 bio text NOT NULL DEFAULT '',
 avatar_ref text NOT NULL DEFAULT '',
 visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
 username_changed_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{2,23}$'),
 CHECK (username IS NULL OR username NOT IN ('admin','administrator','moderator','mod','staff','support','security','root','system','help','420id','420integrated','420wallet','420names','official')),
 CHECK (char_length(display_name) <= 80 AND octet_length(display_name) <= 320),
 CHECK (char_length(bio) <= 500 AND octet_length(bio) <= 2000),
 CHECK (avatar_ref = '' OR avatar_ref ~ '^sha256:[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS account420_profiles_username_unique
 ON account420.profiles(username) WHERE username IS NOT NULL;
CREATE TABLE IF NOT EXISTS account420.profile_username_claims (
 username text PRIMARY KEY CHECK(username ~ '^[a-z][a-z0-9_]{2,23}$'),
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS account420_profile_claims_account
 ON account420.profile_username_claims(account_id);
-- Former usernames remain reserved to their original account: no silent takeover.
