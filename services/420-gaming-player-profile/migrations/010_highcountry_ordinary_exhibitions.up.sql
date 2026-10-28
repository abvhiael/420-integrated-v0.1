-- HC-NEXT-7.2 additive account-only exhibition persistence.
-- Run using the restricted datastore migrator. Runtime has no schema/DDL privileges.
CREATE SCHEMA IF NOT EXISTS highcountry_exhibitions;
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.seasons (
 game_id text NOT NULL, season_id text NOT NULL, organizer text NOT NULL,
 opens_at bigint NOT NULL, closes_at bigint NOT NULL, cancelled boolean NOT NULL DEFAULT false,
 PRIMARY KEY(game_id,season_id), CHECK(closes_at>opens_at)
);
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.categories (
 game_id text NOT NULL, category text NOT NULL, version integer NOT NULL,
 rules_hash text NOT NULL, wallet_required boolean NOT NULL, scope text,
 PRIMARY KEY(game_id,category,version), CHECK(version>0),
 CHECK(rules_hash ~ '^0x[0-9a-f]{64}$')
);
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.events (
 game_id text NOT NULL,event_id text NOT NULL, season_id text NOT NULL,
 category text NOT NULL,version integer NOT NULL,rules_hash text NOT NULL,
 organizer text NOT NULL,opens_at bigint NOT NULL,closes_at bigint NOT NULL,
 challenge_until bigint NOT NULL,finalized boolean NOT NULL DEFAULT false,
 cancelled boolean NOT NULL DEFAULT false,winner text,
 winner_score integer NOT NULL DEFAULT 0,finalized_at bigint,evidence_digest text,
 PRIMARY KEY(game_id,event_id),
 FOREIGN KEY(game_id,season_id) REFERENCES highcountry_exhibitions.seasons(game_id,season_id),
 FOREIGN KEY(game_id,category,version) REFERENCES highcountry_exhibitions.categories(game_id,category,version),
 CHECK(closes_at>opens_at AND challenge_until>closes_at AND challenge_until<=closes_at+604800000),
 CHECK(winner_score BETWEEN 0 AND 10000)
);
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.entries (
 game_id text NOT NULL,event_id text NOT NULL,account_id text NOT NULL,
 PRIMARY KEY(game_id,event_id,account_id),
 FOREIGN KEY(game_id,event_id) REFERENCES highcountry_exhibitions.events(game_id,event_id)
);
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.results (
 game_id text NOT NULL,event_id text NOT NULL,account_id text NOT NULL,
 harvest_id text NOT NULL, quality_bps integer NOT NULL,
 finalized_at bigint NOT NULL,provenance_hash text NOT NULL,
 rejected boolean NOT NULL DEFAULT false,reason_hash text,
 PRIMARY KEY(game_id,event_id,account_id), UNIQUE(game_id,event_id,harvest_id),
 FOREIGN KEY(game_id,event_id,account_id) REFERENCES highcountry_exhibitions.entries(game_id,event_id,account_id),
 CHECK(quality_bps BETWEEN 0 AND 10000),
 CHECK(provenance_hash ~ '^0x[0-9a-f]{64}$')
);
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.adjudicators (
 game_id text NOT NULL,account_id text NOT NULL,active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(game_id,account_id)
);
-- Deliberately do not grant PUBLIC access or DDL ownership to the runtime.
REVOKE ALL ON SCHEMA highcountry_exhibitions FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA highcountry_exhibitions FROM PUBLIC;
GRANT USAGE ON SCHEMA highcountry_exhibitions TO gaming_datastore_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA highcountry_exhibitions TO gaming_datastore_runtime;
GRANT INSERT ON highcountry_exhibitions.events,highcountry_exhibitions.entries,highcountry_exhibitions.results TO gaming_datastore_runtime;
GRANT UPDATE(finalized,winner,winner_score,finalized_at,evidence_digest) ON highcountry_exhibitions.events TO gaming_datastore_runtime;
GRANT UPDATE(rejected,reason_hash) ON highcountry_exhibitions.results TO gaming_datastore_runtime;
