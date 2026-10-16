-- BNB-5.3 append-only upgrade. Do not fabricate acceptance for historical events.
ALTER TABLE bnb_outbox ADD COLUMN consumer_managed boolean NOT NULL DEFAULT false;
CREATE TABLE bnb_consumer_subscription (
 consumer text PRIMARY KEY CHECK (consumer ~ '^[a-z][a-z0-9_.-]{1,63}$'),
 revision bigint NOT NULL CHECK (revision>0), active boolean NOT NULL,
 event_types text[] NOT NULL CHECK (cardinality(event_types) BETWEEN 1 AND 32),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE bnb_consumer_subscription_history (
 consumer text NOT NULL REFERENCES bnb_consumer_subscription(consumer),
 revision bigint NOT NULL, active boolean NOT NULL, event_types text[] NOT NULL,
 actor text NOT NULL, changed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(consumer,revision)
);
CREATE TABLE bnb_consumer_delivery (
 event_id uuid NOT NULL REFERENCES bnb_outbox(id),
 consumer text NOT NULL REFERENCES bnb_consumer_subscription(consumer),
 subscription_revision bigint NOT NULL CHECK (subscription_revision>0),
 envelope_digest char(64) NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0),
 available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_owner text, lease_expires_at timestamptz,
 accepted_at timestamptz, receipt_digest char(64), completed_by text,
 dead_lettered_at timestamptz, failure_code text,
 PRIMARY KEY(event_id,consumer),
 CHECK ((lease_owner IS NULL)=(lease_expires_at IS NULL)),
 CHECK ((accepted_at IS NULL)=(receipt_digest IS NULL)),
 CHECK ((accepted_at IS NULL)=(completed_by IS NULL)),
 CHECK (accepted_at IS NULL OR dead_lettered_at IS NULL)
);
CREATE INDEX bnb_consumer_due ON bnb_consumer_delivery(consumer,available_at,event_id)
 WHERE accepted_at IS NULL AND dead_lettered_at IS NULL;
CREATE INDEX bnb_outbox_consumer_enrollment ON bnb_outbox(created_at,id)
 WHERE consumer_managed=false AND delivered_at IS NULL AND dead_lettered_at IS NULL;
