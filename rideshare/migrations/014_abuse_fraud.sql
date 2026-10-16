-- L03.3 abuse/fraud: allegations are not independent identity, eligibility, or payment authority.
CREATE TABLE liftd.fraud_cases (
 case_id text PRIMARY KEY CHECK(case_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
 reporter_id text NOT NULL CHECK(reporter_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 reporter_role text NOT NULL CHECK(reporter_role IN ('rider','driver','operator')),
 category text NOT NULL CHECK(category IN ('account_misuse','fabricated_trip','location_manipulation','coordinated_reviews','economic_replay')),
 evidence_digest text NOT NULL CHECK(evidence_digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN ('OPEN','HELD','CLEARED','APPEALED','CLOSED')),
 revision integer NOT NULL CHECK(revision>=0),
 decision text CHECK(decision IN ('hold','clear','release')),
 hold_until bigint,
 appeal_count smallint NOT NULL DEFAULT 0 CHECK(appeal_count BETWEEN 0 AND 1),
 created_at bigint NOT NULL CHECK(created_at>=0),
 updated_at bigint NOT NULL CHECK(updated_at>=created_at),
 CHECK (status<>'HELD' OR hold_until IS NOT NULL),
 CHECK (hold_until IS NULL OR status IN ('HELD','APPEALED')),
 CHECK (hold_until IS NULL OR hold_until>created_at)
);
CREATE INDEX fraud_cases_trip_status ON liftd.fraud_cases(trip_id,status,hold_until);
CREATE TABLE liftd.fraud_commands (
 actor_id text NOT NULL CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 command_id text NOT NULL CHECK(command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 case_id text NOT NULL REFERENCES liftd.fraud_cases(case_id),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL,
 PRIMARY KEY(actor_id,command_id)
);
CREATE TABLE liftd.fraud_events (
 case_id text NOT NULL REFERENCES liftd.fraud_cases(case_id),
 revision integer NOT NULL CHECK(revision>=0),
 action text NOT NULL CHECK(action IN ('report','hold','clear','release','appeal','close')),
 actor_id text NOT NULL CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 event_digest text NOT NULL CHECK(event_digest ~ '^[a-f0-9]{64}$'),
 recorded_at bigint NOT NULL CHECK(recorded_at>=0),
 PRIMARY KEY(case_id,revision)
);
CREATE TRIGGER immutable_fraud_events BEFORE UPDATE OR DELETE ON liftd.fraud_events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_fraud_commands BEFORE UPDATE OR DELETE ON liftd.fraud_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.fraud_cases,liftd.fraud_commands,liftd.fraud_events FROM PUBLIC;
