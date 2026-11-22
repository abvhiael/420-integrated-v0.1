-- Cross Country Chaos account multiplayer authority. Operator-only DDL.
-- Contains shuffled hands and deck: game service MUST redact non-owner cards.
CREATE TABLE IF NOT EXISTS bg_account_social.chaos_rooms (
 id uuid PRIMARY KEY,
 join_code text NOT NULL UNIQUE CHECK(char_length(join_code)=32),
 host uuid NOT NULL REFERENCES bg_account_social.members(subject),
 status text NOT NULL CHECK(status IN ('lobby','playing','between','finished')),
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND octet_length(data::text)<1048576),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS chaos_rooms_host_updated ON bg_account_social.chaos_rooms(host,updated_at DESC);
CREATE TABLE IF NOT EXISTS bg_account_social.chaos_room_members (
 room_id uuid NOT NULL REFERENCES bg_account_social.chaos_rooms(id),
 subject uuid NOT NULL REFERENCES bg_account_social.members(subject),
 seat smallint NOT NULL CHECK(seat BETWEEN 0 AND 3),
 joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(room_id,subject),UNIQUE(room_id,seat)
);
CREATE INDEX IF NOT EXISTS chaos_room_members_subject ON bg_account_social.chaos_room_members(subject,room_id);
-- Dedicated game role: grant USAGE schema; SELECT, INSERT, column-specific
-- UPDATE(data,status,revision,updated_at) on chaos_rooms; SELECT and INSERT
-- on chaos_room_members; SELECT only on blocks. No social secrets access.
