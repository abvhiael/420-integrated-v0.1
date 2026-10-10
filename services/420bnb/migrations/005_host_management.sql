-- BNB-2.2: draft unit inventory, review requests and host calendar.
-- No self-issued approval or publication path.
CREATE TABLE IF NOT EXISTS bnb_unit (
 id uuid PRIMARY KEY,
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 label text NOT NULL CHECK (length(label) BETWEEN 1 AND 100),
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
 version bigint NOT NULL DEFAULT 1 CHECK (version>0),
 UNIQUE(property_id,label)
);
CREATE TABLE IF NOT EXISTS bnb_listing_review (
 id uuid PRIMARY KEY,
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 requested_by text NOT NULL REFERENCES bnb_account(subject),
 property_version bigint NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','withdrawn','rejected','approved')),
 snapshot jsonb NOT NULL,
 snapshot_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 reviewer_authority text,
 CHECK (state='pending' OR state='withdrawn' OR
       (decided_at IS NOT NULL AND reviewer_authority IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bnb_listing_review_one_pending
 ON bnb_listing_review(property_id) WHERE state='pending';
ALTER TABLE bnb_block ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES bnb_unit(id);
ALTER TABLE bnb_block ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE bnb_block ADD COLUMN IF NOT EXISTS property_version bigint;
CREATE INDEX IF NOT EXISTS bnb_block_unit_interval ON bnb_block USING gist(unit_id,period);
