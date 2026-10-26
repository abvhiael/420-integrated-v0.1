-- SOC-5D recovery state and durable monotonic attempt audit.
CREATE TABLE IF NOT EXISTS highcountry_social_recovery_audit (
 scope text NOT NULL,
 tx_hash text NOT NULL,
 attempt bigint GENERATED ALWAYS AS IDENTITY,
 outcome text NOT NULL CHECK(outcome IN ('pending','broadcast','finalized','reverted','orphaned','rejected')),
 observed_block_hash text,
 observed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope,tx_hash,attempt),
 FOREIGN KEY(scope,tx_hash) REFERENCES highcountry_social_intents(scope,tx_hash)
);
ALTER TABLE highcountry_social_recovery_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE highcountry_social_recovery_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON highcountry_social_recovery_audit FROM PUBLIC;
ALTER TABLE highcountry_social_intents DROP CONSTRAINT IF EXISTS highcountry_social_intents_state_check;
ALTER TABLE highcountry_social_intents ADD CONSTRAINT highcountry_social_intents_state_check
 CHECK(state IN('prepared','broadcast','finalized','failed','orphaned'));
ALTER TABLE highcountry_social_operations DROP CONSTRAINT IF EXISTS highcountry_social_operations_state_check;
ALTER TABLE highcountry_social_operations ADD CONSTRAINT highcountry_social_operations_state_check
 CHECK(state IN('submitted','finalized','orphaned'));

ALTER TABLE highcountry_social_events ADD COLUMN IF NOT EXISTS canonical boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS highcountry_social_events_canonical_idx ON highcountry_social_events(scope,tx_hash) WHERE canonical;
