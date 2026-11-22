-- BC-0.6: additive authoritative, wallet-independent session records.
-- Existing 420ID room/invitation data is preserved. No active games are
-- silently created and no rule engine is implicitly qualified.
ALTER TABLE bg_account_social.classic_rooms DROP CONSTRAINT IF EXISTS classic_rooms_status_check;
ALTER TABLE bg_account_social.classic_rooms ADD CONSTRAINT classic_rooms_status_check
 CHECK (status IN ('open','ready','in_game','completed','cancelled'));

CREATE TABLE IF NOT EXISTS bg_account_social.classic_sessions (
 id uuid PRIMARY KEY,
 room_id uuid NOT NULL UNIQUE REFERENCES bg_account_social.classic_rooms(id),
 game_id text NOT NULL,
 seat_count smallint NOT NULL CHECK (seat_count BETWEEN 2 AND 4),
 status text NOT NULL CHECK (status IN ('active','finished','resigned','timed_out','cancelled')),
 rules_version text NOT NULL CHECK (char_length(rules_version) BETWEEN 1 AND 80),
 rules_hash text NOT NULL CHECK (rules_hash ~ '^[0-9a-f]{64}$'),
 engine_state jsonb NOT NULL CHECK (octet_length(engine_state::text) <= 16384),
 sequence bigint NOT NULL DEFAULT 1 CHECK (sequence >= 1),
 turn_seat smallint CHECK (turn_seat BETWEEN 0 AND 3),
 turn_deadline timestamptz,
 winner_seat smallint CHECK (winner_seat BETWEEN 0 AND 3),
 finished_reason text CHECK (finished_reason IN ('completed','resigned','timed_out','cancelled')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK ((status='active' AND turn_seat IS NOT NULL AND turn_deadline IS NOT NULL
     AND finished_reason IS NULL AND winner_seat IS NULL)
   OR (status<>'active' AND turn_seat IS NULL AND turn_deadline IS NULL
     AND finished_reason IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS bg_classic_sessions_active_deadlines
 ON bg_account_social.classic_sessions(turn_deadline,id) WHERE status='active';
CREATE INDEX IF NOT EXISTS bg_classic_sessions_room ON bg_account_social.classic_sessions(room_id);
CREATE TABLE IF NOT EXISTS bg_account_social.classic_session_events (
 session_id uuid NOT NULL REFERENCES bg_account_social.classic_sessions(id),
 sequence bigint NOT NULL CHECK (sequence >= 1),
 kind text NOT NULL CHECK (kind IN ('started','move','finished','resigned','timed_out','cancelled')),
 actor_seat smallint CHECK (actor_seat BETWEEN 0 AND 3),
 public_state jsonb NOT NULL CHECK (octet_length(public_state::text) <= 4096),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,sequence)
);
CREATE TABLE IF NOT EXISTS bg_account_social.classic_session_commands (
 session_id uuid NOT NULL REFERENCES bg_account_social.classic_sessions(id),
 request_id uuid NOT NULL,
 actor uuid NOT NULL REFERENCES bg_account_social.members(subject),
 digest bytea NOT NULL CHECK(octet_length(digest)=32),
 sequence bigint NOT NULL CHECK (sequence >= 2),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,request_id),
 UNIQUE(session_id,sequence)
);
-- A runtime may append public events/commands and update only live state.
-- No DELETE or table-wide UPDATE; no client-controlled winner/actor/rules.
