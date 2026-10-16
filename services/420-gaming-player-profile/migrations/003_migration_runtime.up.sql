-- R05.3: additive-only, operator-owned durable migration application/outbox.
-- Runtime player roles have NO INSERT/UPDATE/DELETE rights on these tables.
CREATE TABLE gaming_datastore.migration_application_schema (
  version integer PRIMARY KEY CHECK(version=3),
  digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$')
);
CREATE TABLE gaming_datastore.migration_applications (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  migration_id gaming_datastore.opaque_id NOT NULL,
  chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
  registry gaming_datastore.wallet NOT NULL,
  claim_id gaming_datastore.uint64 NOT NULL CHECK(claim_id>0),
  source_commitment gaming_datastore.commitment NOT NULL,
  source_revision gaming_datastore.uint64 NOT NULL,
  payload_hash gaming_datastore.commitment NOT NULL,
  target_wallet gaming_datastore.wallet NOT NULL,
  target_grower gaming_datastore.uint64 NOT NULL CHECK(target_grower>0),
  source_state_hash gaming_datastore.commitment NOT NULL,
  destination_revision gaming_datastore.uint64 NOT NULL CHECK(destination_revision>0),
  evidence_digest gaming_datastore.commitment NOT NULL,
  applied_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  PRIMARY KEY (account_id,game_id,migration_id),
  UNIQUE(chain_id,registry,game_id,claim_id),
  UNIQUE(chain_id,registry,game_id,source_commitment,source_revision),
  UNIQUE(account_id,game_id,destination_revision),
  FOREIGN KEY(account_id,game_id,migration_id)
    REFERENCES gaming_datastore.migration_records(account_id,game_id,migration_id),
  FOREIGN KEY(account_id,game_id,destination_revision)
    REFERENCES gaming_datastore.save_references(account_id,game_id,revision)
);
CREATE TABLE gaming_datastore.migration_outbox (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  migration_id gaming_datastore.opaque_id NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','LEASED','SUBMITTED','RECONCILED','QUARANTINED','DEAD_LETTER')),
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 12),
  lease_token gaming_datastore.opaque_id,
  lease_until gaming_datastore.uint64,
  next_attempt_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  receipt_tx gaming_datastore.commitment,
  receipt_block gaming_datastore.commitment,
  receipt_digest gaming_datastore.commitment,
  changed_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  PRIMARY KEY(account_id,game_id,migration_id),
  FOREIGN KEY(account_id,game_id,migration_id)
    REFERENCES gaming_datastore.migration_applications(account_id,game_id,migration_id),
  CHECK ((status='LEASED' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    OR (status<>'LEASED' AND lease_token IS NULL AND lease_until IS NULL)),
  CHECK((receipt_tx IS NULL AND receipt_block IS NULL AND receipt_digest IS NULL) OR
    (receipt_tx IS NOT NULL AND receipt_block IS NOT NULL AND receipt_digest IS NOT NULL))
);
CREATE TABLE gaming_datastore.migration_receipt_history (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  migration_id gaming_datastore.opaque_id NOT NULL,
  sequence bigint NOT NULL CHECK(sequence>0),
  event text NOT NULL CHECK(event IN ('SUBMITTED','FINALIZED','REORG','MISMATCH','RETRY','DEAD_LETTER')),
  tx_hash gaming_datastore.commitment,
  block_hash gaming_datastore.commitment,
  receipt_digest gaming_datastore.commitment,
  recorded_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  PRIMARY KEY(account_id,game_id,migration_id,sequence),
  FOREIGN KEY(account_id,game_id,migration_id)
    REFERENCES gaming_datastore.migration_applications(account_id,game_id,migration_id)
);
CREATE INDEX migration_outbox_due ON gaming_datastore.migration_outbox(status,next_attempt_at,lease_until);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['migration_applications','migration_outbox','migration_receipt_history'] LOOP
    EXECUTE format('ALTER TABLE gaming_datastore.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE gaming_datastore.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY operator_migration ON gaming_datastore.%I TO gaming_datastore_migrator USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY scoped_migration_read ON gaming_datastore.%I FOR SELECT TO gaming_datastore_runtime USING(gaming_datastore.scope_matches(account_id,game_id))',t);
    EXECUTE format('GRANT SELECT ON gaming_datastore.%I TO gaming_datastore_runtime',t);
  END LOOP;
END $$;
GRANT SELECT ON gaming_datastore.migration_application_schema TO gaming_datastore_runtime;
CREATE FUNCTION gaming_datastore.guard_migration_application_immutable() RETURNS trigger
  LANGUAGE plpgsql SET search_path=pg_catalog,gaming_datastore AS $$
BEGIN
  RAISE EXCEPTION 'immutable migration application/receipt history' USING ERRCODE='23514';
END $$;
CREATE TRIGGER immutable_migration_application BEFORE UPDATE OR DELETE ON gaming_datastore.migration_applications
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_migration_application_immutable();
CREATE TRIGGER immutable_migration_receipt BEFORE UPDATE OR DELETE ON gaming_datastore.migration_receipt_history
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_migration_application_immutable();
