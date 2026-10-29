-- HC-NEXT-7.4 additive durable projection only. This is NOT an award mint or chain authority.
CREATE SCHEMA IF NOT EXISTS highcountry_cup;
CREATE TABLE IF NOT EXISTS highcountry_cup.achievements(
 game_id text NOT NULL,cup_id text NOT NULL,chain_id bigint NOT NULL,
 cup_address text NOT NULL,block_hash text NOT NULL,champion text NOT NULL,
 commitment text NOT NULL,scope text NOT NULL,prestige boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(game_id,cup_id),
 CHECK (cup_id ~ '^0x[0-9a-f]{64}$' AND block_hash ~ '^0x[0-9a-f]{64}$'
 AND commitment ~ '^0x[0-9a-f]{64}$' AND scope ~ '^0x[0-9a-f]{64}$'
 AND champion ~ '^0x[0-9a-f]{40}$')
);
CREATE TABLE IF NOT EXISTS highcountry_cup.history(
 game_id text NOT NULL,cup_id text NOT NULL,block_hash text NOT NULL,
 commitment text NOT NULL,champion text NOT NULL,prestige boolean NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(game_id,cup_id,block_hash,commitment,prestige)
);
REVOKE ALL ON SCHEMA highcountry_cup FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA highcountry_cup FROM PUBLIC;
GRANT USAGE ON SCHEMA highcountry_cup TO gaming_datastore_runtime;
GRANT SELECT ON highcountry_cup.achievements,highcountry_cup.history TO gaming_datastore_runtime;
GRANT INSERT,UPDATE ON highcountry_cup.achievements TO gaming_datastore_runtime;
GRANT INSERT ON highcountry_cup.history TO gaming_datastore_runtime;
