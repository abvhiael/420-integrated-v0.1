-- ARC competitive proof storage: no client-submitted scores may write verified results directly.
CREATE TABLE IF NOT EXISTS arcade_challenges (
  session_id text PRIMARY KEY CHECK (session_id ~ '^[0-9a-f]{32}$'),
  game_id text NOT NULL,
  player_ref text NOT NULL,
  seed_hash text NOT NULL CHECK (seed_hash ~ '^[0-9a-f]{64}$'),
  issued_at bigint NOT NULL CHECK (issued_at >= 0),
  expires_at bigint NOT NULL CHECK (expires_at > issued_at),
  consumed_at bigint
);
CREATE INDEX IF NOT EXISTS arcade_challenges_expiry_idx ON arcade_challenges(expires_at) WHERE consumed_at IS NULL;
CREATE TABLE IF NOT EXISTS arcade_verified_results (
 session_id text PRIMARY KEY REFERENCES arcade_challenges(session_id),
 game_id text NOT NULL,
 player_ref text NOT NULL,
 score bigint NOT NULL CHECK (score >= 0),
 ruleset_digest text NOT NULL CHECK (ruleset_digest ~ '^[0-9a-f]{64}$'),
 verified_at bigint NOT NULL CHECK (verified_at >= 0)
);
CREATE INDEX IF NOT EXISTS arcade_verified_game_rank_idx ON arcade_verified_results(game_id,score DESC,player_ref);
