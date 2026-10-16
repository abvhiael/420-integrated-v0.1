-- L03.1 support/disputes: metadata only; evidence contents remain in a private vault.
CREATE TABLE liftd.support_cases (
 case_id text PRIMARY KEY CHECK(case_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
 opener_id text NOT NULL CHECK(opener_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 opener_account text NOT NULL CHECK(opener_account ~ '^[A-Za-z0-9_-]{1,128}$'),
 category text NOT NULL CHECK(category IN ('cancellation','no_show','fare','lost_property','incident')),
 status text NOT NULL CHECK(status IN ('OPEN','ESCALATED','DECIDED','APPEALED','CLOSED')),
 revision integer NOT NULL CHECK(revision>=0),
 created_at bigint NOT NULL CHECK(created_at>=0),
 retention_until bigint NOT NULL CHECK(retention_until>created_at),
 appeal_until bigint,
 decision text CHECK(decision IN ('upheld','denied','needs_action')),
 appeal_count integer NOT NULL DEFAULT 0 CHECK(appeal_count BETWEEN 0 AND 1),
 CHECK ((decision IS NULL) = (appeal_until IS NULL))
);
CREATE INDEX support_cases_trip_idx ON liftd.support_cases(trip_id,created_at);
CREATE TABLE liftd.support_commands (
 actor_id text NOT NULL,command_id text NOT NULL,
 case_id text NOT NULL REFERENCES liftd.support_cases(case_id),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL, PRIMARY KEY(actor_id,command_id),
 CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$' AND command_id ~ '^[A-Za-z0-9_-]{1,128}$')
);
CREATE TABLE liftd.support_events (
 case_id text NOT NULL REFERENCES liftd.support_cases(case_id),
 revision integer NOT NULL CHECK(revision>=0),
 action text NOT NULL CHECK(action IN ('open','evidence','escalate','decide','appeal','close')),
 actor_id text NOT NULL,
 evidence_digest text CHECK(evidence_digest ~ '^[a-f0-9]{64}$'),
 evidence_class text CHECK(evidence_class IN ('receipt','statement','property','incident')),
 recorded_at bigint NOT NULL CHECK(recorded_at>=0),
 PRIMARY KEY(case_id,revision),
 CHECK ((action='evidence')=(evidence_digest IS NOT NULL)),
 CHECK ((action='evidence')=(evidence_class IS NOT NULL))
);
CREATE TRIGGER immutable_support_events BEFORE UPDATE OR DELETE ON liftd.support_events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_support_commands BEFORE UPDATE OR DELETE ON liftd.support_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.support_cases,liftd.support_events,liftd.support_commands FROM PUBLIC;
