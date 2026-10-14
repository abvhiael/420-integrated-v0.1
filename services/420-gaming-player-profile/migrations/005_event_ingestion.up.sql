-- R05.6 append-only canonical and reversible nonfinal Gaming log projection.
CREATE TABLE gaming_datastore.event_ingestion_schema (
 version integer PRIMARY KEY CHECK(version=6),
 digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$')
);
CREATE TABLE gaming_datastore.event_cursors (
 chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
 contract gaming_datastore.wallet NOT NULL,
 next_block gaming_datastore.uint64 NOT NULL,
 anchor_hash gaming_datastore.commitment,
 updated_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
 PRIMARY KEY(chain_id,contract)
);
CREATE TABLE gaming_datastore.event_blocks (
 chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
 contract gaming_datastore.wallet NOT NULL,
 block_number gaming_datastore.uint64 NOT NULL,
 block_hash gaming_datastore.commitment NOT NULL,
 parent_hash gaming_datastore.commitment NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','FINALIZED','ORPHANED')),
 PRIMARY KEY(chain_id,contract,block_hash),
 UNIQUE(chain_id,contract,block_number,block_hash)
);
CREATE INDEX event_blocks_height ON gaming_datastore.event_blocks(chain_id,contract,block_number,status);
CREATE TABLE gaming_datastore.event_logs (
 chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
 contract gaming_datastore.wallet NOT NULL,
 block_number gaming_datastore.uint64 NOT NULL,
 block_hash gaming_datastore.commitment NOT NULL,
 parent_hash gaming_datastore.commitment NOT NULL,
 tx_hash gaming_datastore.commitment NOT NULL,
 tx_index gaming_datastore.uint32 NOT NULL,
 log_index gaming_datastore.uint32 NOT NULL,
 topic0 gaming_datastore.commitment NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN (
 'MigrationClaimIssued','MigrationClaimConsumed','MigrationClaimCancelled',
 'GrowerGamingProfileBound','MigrationClaimBound','MigrationApplied')),
 claim_id gaming_datastore.commitment,
 game_id gaming_datastore.commitment,
 grower_id gaming_datastore.uint64,
 game_profile_id gaming_datastore.commitment,
 target_wallet gaming_datastore.wallet,
 payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','FINALIZED','ORPHANED')),
 inserted_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
 PRIMARY KEY(chain_id,contract,block_hash,log_index),
 CHECK(jsonb_typeof(payload)='object')
);
CREATE TABLE gaming_datastore.event_reorg_history (
 chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
 contract gaming_datastore.wallet NOT NULL,
 recovery_id gaming_datastore.opaque_id NOT NULL,
 old_next_block gaming_datastore.uint64 NOT NULL,
 previous_anchor gaming_datastore.commitment NOT NULL,
 ancestor_number gaming_datastore.uint64 NOT NULL,
 ancestor_hash gaming_datastore.commitment NOT NULL,
 recorded_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
 PRIMARY KEY(chain_id,contract,recovery_id)
);
CREATE TABLE gaming_datastore.event_scopes (
 chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
 contract gaming_datastore.wallet NOT NULL,
 block_hash gaming_datastore.commitment NOT NULL,
 log_index gaming_datastore.uint32 NOT NULL,
 account_id gaming_datastore.opaque_id NOT NULL,
 game_id gaming_datastore.commitment NOT NULL,
 PRIMARY KEY(chain_id,contract,block_hash,log_index,account_id,game_id),
 FOREIGN KEY(chain_id,contract,block_hash,log_index)
 REFERENCES gaming_datastore.event_logs(chain_id,contract,block_hash,log_index)
);
CREATE INDEX event_log_height ON gaming_datastore.event_logs(chain_id,contract,block_number,status);
CREATE INDEX event_scope_view ON gaming_datastore.event_scopes(account_id,game_id,chain_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['event_cursors','event_blocks','event_logs','event_scopes','event_reorg_history'] LOOP
  EXECUTE format('ALTER TABLE gaming_datastore.%I OWNER TO gaming_datastore_migrator',t);
  EXECUTE format('ALTER TABLE gaming_datastore.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE gaming_datastore.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY r056_operator ON gaming_datastore.%I TO gaming_datastore_migrator USING (true) WITH CHECK(true)',t);
 END LOOP;
END $$;
-- Player roles cannot enumerate chain-wide event history or change indexer state.
CREATE POLICY r056_scope_event_read ON gaming_datastore.event_scopes FOR SELECT TO gaming_datastore_runtime
 USING(gaming_datastore.scope_matches(account_id,game_id));
GRANT SELECT ON gaming_datastore.event_scopes TO gaming_datastore_runtime;
-- Event rows are readable only through the authorized scoped service's operator-controlled query.

-- Reorg audit history is append-only, including if a previously orphaned fork reappears.
CREATE FUNCTION gaming_datastore.reject_event_history_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'event recovery audit immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_event_reorg_history BEFORE UPDATE OR DELETE ON gaming_datastore.event_reorg_history
 FOR EACH ROW EXECUTE FUNCTION gaming_datastore.reject_event_history_changes();
