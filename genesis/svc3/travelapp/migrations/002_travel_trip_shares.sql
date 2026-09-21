-- GEN-SVC-3.11.6: deploy with migration role after 001_travel_trips.sql.
-- Runtime role: SELECT/INSERT/DELETE on travel_trip_shares only; no DDL.
BEGIN;
CREATE TABLE IF NOT EXISTS travel_trip_shares (
 token_hash text PRIMARY KEY CHECK (length(token_hash)=64 AND token_hash ~ '^[0-9a-f]{64}$'),
 trip_id text NOT NULL REFERENCES travel_trips(id) ON DELETE CASCADE,
 owner_id text NOT NULL CHECK (length(owner_id) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS travel_trip_shares_owner_trip_idx ON travel_trip_shares (owner_id, trip_id);
CREATE INDEX IF NOT EXISTS travel_trip_shares_expiry_idx ON travel_trip_shares (expires_at);
COMMIT;
