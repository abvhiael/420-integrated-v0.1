-- BNB-2.2 draft policy and media provenance. No authority to publish.
CREATE TABLE IF NOT EXISTS bnb_listing_policy (
  property_id uuid PRIMARY KEY REFERENCES bnb_property(id),
  house_rules text NOT NULL CHECK(length(house_rules) BETWEEN 1 AND 4000),
  cancellation_policy text NOT NULL CHECK(length(cancellation_policy) BETWEEN 1 AND 4000),
  timezone_id text NOT NULL
);
CREATE TABLE IF NOT EXISTS bnb_listing_media (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES bnb_property(id),
  asset_url text NOT NULL,
  alt_text text NOT NULL CHECK(length(alt_text)>=8),
  rights_statement text NOT NULL CHECK(length(rights_statement)>=8),
  moderation_state text NOT NULL DEFAULT 'pending'
    CHECK(moderation_state IN ('pending','approved','rejected','revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);
