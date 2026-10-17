-- L03.5: metadata-only privacy requests; immutable incident and financial evidence is not silently erased.
CREATE TABLE liftd.privacy_requests (
 request_id text PRIMARY KEY CHECK(request_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
 subject_id text NOT NULL CHECK(subject_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 subject_role text NOT NULL CHECK(subject_role IN ('rider','driver')),
 request_type text NOT NULL CHECK(request_type IN ('access','export','deletion')),
 status text NOT NULL CHECK(status IN ('OPEN','BLOCKED_HOLD','FULFILLED','DENIED')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 requested_at bigint NOT NULL CHECK(requested_at>=0),
 due_at bigint NOT NULL CHECK(due_at>requested_at),
 resolved_at bigint CHECK(resolved_at>=requested_at),
 outcome_digest text CHECK(outcome_digest ~ '^[a-f0-9]{64}$'),
 reason text CHECK(reason IN ('retained_incident','financial_record','subject_mismatch','completed')),
 CHECK((status IN ('FULFILLED','DENIED'))=(resolved_at IS NOT NULL))
);
CREATE INDEX privacy_requests_subject_idx ON liftd.privacy_requests(subject_id,requested_at);
CREATE TABLE liftd.privacy_commands (
 actor_id text NOT NULL,command_id text NOT NULL,request_id text NOT NULL REFERENCES liftd.privacy_requests(request_id),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),response jsonb NOT NULL,
 PRIMARY KEY(actor_id,command_id),
 CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$' AND command_id ~ '^[A-Za-z0-9_-]{1,128}$')
);
CREATE TABLE liftd.privacy_events (
 request_id text NOT NULL REFERENCES liftd.privacy_requests(request_id),
 revision integer NOT NULL CHECK(revision>=0),
 action text NOT NULL CHECK(action IN ('request','fulfill','hold','deny')),
 actor_id text NOT NULL,
 event_digest text NOT NULL CHECK(event_digest ~ '^[a-f0-9]{64}$'),
 recorded_at bigint NOT NULL CHECK(recorded_at>=0),
 PRIMARY KEY(request_id,revision)
);
CREATE TRIGGER immutable_privacy_commands BEFORE UPDATE OR DELETE ON liftd.privacy_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_privacy_events BEFORE UPDATE OR DELETE ON liftd.privacy_events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.privacy_requests,liftd.privacy_commands,liftd.privacy_events FROM PUBLIC;
