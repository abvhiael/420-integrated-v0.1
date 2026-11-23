-- BC-1.6: idempotent, consent-based invitations derived only from a
-- verified 420ID principal. Never modify immutable match evidence.
CREATE TABLE IF NOT EXISTS bg_account_social.classic_match_requests (
 actor uuid NOT NULL REFERENCES bg_account_social.members(subject),
 request_id uuid NOT NULL,
 room_id uuid NOT NULL UNIQUE REFERENCES bg_account_social.classic_rooms(id),
 digest bytea NOT NULL CHECK (octet_length(digest)=32),
 source_session_id uuid UNIQUE REFERENCES bg_account_social.classic_sessions(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor,request_id)
);
CREATE INDEX IF NOT EXISTS bg_classic_match_requests_actor
 ON bg_account_social.classic_match_requests(actor,created_at DESC);
