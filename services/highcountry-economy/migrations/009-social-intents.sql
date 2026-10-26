-- SOC-5B durable intent journal. Owner-only DDL; runtime privileges from scoped installer.
CREATE TABLE IF NOT EXISTS highcountry_social_intents (
 scope text NOT NULL,
 tx_hash text NOT NULL,
 principal text NOT NULL,
 wallet text NOT NULL,
 action text NOT NULL,
 raw_transaction text NOT NULL,
 state text NOT NULL DEFAULT 'prepared' CHECK (state IN ('prepared','broadcast','finalized','failed')),
 block_hash text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(scope,tx_hash),
 CHECK (length(scope) BETWEEN 1 AND 128),
 CHECK (tx_hash ~ '^0x[0-9a-f]{64}$'),
 CHECK (raw_transaction ~ '^0x[0-9a-f]+$')
);
CREATE INDEX IF NOT EXISTS highcountry_social_intents_owner_idx ON highcountry_social_intents(scope,principal,wallet);
REVOKE ALL ON highcountry_social_intents FROM PUBLIC;
ALTER TABLE highcountry_social_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE highcountry_social_intents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON highcountry_social_operations FROM PUBLIC;
ALTER TABLE highcountry_social_operations FORCE ROW LEVEL SECURITY;
