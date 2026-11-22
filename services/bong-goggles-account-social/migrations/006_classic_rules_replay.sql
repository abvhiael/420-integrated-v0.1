-- BC-0.7: private immutable reconstruction evidence, separate from public SSE.
-- The production runtime role has INSERT/SELECT only, not DELETE/UPDATE.
-- No hidden cards, action content or random seeds enter classic_session_events.
CREATE TABLE IF NOT EXISTS bg_account_social.classic_rule_genesis (
 session_id uuid PRIMARY KEY REFERENCES bg_account_social.classic_sessions(id),
 rules_version text NOT NULL,
 rules_hash text NOT NULL CHECK(rules_hash ~ '^[0-9a-f]{64}$'),
 seed_hex text NOT NULL CHECK(seed_hex ~ '^[0-9a-f]{64}$'),
 initial_state jsonb NOT NULL CHECK(octet_length(initial_state::text) <= 16384),
 initial_hash text NOT NULL CHECK(initial_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS bg_account_social.classic_rule_moves (
 session_id uuid NOT NULL REFERENCES bg_account_social.classic_rule_genesis(session_id),
 sequence bigint NOT NULL CHECK(sequence>=2),
 actor_seat smallint NOT NULL CHECK(actor_seat BETWEEN 0 AND 3),
 action jsonb NOT NULL CHECK(octet_length(action::text) <= 1024),
 before_hash text NOT NULL CHECK(before_hash ~ '^[0-9a-f]{64}$'),
 after_hash text NOT NULL CHECK(after_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,sequence),
 FOREIGN KEY(session_id,sequence) REFERENCES bg_account_social.classic_session_events(session_id,sequence)
);
CREATE INDEX IF NOT EXISTS bg_classic_rule_moves_sequence
 ON bg_account_social.classic_rule_moves(session_id,sequence);
