-- BC-0.5: durable off-chain 420ID rooms. No wager, chain or rules engine.
CREATE TABLE IF NOT EXISTS bg_account_social.classic_rooms (
 id uuid PRIMARY KEY,
 host uuid NOT NULL REFERENCES bg_account_social.members(subject),
 game_id text NOT NULL CHECK(game_id IN ('cribbage','russian-cribbage','chess','scrabble','checkers','backgammon','dominoes','crazy-eights','euchre','yahtzee','go-fish','hearts','go','mahjong','spades','500','canasta','tarabish','45s','120s','deux-cents','hola','rook','nines','kaiser')),
 visibility text NOT NULL CHECK(visibility IN ('private','public')),
 seat_count smallint NOT NULL CHECK(seat_count BETWEEN 2 AND 4),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','ready','cancelled')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS bg_classic_rooms_lobby ON bg_account_social.classic_rooms(status,visibility,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS bg_classic_rooms_host ON bg_account_social.classic_rooms(host,status,updated_at DESC);
CREATE TABLE IF NOT EXISTS bg_account_social.classic_room_seats (
 room_id uuid NOT NULL REFERENCES bg_account_social.classic_rooms(id),
 seat_index smallint NOT NULL CHECK(seat_index BETWEEN 0 AND 3),
 controller text NOT NULL CHECK(controller IN ('empty','human','invited','bot')),
 subject uuid REFERENCES bg_account_social.members(subject),
 difficulty text CHECK(difficulty IN ('easy','medium','hard')),
 team smallint NOT NULL CHECK(team BETWEEN 0 AND 3),
 PRIMARY KEY(room_id,seat_index),
 CHECK((controller='empty' AND subject IS NULL AND difficulty IS NULL) OR
       (controller IN ('human','invited') AND subject IS NOT NULL AND difficulty IS NULL) OR
       (controller='bot' AND subject IS NULL AND difficulty IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bg_classic_room_unique_human ON bg_account_social.classic_room_seats(room_id,subject) WHERE subject IS NOT NULL;
CREATE TABLE IF NOT EXISTS bg_account_social.classic_room_invites (
 id uuid PRIMARY KEY,
 room_id uuid NOT NULL REFERENCES bg_account_social.classic_rooms(id),
 seat_index smallint NOT NULL,
 inviter uuid NOT NULL REFERENCES bg_account_social.members(subject),
 target uuid NOT NULL REFERENCES bg_account_social.members(subject),
 status text NOT NULL CHECK(status IN ('pending','accepted','declined','cancelled','expired')),
 expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '24 hours'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(room_id,seat_index) REFERENCES bg_account_social.classic_room_seats(room_id,seat_index),
 CHECK(inviter<>target)
);
CREATE UNIQUE INDEX IF NOT EXISTS bg_classic_pending_invite ON bg_account_social.classic_room_invites(room_id,target) WHERE status='pending';
CREATE INDEX IF NOT EXISTS bg_classic_room_invites_target ON bg_account_social.classic_room_invites(target,status,created_at DESC);
-- Durable seats and invitations are lobby authority only; no client scores,
-- turns, payouts, wallet identifiers, arbitrary team choices or bots that play.
