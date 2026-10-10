-- Independent media review anti-replay. No issuer authorization originates in BnB.
CREATE TABLE IF NOT EXISTS bnb_media_review_nonce (
 issuer text NOT NULL, jti text NOT NULL,
 media_id uuid NOT NULL REFERENCES bnb_listing_media(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(issuer,jti)
);
