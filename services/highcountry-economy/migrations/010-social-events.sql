-- SOC-5C canonical social events. Only signed transactions with independently
-- verified finalized receipts may be added by the trusted indexer.
CREATE TABLE IF NOT EXISTS highcountry_social_events (
 scope text NOT NULL,
 tx_hash text NOT NULL,
 log_index bigint NOT NULL CHECK (log_index >= 0),
 block_number bigint NOT NULL CHECK (block_number >= 0),
 block_hash text NOT NULL CHECK (block_hash ~ '^0x[0-9a-f]{64}$'),
 contract_address text NOT NULL CHECK (contract_address ~ '^0x[0-9a-f]{40}$'),
 topic0 text NOT NULL CHECK (topic0 ~ '^0x[0-9a-f]{64}$'),
 kind text NOT NULL CHECK (kind IN ('organization','cooperative','proposal','permission')),
 entity_id text NOT NULL CHECK (entity_id ~ '^0x[0-9a-f]{64}$'),
 principal text NOT NULL,
 wallet text NOT NULL CHECK (wallet ~ '^0x[0-9a-f]{40}$'),
 event_json jsonb NOT NULL,
 PRIMARY KEY (scope,tx_hash,log_index),
 FOREIGN KEY (scope,tx_hash) REFERENCES highcountry_social_intents(scope,tx_hash)
);
CREATE INDEX IF NOT EXISTS highcountry_social_events_private_history
 ON highcountry_social_events(scope,principal,wallet,kind,entity_id,block_number,log_index);
REVOKE ALL ON highcountry_social_events FROM PUBLIC;
ALTER TABLE highcountry_social_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE highcountry_social_events FORCE ROW LEVEL SECURITY;
