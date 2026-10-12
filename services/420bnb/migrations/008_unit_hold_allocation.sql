-- Unit-specific nonbinding inventory hold, legacy pre-unit holds remain property-scoped.
ALTER TABLE bnb_hold ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES bnb_unit(id);
CREATE INDEX IF NOT EXISTS bnb_hold_unit_period ON bnb_hold USING gist(unit_id,period);
