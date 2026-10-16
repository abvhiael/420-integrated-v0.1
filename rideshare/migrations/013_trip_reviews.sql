-- L03.2: completed-trip interaction only; moderation is not transport authorization.
CREATE TABLE liftd.trip_reviews (
 review_id text PRIMARY KEY CHECK(review_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
 author_id text NOT NULL CHECK(author_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 author_account text NOT NULL CHECK(author_account ~ '^[A-Za-z0-9_-]{1,128}$'),
 author_role text NOT NULL CHECK(author_role IN ('rider','driver')),
 subject_id text NOT NULL CHECK(subject_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 subject_role text NOT NULL CHECK(subject_role IN ('rider','driver')),
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 moderation text NOT NULL DEFAULT 'PENDING' CHECK(moderation IN ('PENDING','APPROVED','HIDDEN','REJECTED')),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at bigint NOT NULL CHECK(created_at>=0),
 UNIQUE(trip_id,author_role),
 CHECK(author_role<>subject_role AND author_id<>subject_id)
);
CREATE TABLE liftd.review_commands (
 actor_id text NOT NULL CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 command_id text NOT NULL CHECK(command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 review_id text NOT NULL REFERENCES liftd.trip_reviews(review_id),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL,
 PRIMARY KEY(actor_id,command_id)
);
CREATE TABLE liftd.review_events (
 review_id text NOT NULL REFERENCES liftd.trip_reviews(review_id),
 revision integer NOT NULL CHECK(revision>=0),
 action text NOT NULL CHECK(action IN ('submit','approve','hide','reject')),
 actor_id text NOT NULL CHECK(actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 recorded_at bigint NOT NULL CHECK(recorded_at>=0),
 PRIMARY KEY(review_id,revision)
);
CREATE TRIGGER immutable_review_events BEFORE UPDATE OR DELETE ON liftd.review_events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_review_commands BEFORE UPDATE OR DELETE ON liftd.review_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.trip_reviews,liftd.review_commands,liftd.review_events FROM PUBLIC;
CREATE INDEX trip_reviews_subject_idx ON liftd.trip_reviews(subject_role,subject_id,moderation);
