-- BNB-2.4: financially nonbinding holds retain exact issued quote identity.
ALTER TABLE bnb_hold ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES bnb_price_quote(id);
CREATE UNIQUE INDEX IF NOT EXISTS bnb_hold_quote_one_use ON bnb_hold(quote_id) WHERE quote_id IS NOT NULL;
