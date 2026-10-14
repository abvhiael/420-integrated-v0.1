-- R05.9 fail-closed durable multi-instance abuse quotas.
CREATE TABLE gaming_datastore.abuse_schema (
 version integer PRIMARY KEY CHECK(version=9),
 digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$')
);
CREATE TABLE gaming_datastore.abuse_buckets (
 scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'),
 slot bigint NOT NULL CHECK(slot>=0),
 count integer NOT NULL CHECK(count>0 AND count<=300),
 PRIMARY KEY(scope_digest,slot)
);
CREATE INDEX abuse_bucket_retention ON gaming_datastore.abuse_buckets(slot);
ALTER TABLE gaming_datastore.abuse_buckets OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.abuse_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.abuse_buckets FORCE ROW LEVEL SECURITY;
CREATE POLICY r059_operator ON gaming_datastore.abuse_buckets TO gaming_datastore_migrator
 USING(true) WITH CHECK(true);
-- Never grant runtime player roles direct access to rate-limit counters.

CREATE TABLE gaming_datastore.gameplay_replay_guard (
 scope_digest text NOT NULL CHECK(scope_digest ~ '^[0-9a-f]{64}$'),
 nonce_digest text NOT NULL CHECK(nonce_digest ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_digest,nonce_digest)
);
CREATE INDEX gameplay_replay_expiry ON gaming_datastore.gameplay_replay_guard(created_at);
ALTER TABLE gaming_datastore.gameplay_replay_guard OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.gameplay_replay_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.gameplay_replay_guard FORCE ROW LEVEL SECURITY;
CREATE POLICY r059_gameplay_operator ON gaming_datastore.gameplay_replay_guard
 TO gaming_datastore_migrator USING(true) WITH CHECK(true);
