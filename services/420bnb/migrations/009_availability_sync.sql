-- BNB-2.3 calendar quantity closure and trusted external sync intake
ALTER TABLE bnb_block ADD COLUMN IF NOT EXISTS quantity integer CHECK(quantity>0);
CREATE TABLE IF NOT EXISTS bnb_calendar_sync_event(
 id uuid PRIMARY KEY,
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 unit_id uuid REFERENCES bnb_unit(id),
 external_issuer text NOT NULL,
 source_id text NOT NULL,
 external_event_id text NOT NULL,
 jti text NOT NULL,
 period tstzrange NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 source_updated_at timestamptz NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(external_issuer,jti),
 UNIQUE(external_issuer,source_id,external_event_id),
 CHECK(NOT isempty(period))
);
CREATE INDEX IF NOT EXISTS bnb_calendar_sync_overlap ON bnb_calendar_sync_event USING gist(property_id,period);
