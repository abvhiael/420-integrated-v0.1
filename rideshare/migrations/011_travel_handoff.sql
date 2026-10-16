CREATE TABLE liftd.travel_handoffs (
 handoff_id text PRIMARY KEY CHECK(handoff_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 actor_id text NOT NULL CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 account_id text NOT NULL CHECK(account_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 session_id text NOT NULL CHECK(session_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 command_id text NOT NULL CHECK(command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
 trip_revision bigint NOT NULL CHECK(trip_revision>=0),
 purpose text NOT NULL CHECK(purpose='travel_ground_connection'),
 expires_at bigint NOT NULL CHECK(expires_at>=0),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_at bigint NOT NULL CHECK(created_at>=0),
 UNIQUE(actor_id,command_id)
);
CREATE TRIGGER immutable_travel_handoffs BEFORE UPDATE OR DELETE ON liftd.travel_handoffs FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.travel_handoffs FROM PUBLIC;
