-- AUTH-11: only the 420ID owner can opt into review for canonical
-- BongGoggles monetization/reward programmes. No balance, payout, price,
-- payment, token entitlement or wallet delegation is stored here.
CREATE TABLE IF NOT EXISTS account420.monetization_consents (
 account_id uuid NOT NULL REFERENCES account420.accounts(id) ON DELETE RESTRICT,
 app_id text NOT NULL CHECK (app_id='bong-goggles'),
 reward_opt_in boolean NOT NULL DEFAULT false,
 creator_opt_in boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(account_id,app_id)
);
-- Runtime: SELECT, INSERT, UPDATE(reward_opt_in,creator_opt_in,revision,updated_at)
-- only. Operator separately installs migrations. Never expose raw account_id.
