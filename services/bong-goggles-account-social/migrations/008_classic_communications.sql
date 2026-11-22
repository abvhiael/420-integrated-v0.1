-- BC-0.10: short-lived, server-clock 420ID participant presence.
-- A subject can be online from multiple devices; never accept client-declared
-- online status, seat or identity, and never publish individual device IDs.
CREATE TABLE IF NOT EXISTS bg_account_social.classic_room_presence (
 room_id uuid NOT NULL REFERENCES bg_account_social.classic_rooms(id),
 subject uuid NOT NULL REFERENCES bg_account_social.members(subject),
 last_seen timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(room_id,subject)
);
CREATE INDEX IF NOT EXISTS bg_classic_presence_room_time
 ON bg_account_social.classic_room_presence(room_id,last_seen DESC);
-- Serving role: GRANT SELECT,INSERT ON bg_account_social.classic_room_presence;
-- GRANT UPDATE(last_seen) ON bg_account_social.classic_room_presence;
-- Do not grant runtime DELETE or unrestricted UPDATE/DDL.
