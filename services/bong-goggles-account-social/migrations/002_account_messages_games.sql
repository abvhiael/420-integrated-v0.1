-- AUTH-9: separate off-chain account messaging and zero-wager quick games.
-- No wallet signature, canonical Messenger record, wager, mint, reward or
-- on-chain game authority is created by this schema.
CREATE TABLE IF NOT EXISTS bg_account_social.direct_messages (
 id uuid PRIMARY KEY,
 sender uuid NOT NULL REFERENCES bg_account_social.members(subject),
 recipient uuid NOT NULL REFERENCES bg_account_social.members(subject),
 body_cipher bytea NOT NULL CHECK(octet_length(body_cipher) BETWEEN 29 AND 8192),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 sender_deleted_at timestamptz,
 recipient_deleted_at timestamptz,
 CHECK(sender<>recipient)
);
CREATE INDEX IF NOT EXISTS bg_account_social_dm_sent ON bg_account_social.direct_messages(sender,recipient,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS bg_account_social_dm_received ON bg_account_social.direct_messages(recipient,sender,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS bg_account_social.account_games (
 id uuid PRIMARY KEY,
 inviter uuid NOT NULL REFERENCES bg_account_social.members(subject),
 invited uuid NOT NULL REFERENCES bg_account_social.members(subject),
 kind text NOT NULL CHECK(kind IN ('tic_tac_toe','connect_four')),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','won','draw','declined','expired')),
 board text NOT NULL CHECK(char_length(board) IN (9,42) AND board ~ '^[.XO]+$'),
 next_turn uuid REFERENCES bg_account_social.members(subject),
 winner uuid REFERENCES bg_account_social.members(subject),
 moves integer NOT NULL DEFAULT 0 CHECK(moves BETWEEN 0 AND 42),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 invite_expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '24 hours'),
 CHECK(inviter<>invited),
 CHECK(winner IS NULL OR winner=inviter OR winner=invited)
);
CREATE INDEX IF NOT EXISTS bg_account_social_games_inviter ON bg_account_social.account_games(inviter,updated_at DESC);
CREATE INDEX IF NOT EXISTS bg_account_social_games_invited ON bg_account_social.account_games(invited,updated_at DESC);
CREATE TABLE IF NOT EXISTS bg_account_social.account_game_moves (
 game_id uuid NOT NULL REFERENCES bg_account_social.account_games(id),
 move_number integer NOT NULL CHECK(move_number BETWEEN 1 AND 42),
 actor uuid NOT NULL REFERENCES bg_account_social.members(subject),
 position integer NOT NULL CHECK(position BETWEEN 0 AND 41),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(game_id,move_number)
);
-- Only the two app-specific subjects are game participants.
-- 420ID account IDs and bearer tokens never enter these tables.
