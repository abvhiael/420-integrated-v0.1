-- GEN-SVC-3.11.4 PostgreSQL migration 001. Apply using a migration role,
-- in a transaction, before enabling SQLTripRepository. Do not give the
-- Travel runtime database role permission to CREATE/ALTER/DROP tables.
BEGIN;
CREATE TABLE IF NOT EXISTS travel_trips (
 id text PRIMARY KEY,
 owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 256 AND owner_id = btrim(owner_id)),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
 visibility text NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE','UNLISTED','PUBLIC')),
 place_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(place_ids)='array'),
 event_ids jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(event_ids)='array'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT travel_trip_id_length CHECK (length(id) BETWEEN 1 AND 128)
);
CREATE INDEX IF NOT EXISTS travel_trips_owner_id_idx ON travel_trips (owner_id,id);
CREATE INDEX IF NOT EXISTS travel_trips_public_id_idx ON travel_trips (id) WHERE visibility='PUBLIC';
COMMIT;
