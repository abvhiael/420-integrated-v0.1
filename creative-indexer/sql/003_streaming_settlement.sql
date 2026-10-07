BEGIN;

-- HZ-4.4 application-facing projection of canonical streaming settlement state.
CREATE TABLE IF NOT EXISTS streaming_settlements (
  settlement_id TEXT PRIMARY KEY,
  playback_epoch BIGINT NOT NULL UNIQUE,
  playback_root TEXT NOT NULL,
  revenue_root TEXT NOT NULL,
  total_play_count NUMERIC(78,0) NOT NULL CHECK (total_play_count > 0),
  total_qualified_ms NUMERIC(78,0) NOT NULL CHECK (total_qualified_ms > 0),
  gross_revenue NUMERIC(78,0) NOT NULL CHECK (gross_revenue > 0),
  state TEXT NOT NULL CHECK (state IN ('COMMITTED','FINALIZED')),
  committed_block BIGINT NOT NULL,
  finalized_block BIGINT,
  allocation_root TEXT,
  recording_count INTEGER,
  allocated_revenue NUMERIC(78,0),
  routed_revenue NUMERIC(78,0) NOT NULL DEFAULT 0 CHECK (routed_revenue >= 0),
  CHECK (
    (allocation_root IS NULL AND recording_count IS NULL AND allocated_revenue IS NULL)
    OR
    (allocation_root IS NOT NULL AND recording_count IS NOT NULL AND recording_count > 0 AND allocated_revenue IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS streaming_recording_allocations (
  settlement_id TEXT NOT NULL REFERENCES streaming_settlements(settlement_id) ON DELETE CASCADE,
  recording_id NUMERIC(78,0) NOT NULL,
  play_count NUMERIC(78,0) NOT NULL CHECK (play_count > 0),
  qualified_ms NUMERIC(78,0) NOT NULL CHECK (qualified_ms > 0),
  revenue NUMERIC(78,0) NOT NULL CHECK (revenue > 0),
  routed BOOLEAN NOT NULL DEFAULT FALSE,
  route_settlement_id TEXT,
  routed_block BIGINT,
  PRIMARY KEY (settlement_id, recording_id),
  CHECK (
    (routed = FALSE AND route_settlement_id IS NULL AND routed_block IS NULL)
    OR
    (routed = TRUE AND route_settlement_id IS NOT NULL AND routed_block IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS streaming_allocations_recording_idx
  ON streaming_recording_allocations(recording_id, settlement_id);

COMMIT;
