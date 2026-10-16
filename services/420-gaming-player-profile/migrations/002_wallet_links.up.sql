-- R05.2 additive-only schema. Run only by gaming_datastore_migrator after R05.1.
CREATE TABLE gaming_datastore.wallet_link_schema (
  version integer PRIMARY KEY CHECK(version=2),
  digest text NOT NULL CHECK(digest ~ '^[0-9a-f]{64}$')
);
GRANT SELECT ON gaming_datastore.wallet_link_schema TO gaming_datastore_runtime;
CREATE TABLE gaming_datastore.wallet_challenges (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  challenge_id gaming_datastore.opaque_id NOT NULL,
  wallet gaming_datastore.wallet NOT NULL,
  chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
  domain gaming_datastore.opaque_id NOT NULL,
  nonce text NOT NULL CHECK(nonce ~ '^[0-9a-f]{64}$'),
  consent_id gaming_datastore.opaque_id NOT NULL,
  recovery_authorized boolean NOT NULL DEFAULT false,
  issued_at gaming_datastore.uint64 NOT NULL,
  expires_at gaming_datastore.uint64 NOT NULL,
  used_at gaming_datastore.uint64,
  PRIMARY KEY(account_id,game_id,challenge_id),
  UNIQUE(game_id,domain,nonce),
  FOREIGN KEY(account_id,game_id) REFERENCES gaming_datastore.game_profiles(account_id,game_id),
  FOREIGN KEY(account_id,game_id,consent_id) REFERENCES gaming_datastore.consents(account_id,game_id,consent_id),
  CHECK(expires_at>issued_at AND expires_at<=issued_at+600),
  CHECK(used_at IS NULL OR used_at>=issued_at)
);
CREATE TABLE gaming_datastore.wallet_links (
  account_id gaming_datastore.opaque_id NOT NULL,
  game_id gaming_datastore.commitment NOT NULL,
  chain_id gaming_datastore.uint64 NOT NULL CHECK(chain_id>0),
  wallet gaming_datastore.wallet NOT NULL,
  challenge_id gaming_datastore.opaque_id NOT NULL,
  linked_at gaming_datastore.uint64 NOT NULL,
  unlinked_at gaming_datastore.uint64,
  PRIMARY KEY(account_id,game_id,chain_id,wallet,challenge_id),
  FOREIGN KEY(account_id,game_id,challenge_id) REFERENCES gaming_datastore.wallet_challenges(account_id,game_id,challenge_id),
  CHECK(unlinked_at IS NULL OR unlinked_at>=linked_at)
);
CREATE UNIQUE INDEX wallet_one_active_profile ON gaming_datastore.wallet_links(account_id,game_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX wallet_one_active_owner ON gaming_datastore.wallet_links(game_id,chain_id,wallet) WHERE unlinked_at IS NULL;
CREATE INDEX wallet_challenge_expiry ON gaming_datastore.wallet_challenges(account_id,game_id,expires_at);
ALTER TABLE gaming_datastore.wallet_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.wallet_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.wallet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.wallet_links FORCE ROW LEVEL SECURITY;
CREATE POLICY wallet_challenge_operator ON gaming_datastore.wallet_challenges TO gaming_datastore_migrator USING(true) WITH CHECK(true);
CREATE POLICY wallet_link_operator ON gaming_datastore.wallet_links TO gaming_datastore_migrator USING(true) WITH CHECK(true);
CREATE POLICY wallet_challenge_scoped ON gaming_datastore.wallet_challenges TO gaming_datastore_runtime
  USING(gaming_datastore.scope_matches(account_id,game_id)) WITH CHECK(gaming_datastore.scope_matches(account_id,game_id));
CREATE POLICY wallet_link_scoped ON gaming_datastore.wallet_links TO gaming_datastore_runtime
  USING(gaming_datastore.scope_matches(account_id,game_id)) WITH CHECK(gaming_datastore.scope_matches(account_id,game_id));
GRANT SELECT,INSERT ON gaming_datastore.wallet_challenges TO gaming_datastore_runtime;
GRANT UPDATE(used_at) ON gaming_datastore.wallet_challenges TO gaming_datastore_runtime;
GRANT SELECT,INSERT ON gaming_datastore.wallet_links TO gaming_datastore_runtime;
GRANT UPDATE(unlinked_at) ON gaming_datastore.wallet_links TO gaming_datastore_runtime;
CREATE FUNCTION gaming_datastore.guard_wallet_history() RETURNS trigger LANGUAGE plpgsql
  SET search_path=pg_catalog,gaming_datastore AS $$
BEGIN
  IF TG_TABLE_NAME='wallet_challenges' THEN
    IF (to_jsonb(NEW)-'used_at') IS DISTINCT FROM (to_jsonb(OLD)-'used_at')
       OR OLD.used_at IS NOT NULL OR NEW.used_at IS NULL
    THEN RAISE EXCEPTION 'wallet challenge immutable' USING ERRCODE='23514'; END IF;
  ELSE
    IF (to_jsonb(NEW)-'unlinked_at') IS DISTINCT FROM (to_jsonb(OLD)-'unlinked_at')
       OR OLD.unlinked_at IS NOT NULL OR NEW.unlinked_at IS NULL
    THEN RAISE EXCEPTION 'wallet link immutable' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_challenge BEFORE UPDATE ON gaming_datastore.wallet_challenges
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_wallet_history();
CREATE TRIGGER immutable_link BEFORE UPDATE ON gaming_datastore.wallet_links
  FOR EACH ROW EXECUTE FUNCTION gaming_datastore.guard_wallet_history();
