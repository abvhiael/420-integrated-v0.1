-- BNB-4.3 safe read model. Never determines authoritative booking capacity.
CREATE TABLE IF NOT EXISTS bnb_availability_projection (
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 unit_id uuid NOT NULL,
 window_start timestamptz NOT NULL,
 window_end timestamptz NOT NULL,
 property_version bigint NOT NULL CHECK(property_version >= 1),
 source_revision bigint NOT NULL CHECK(source_revision >= 0),
 source_digest text NOT NULL,
 available integer NOT NULL CHECK(available >= 0),
 calculated_at timestamptz NOT NULL DEFAULT now(),
 invalidated_at timestamptz,
 PRIMARY KEY(property_id,unit_id,window_start,window_end),
 CHECK(window_end>window_start)
);
CREATE INDEX IF NOT EXISTS bnb_projection_expiry_idx ON bnb_availability_projection(property_id,calculated_at)
 WHERE invalidated_at IS NULL;
