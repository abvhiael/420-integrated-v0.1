-- BNB runtime v1: transactional inventory, no canonical financial authority.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS bnb_property (
 id uuid PRIMARY KEY, host_subject text NOT NULL, title text NOT NULL,
 public_region text NOT NULL, private_address text, status text NOT NULL DEFAULT 'draft'
 CHECK(status IN ('draft','published','suspended')), capacity integer NOT NULL CHECK(capacity>0),
 nightly_minor bigint NOT NULL CHECK(nightly_minor>=0), currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_block (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES bnb_property(id),
 period tstzrange NOT NULL, reason text NOT NULL, CHECK (NOT isempty(period))
);
CREATE TABLE IF NOT EXISTS bnb_hold (
 id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES bnb_property(id),
 guest_subject text NOT NULL, period tstzrange NOT NULL, units integer NOT NULL DEFAULT 1 CHECK(units>0),
 status text NOT NULL CHECK(status IN ('held','expired','cancelled','confirmed')),
 expires_at timestamptz NOT NULL, quote_total_minor bigint NOT NULL CHECK(quote_total_minor>=0),
 policy_snapshot text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT isempty(period))
);
CREATE INDEX IF NOT EXISTS bnb_hold_active_period_idx ON bnb_hold USING gist (property_id,period);
CREATE TABLE IF NOT EXISTS bnb_reservation (
 id uuid PRIMARY KEY, hold_id uuid UNIQUE NOT NULL REFERENCES bnb_hold(id),
 property_id uuid NOT NULL REFERENCES bnb_property(id), guest_subject text NOT NULL,
 status text NOT NULL CHECK(status IN ('payment_pending','confirmed','cancelled','recovery_required')),
 pay_proof_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_request_dedupe (
 actor text NOT NULL, operation text NOT NULL, key text NOT NULL,
 digest text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor,operation,key)
);
CREATE TABLE IF NOT EXISTS bnb_outbox (
 id uuid PRIMARY KEY, event_type text NOT NULL, payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE TABLE IF NOT EXISTS bnb_audit (
 id uuid PRIMARY KEY, subject text NOT NULL, action text NOT NULL,
 resource_id uuid, happened_at timestamptz NOT NULL DEFAULT now()
);
-- All inventory writes must lock the property row and revalidate overlap/capacity
-- in the same transaction. Confirming Pay finality is NEVER a client-driven action.
