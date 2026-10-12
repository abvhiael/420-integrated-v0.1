-- BNB-2.5: reservation requests without self-issued financial finality.
CREATE TABLE IF NOT EXISTS bnb_booking_policy (
 property_id uuid PRIMARY KEY REFERENCES bnb_property(id),
 instant_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_booking_request (
 id uuid PRIMARY KEY,
 hold_id uuid NOT NULL UNIQUE REFERENCES bnb_hold(id),
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 guest_subject text NOT NULL REFERENCES bnb_account(subject),
 host_subject text NOT NULL,
 request_type text NOT NULL CHECK(request_type IN ('request','instant')),
 state text NOT NULL CHECK(state IN ('requested','accepted','declined','withdrawn','expired')),
 deadline timestamptz NOT NULL,
 expected_quote_id uuid REFERENCES bnb_price_quote(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 version bigint NOT NULL DEFAULT 1 CHECK(version>0)
);
ALTER TABLE bnb_reservation ADD COLUMN IF NOT EXISTS booking_request_id uuid UNIQUE REFERENCES bnb_booking_request(id);
ALTER TABLE bnb_reservation ADD COLUMN IF NOT EXISTS policy_snapshot text;
ALTER TABLE bnb_reservation ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES bnb_price_quote(id);
ALTER TABLE bnb_reservation ADD COLUMN IF NOT EXISTS booking_public_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS bnb_reservation_booking_public_id ON bnb_reservation(booking_public_id) WHERE booking_public_id IS NOT NULL;
