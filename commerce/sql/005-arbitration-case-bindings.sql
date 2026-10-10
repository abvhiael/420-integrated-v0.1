-- Arbitration remains an independent source of case and ruling truth.
-- These columns bind an optional, finalized external case; never create it.
ALTER TABLE dispute_requests ADD COLUMN arbitration_remedy_hash TEXT;
ALTER TABLE dispute_requests ADD COLUMN arbitration_case_id TEXT;
CREATE UNIQUE INDEX dispute_requests_arbitration_case_unique ON dispute_requests(arbitration_case_id) WHERE arbitration_case_id IS NOT NULL;
INSERT INTO migrations(version) VALUES(5);
