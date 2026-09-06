BEGIN;

CREATE TABLE IF NOT EXISTS indexed_blocks (
  block_number BIGINT PRIMARY KEY,
  block_hash TEXT NOT NULL UNIQUE,
  parent_hash TEXT,
  canonical BOOLEAN NOT NULL DEFAULT TRUE,
  finalized BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS event_journal (
  event_key TEXT PRIMARY KEY,
  block_number BIGINT NOT NULL,
  block_hash TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  module_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  UNIQUE (block_hash, tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS protocol_modules (
  module_key TEXT PRIMARY KEY,
  module_address TEXT NOT NULL,
  version INTEGER NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS creator_profiles (
  creator_id BIGINT PRIMARY KEY,
  account TEXT NOT NULL,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS works (
  work_id BIGINT PRIMARY KEY,
  rights_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recordings (
  recording_id BIGINT PRIMARY KEY,
  work_id BIGINT NOT NULL REFERENCES works(work_id),
  recording_class TEXT NOT NULL,
  parent_recording_id BIGINT,
  rights_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rights_versions (
  asset_type TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  rights_version INTEGER NOT NULL,
  PRIMARY KEY (asset_type, asset_id, rights_version)
);

CREATE TABLE IF NOT EXISTS rights_shares (
  asset_type TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  rights_version INTEGER NOT NULL,
  creator_id BIGINT NOT NULL,
  bps INTEGER NOT NULL CHECK (bps >= 0 AND bps <= 10000),
  PRIMARY KEY (asset_type, asset_id, rights_version, creator_id)
);

CREATE TABLE IF NOT EXISTS contributor_credits (
  credit_id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  creator_id BIGINT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS licenses (
  license_id BIGINT PRIMARY KEY,
  offer_id BIGINT NOT NULL,
  recording_id BIGINT NOT NULL,
  licensee_creator_id BIGINT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rights_transfers (
  transfer_id BIGINT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  from_creator_id BIGINT NOT NULL,
  to_creator_id BIGINT NOT NULL,
  bps INTEGER NOT NULL,
  resulting_rights_version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS royalty_pools (
  asset_type TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  total_received_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (asset_type, asset_id)
);

CREATE TABLE IF NOT EXISTS royalty_balances (
  asset_type TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  creator_id BIGINT NOT NULL,
  claimable_wei NUMERIC(78,0) NOT NULL DEFAULT 0,
  PRIMARY KEY (asset_type, asset_id, creator_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  settlement_id TEXT PRIMARY KEY,
  revenue_type TEXT NOT NULL,
  recording_id BIGINT,
  gross_wei NUMERIC(78,0) NOT NULL
);

CREATE TABLE IF NOT EXISTS projection_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

COMMIT;
