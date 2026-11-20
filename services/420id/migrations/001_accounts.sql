-- AUTH-1: dedicated off-chain account namespace; no contract/credential state.
CREATE SCHEMA IF NOT EXISTS account420;
CREATE TABLE IF NOT EXISTS account420.accounts (
 id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS account420.app_subjects (
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 app_id text NOT NULL CHECK (app_id ~ '^[a-z][a-z0-9-]{0,62}$'),
 subject_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,app_id)
);
-- No email, passkey, wallet, reward, role, or credential columns at this stage.
