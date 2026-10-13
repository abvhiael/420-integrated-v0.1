-- Execute as gaming_datastore_migrator; runtime roles never own tables or DDL.
CREATE SCHEMA gaming_datastore AUTHORIZATION gaming_datastore_migrator;
REVOKE ALL ON SCHEMA gaming_datastore FROM PUBLIC;
GRANT USAGE ON SCHEMA gaming_datastore TO gaming_datastore_runtime;
CREATE DOMAIN gaming_datastore.uint64 AS numeric
  CHECK (VALUE = trunc(VALUE) AND VALUE >= 0 AND VALUE <= 18446744073709551615);
CREATE DOMAIN gaming_datastore.uint32 AS numeric
  CHECK (VALUE = trunc(VALUE) AND VALUE >= 0 AND VALUE <= 4294967295);
CREATE DOMAIN gaming_datastore.opaque_id AS text
  CHECK (VALUE ~ '^[A-Za-z0-9:_-]{1,128}$');
CREATE DOMAIN gaming_datastore.commitment AS text
  CHECK (VALUE ~ '^0x[0-9a-f]{64}$' AND VALUE <> ('0x' || repeat('0',64)));
CREATE DOMAIN gaming_datastore.wallet AS text
  CHECK (VALUE ~ '^0x[0-9a-f]{40}$' AND VALUE <> ('0x' || repeat('0',40)));
CREATE FUNCTION gaming_datastore.now_seconds() RETURNS numeric LANGUAGE sql STABLE
  SET search_path = pg_catalog AS $$ SELECT floor(extract(epoch FROM statement_timestamp())) $$;

CREATE TABLE gaming_datastore.schema_migrations (
  version integer PRIMARY KEY CHECK(version > 0),
  digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE gaming_datastore.accounts (
  account_id gaming_datastore.opaque_id PRIMARY KEY,
  issuer_ref gaming_datastore.opaque_id NOT NULL,
  credential_commitment gaming_datastore.commitment NOT NULL,
  auth_epoch gaming_datastore.uint64 NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','DISABLED')),
  created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds()
);
-- Provisioned DB roles establish scope. No SET LOCAL/request-variable policy.
CREATE TABLE gaming_datastore.runtime_scopes (
  role_name name PRIMARY KEY,
  account_id gaming_datastore.opaque_id NOT NULL REFERENCES gaming_datastore.accounts(account_id),
  game_id gaming_datastore.commitment NOT NULL
);
CREATE TABLE gaming_datastore.game_profiles (
  account_id gaming_datastore.opaque_id NOT NULL REFERENCES gaming_datastore.accounts(account_id),
  game_id gaming_datastore.commitment NOT NULL,
  profile_id gaming_datastore.opaque_id NOT NULL,
  ruleset_id gaming_datastore.commitment NOT NULL,
  authority_domain text NOT NULL DEFAULT 'REGISTERED_GAME_STATE'
    CHECK(authority_domain = 'REGISTERED_GAME_STATE'),
  save_revision gaming_datastore.uint64,
  version gaming_datastore.uint64 NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  updated_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  PRIMARY KEY(account_id,game_id), UNIQUE(game_id,profile_id)
);
CREATE TABLE gaming_datastore.save_schemas (
  game_id gaming_datastore.commitment NOT NULL,
  schema_label gaming_datastore.opaque_id NOT NULL,
  schema_number gaming_datastore.uint32 NOT NULL CHECK(schema_number > 0),
  PRIMARY KEY(game_id,schema_label), UNIQUE(game_id,schema_number)
);
CREATE TABLE gaming_datastore.consents (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  consent_id gaming_datastore.opaque_id NOT NULL,
  purpose text NOT NULL CHECK(purpose IN ('CLOUD_SAVE','WALLET_LINK','SAVE_MIGRATION','OBJECT_CANONICALIZATION')),
  policy_hash gaming_datastore.commitment NOT NULL,
  context_hash gaming_datastore.commitment NOT NULL,
  nonce_commitment gaming_datastore.commitment NOT NULL,
  expires_at gaming_datastore.uint64 NOT NULL,
  created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  revoked_at gaming_datastore.uint64,
  PRIMARY KEY(account_id,game_id,consent_id),
  UNIQUE(account_id,game_id,nonce_commitment),
  FOREIGN KEY(account_id,game_id) REFERENCES gaming_datastore.game_profiles(account_id,game_id),
  CHECK(expires_at > created_at), CHECK(revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE TABLE gaming_datastore.save_references (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  revision gaming_datastore.uint64 NOT NULL CHECK(revision > 0),
  schema_label gaming_datastore.opaque_id NOT NULL,
  ruleset_id gaming_datastore.commitment NOT NULL,
  state_hash gaming_datastore.commitment NOT NULL,
  provider_id gaming_datastore.opaque_id NOT NULL,
  object_ref gaming_datastore.opaque_id NOT NULL,
  byte_length gaming_datastore.uint64 NOT NULL CHECK(byte_length <= 67108864),
  consent_id gaming_datastore.opaque_id NOT NULL,
  created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  PRIMARY KEY(account_id,game_id,revision),
  FOREIGN KEY(account_id,game_id) REFERENCES gaming_datastore.game_profiles(account_id,game_id),
  FOREIGN KEY(account_id,game_id,consent_id) REFERENCES gaming_datastore.consents(account_id,game_id,consent_id),
  FOREIGN KEY(game_id,schema_label) REFERENCES gaming_datastore.save_schemas(game_id,schema_label)
);
ALTER TABLE gaming_datastore.game_profiles ADD CONSTRAINT head_reference
  FOREIGN KEY(account_id,game_id,save_revision)
  REFERENCES gaming_datastore.save_references(account_id,game_id,revision)
  DEFERRABLE INITIALLY DEFERRED;
-- R05.1 stores intent only. Chain/application/outbox transitions belong to R05.3/4.
CREATE TABLE gaming_datastore.migration_records (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  migration_id gaming_datastore.opaque_id NOT NULL,
  source_commitment gaming_datastore.commitment NOT NULL,
  source_revision gaming_datastore.uint64 NOT NULL,
  payload_hash gaming_datastore.commitment NOT NULL,
  policy_hash gaming_datastore.commitment NOT NULL,
  ruleset_id gaming_datastore.commitment NOT NULL,
  claim_schema_version gaming_datastore.uint32 NOT NULL CHECK(claim_schema_version > 0),
  chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id > 0),
  registry gaming_datastore.wallet NOT NULL,
  target_wallet gaming_datastore.wallet NOT NULL,
  target_grower gaming_datastore.uint64 NOT NULL CHECK(target_grower > 0),
  consent_id gaming_datastore.opaque_id NOT NULL,
  request_digest gaming_datastore.commitment NOT NULL,
  status text NOT NULL DEFAULT 'PREPARED' CHECK(status IN ('PREPARED','CANCELLED')),
  created_at gaming_datastore.uint64 NOT NULL DEFAULT gaming_datastore.now_seconds(),
  cancelled_at gaming_datastore.uint64,
  PRIMARY KEY(account_id,game_id,migration_id),
  UNIQUE(account_id,game_id,source_commitment,source_revision),
  FOREIGN KEY(account_id,game_id) REFERENCES gaming_datastore.game_profiles(account_id,game_id),
  FOREIGN KEY(account_id,game_id,consent_id) REFERENCES gaming_datastore.consents(account_id,game_id,consent_id),
  CHECK((status='PREPARED' AND cancelled_at IS NULL) OR
        (status='CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_at >= created_at))
);
CREATE INDEX migration_pending_scope ON gaming_datastore.migration_records(account_id,game_id,status);

CREATE FUNCTION gaming_datastore.scope_matches(a text,g text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog,gaming_datastore AS $$
  SELECT EXISTS(SELECT 1 FROM gaming_datastore.runtime_scopes
    WHERE role_name=current_user AND account_id=a AND (g IS NULL OR game_id=g))
$$;
ALTER TABLE gaming_datastore.runtime_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.runtime_scopes FORCE ROW LEVEL SECURITY;
CREATE POLICY scope_owner ON gaming_datastore.runtime_scopes TO gaming_datastore_migrator USING(true) WITH CHECK(true);
CREATE POLICY own_role ON gaming_datastore.runtime_scopes TO gaming_datastore_runtime
  USING(role_name=current_user);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts','game_profiles','save_schemas','consents','save_references','migration_records'] LOOP
    EXECUTE format('ALTER TABLE gaming_datastore.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE gaming_datastore.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY operator_policy ON gaming_datastore.%I TO gaming_datastore_migrator USING(true) WITH CHECK(true)',t);
    IF t='save_schemas' THEN
      EXECUTE format('CREATE POLICY runtime_scope ON gaming_datastore.%I TO gaming_datastore_runtime USING(EXISTS(SELECT 1 FROM gaming_datastore.runtime_scopes s WHERE s.role_name=current_user AND s.game_id=save_schemas.game_id))',t);
    ELSE
      EXECUTE format('CREATE POLICY runtime_scope ON gaming_datastore.%I TO gaming_datastore_runtime USING(gaming_datastore.scope_matches(account_id,%s)) WITH CHECK(gaming_datastore.scope_matches(account_id,%s))',t,
        CASE WHEN t='accounts' THEN 'NULL' ELSE 'game_id' END,
        CASE WHEN t='accounts' THEN 'NULL' ELSE 'game_id' END);
    END IF;
  END LOOP;
END $$;
GRANT SELECT ON ALL TABLES IN SCHEMA gaming_datastore TO gaming_datastore_runtime;
GRANT INSERT ON gaming_datastore.game_profiles,gaming_datastore.consents,
  gaming_datastore.save_references,gaming_datastore.migration_records TO gaming_datastore_runtime;
-- PostgreSQL row locks require an UPDATE privilege. The unconditional trigger below
-- forbids every runtime account update while allowing SELECT FOR SHARE.
GRANT UPDATE(created_at) ON gaming_datastore.accounts TO gaming_datastore_runtime;
GRANT UPDATE(save_revision,version,updated_at) ON gaming_datastore.game_profiles TO gaming_datastore_runtime;
GRANT UPDATE(revoked_at) ON gaming_datastore.consents TO gaming_datastore_runtime;
GRANT UPDATE(status,cancelled_at) ON gaming_datastore.migration_records TO gaming_datastore_runtime;

CREATE FUNCTION gaming_datastore.guard_history() RETURNS trigger LANGUAGE plpgsql
  SET search_path = pg_catalog,gaming_datastore AS $$
BEGIN
  IF TG_TABLE_NAME='consents' THEN
    IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
      OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
      THEN RAISE EXCEPTION 'immutable consent history' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='migration_records' THEN
    IF (to_jsonb(NEW)-'status'-'cancelled_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'cancelled_at')
      OR OLD.status='CANCELLED'
      OR NEW.status<>'CANCELLED'
      THEN RAISE EXCEPTION 'immutable migration history' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='game_profiles' THEN
    IF (to_jsonb(NEW)-'save_revision'-'version'-'updated_at') IS DISTINCT FROM
       (to_jsonb(OLD)-'save_revision'-'version'-'updated_at')
      OR NEW.save_revision IS DISTINCT FROM coalesce(OLD.save_revision,0)+1
      OR NEW.version IS DISTINCT FROM OLD.version+1
      OR NEW.updated_at<OLD.updated_at
      THEN RAISE EXCEPTION 'invalid profile revision' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_immutable BEFORE UPDATE ON gaming_datastore.consents
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_history();
CREATE TRIGGER migration_immutable BEFORE UPDATE ON gaming_datastore.migration_records
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_history();
CREATE TRIGGER profile_revision BEFORE UPDATE ON gaming_datastore.game_profiles
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_history();

CREATE FUNCTION gaming_datastore.guard_intent() RETURNS trigger LANGUAGE plpgsql
  SET search_path = pg_catalog,gaming_datastore AS $$
DECLARE c gaming_datastore.consents; r text;
BEGIN
  SELECT * INTO c FROM gaming_datastore.consents WHERE account_id=NEW.account_id
    AND game_id=NEW.game_id AND consent_id=NEW.consent_id FOR SHARE;
  SELECT ruleset_id INTO r FROM gaming_datastore.game_profiles
    WHERE account_id=NEW.account_id AND game_id=NEW.game_id FOR SHARE;
  IF c.consent_id IS NULL OR c.revoked_at IS NOT NULL OR c.expires_at<=gaming_datastore.now_seconds()
    OR r IS DISTINCT FROM NEW.ruleset_id
    OR (TG_TABLE_NAME='save_references' AND c.purpose<>'CLOUD_SAVE')
    THEN RAISE EXCEPTION 'invalid consent or ruleset' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='migration_records' THEN
    IF c.purpose<>'SAVE_MIGRATION' OR c.context_hash IS DISTINCT FROM NEW.request_digest
      OR c.policy_hash IS DISTINCT FROM NEW.policy_hash
      THEN RAISE EXCEPTION 'migration consent mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER save_consent BEFORE INSERT ON gaming_datastore.save_references
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_intent();
CREATE TRIGGER migration_consent BEFORE INSERT ON gaming_datastore.migration_records
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_intent();

CREATE FUNCTION gaming_datastore.account_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT pg_has_role(current_user,'gaming_datastore_migrator','MEMBER') THEN
    RAISE EXCEPTION 'operator account authority required' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER account_operator_only BEFORE UPDATE ON gaming_datastore.accounts
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.account_immutable();
