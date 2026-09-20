-- GEN-SVC-3.11.7: apply with a separate migration role before enabling claims.
BEGIN;
CREATE TABLE IF NOT EXISTS travel_business_claims (
 id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
 place_id text NOT NULL CHECK (length(place_id) BETWEEN 1 AND 128),
 claimant_id text NOT NULL CHECK (length(claimant_id) BETWEEN 1 AND 256 AND claimant_id = btrim(claimant_id)),
 registry_record_id text NOT NULL CHECK (length(registry_record_id) BETWEEN 1 AND 256),
 evidence_ref text NOT NULL CHECK (length(evidence_ref) BETWEEN 1 AND 512),
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','REVOKED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX IF NOT EXISTS travel_business_claims_active_claimant_place_idx ON travel_business_claims (claimant_id,place_id) WHERE status IN ('PENDING','APPROVED');
CREATE INDEX IF NOT EXISTS travel_business_claims_owner_idx ON travel_business_claims (claimant_id,id);
CREATE TABLE IF NOT EXISTS travel_business_claim_decisions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 claim_id text NOT NULL REFERENCES travel_business_claims(id) ON DELETE RESTRICT,
 reviewer_id text NOT NULL CHECK (length(reviewer_id) BETWEEN 1 AND 256),
 previous_status text NOT NULL,
 next_status text NOT NULL CHECK (next_status IN ('APPROVED','REJECTED','REVOKED')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS travel_business_claim_decisions_claim_idx ON travel_business_claim_decisions (claim_id,id);
COMMIT;
