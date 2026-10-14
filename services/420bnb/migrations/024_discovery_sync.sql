-- BNB-4.4 local authorized Search/Travel projection and monotone receipts.
CREATE TABLE IF NOT EXISTS bnb_discovery_projection (
 property_id uuid PRIMARY KEY REFERENCES bnb_property(id),
 revision bigint NOT NULL CHECK(revision>0),
 source_digest text NOT NULL,
 payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_discovery_consumer (
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 consumer text NOT NULL CHECK(consumer IN ('search','travel')),
 revision bigint NOT NULL CHECK(revision>0),
 payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(property_id,consumer)
);
