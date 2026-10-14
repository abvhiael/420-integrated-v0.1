-- Server-owned account preferences. No sensitive data in ledger or event stream.
CREATE TABLE liftd.rider_preferences (
  account_id text PRIMARY KEY CHECK (account_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  revision bigint NOT NULL CHECK (revision >= 1),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(preferences) = 'object')
);
REVOKE ALL ON liftd.rider_preferences FROM PUBLIC;
