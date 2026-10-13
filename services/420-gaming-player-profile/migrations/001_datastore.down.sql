-- Fail closed: a schema downgrade never discards player data, consent or replay history.
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM gaming_datastore.accounts)
    OR EXISTS(SELECT 1 FROM gaming_datastore.runtime_scopes)
    OR EXISTS(SELECT 1 FROM gaming_datastore.game_profiles)
    OR EXISTS(SELECT 1 FROM gaming_datastore.save_schemas)
    OR EXISTS(SELECT 1 FROM gaming_datastore.consents)
    OR EXISTS(SELECT 1 FROM gaming_datastore.save_references)
    OR EXISTS(SELECT 1 FROM gaming_datastore.migration_records)
    THEN RAISE EXCEPTION 'populated datastore downgrade denied' USING ERRCODE='23514';
  END IF;
END $$;
DROP SCHEMA gaming_datastore CASCADE;
