-- Explicit bounded minimum-stay rule, private policy authority.
ALTER TABLE bnb_listing_policy ADD COLUMN IF NOT EXISTS min_nights integer NOT NULL DEFAULT 1 CHECK(min_nights BETWEEN 1 AND 90);
