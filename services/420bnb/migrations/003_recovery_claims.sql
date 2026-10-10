-- Recovery epochs invalidate every previously issued BnB session atomically.
ALTER TABLE bnb_account ADD COLUMN IF NOT EXISTS recovery_epoch bigint NOT NULL DEFAULT 0;
ALTER TABLE bnb_identity_session ADD COLUMN IF NOT EXISTS recovery_epoch bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS bnb_property_claim (
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 subject text NOT NULL REFERENCES bnb_account(subject),
 external_issuer text NOT NULL, external_claim_id text NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','verified','revoked')),
 expires_at timestamptz NOT NULL, reviewed_at timestamptz,
 PRIMARY KEY(property_id,subject,external_issuer,external_claim_id)
);
-- The BnB API does not issue/verify property attestation; verified rows require
-- a future separately authorized ingest service, unavailable in this phase.
