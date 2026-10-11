-- BNB-2.10 independent, expiring property/place bindings and jurisdiction decisions.
CREATE TABLE IF NOT EXISTS bnb_travel_place_binding (
 property_id uuid PRIMARY KEY REFERENCES bnb_property(id),
 place_id text NOT NULL CHECK(place_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 region text NOT NULL,
 country text NOT NULL,
 jurisdiction_id text NOT NULL CHECK(jurisdiction_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 marker_grid_lat integer CHECK(marker_grid_lat BETWEEN -90 AND 89),
 marker_grid_lon integer CHECK(marker_grid_lon BETWEEN -180 AND 179),
 CHECK((marker_grid_lat IS NULL) = (marker_grid_lon IS NULL)),
 issuer text NOT NULL,
 proof_jti text NOT NULL UNIQUE,
 proof_expires_at timestamptz NOT NULL,
 property_version bigint NOT NULL,
 revoked_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bnb_travel_place_binding_place
 ON bnb_travel_place_binding(place_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS bnb_travel_jurisdiction_policy (
 jurisdiction_id text PRIMARY KEY,
 decision text NOT NULL CHECK(decision IN ('allowed','prohibited')),
 issuer text NOT NULL,
 proof_jti text NOT NULL UNIQUE,
 effective_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 revision bigint NOT NULL CHECK(revision>0),
 CHECK(expires_at>effective_at)
);
