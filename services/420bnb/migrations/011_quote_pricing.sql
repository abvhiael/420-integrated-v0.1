-- BNB-2.4: price-plan revisions and immutable nonbinding guest quotes.
CREATE TABLE IF NOT EXISTS bnb_rate_plan (
 property_id uuid PRIMARY KEY REFERENCES bnb_property(id),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 seasonal_rates jsonb NOT NULL DEFAULT '[]'::jsonb,
 cleaning_minor bigint NOT NULL DEFAULT 0 CHECK(cleaning_minor>=0),
 service_minor bigint NOT NULL DEFAULT 0 CHECK(service_minor>=0),
 tax_bps integer NOT NULL DEFAULT 0 CHECK(tax_bps BETWEEN 0 AND 10000),
 discount_bps integer NOT NULL DEFAULT 0 CHECK(discount_bps BETWEEN 0 AND 10000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_price_quote (
 id uuid PRIMARY KEY,
 guest_subject text NOT NULL REFERENCES bnb_account(subject),
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 unit_id uuid REFERENCES bnb_unit(id),
 property_version bigint NOT NULL,
 rate_version bigint NOT NULL,
 period tstzrange NOT NULL,
 checkin date NOT NULL,
 checkout date NOT NULL,
 currency char(3) NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 calculation jsonb NOT NULL,
 policy_snapshot jsonb NOT NULL,
 snapshot_sha256 text NOT NULL CHECK(length(snapshot_sha256)=64),
 status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','revoked')),
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 nonce text NOT NULL,
 request_digest text NOT NULL,
 UNIQUE(guest_subject,nonce),
 CHECK(checkout>checkin),CHECK(NOT isempty(period))
);
CREATE INDEX IF NOT EXISTS bnb_price_quote_expiry ON bnb_price_quote(expires_at);
