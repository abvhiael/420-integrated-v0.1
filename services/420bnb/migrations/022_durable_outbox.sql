-- BNB-4.2 crash-safe delivery state; original outbox admission unchanged.
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS lease_owner text;
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS failure_code text;
ALTER TABLE bnb_outbox ADD COLUMN IF NOT EXISTS delivered_by text;
ALTER TABLE bnb_outbox ADD CONSTRAINT bnb_outbox_attempts_valid CHECK (attempts >= 0);
CREATE INDEX IF NOT EXISTS bnb_outbox_pending_delivery ON bnb_outbox (available_at,created_at,id)
 WHERE delivered_at IS NULL AND dead_lettered_at IS NULL;
CREATE TABLE IF NOT EXISTS bnb_outbox_receipt (
 event_id uuid NOT NULL REFERENCES bnb_outbox(id), consumer text NOT NULL,
 accepted_at timestamptz NOT NULL DEFAULT now(), receipt_digest text NOT NULL,
 PRIMARY KEY (event_id, consumer)
);
