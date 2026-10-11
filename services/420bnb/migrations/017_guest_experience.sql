-- BNB-2.8 guest discovery and private interactions; no payment/publication authority.
CREATE TABLE IF NOT EXISTS bnb_guest_saved_stay (
 guest_subject text NOT NULL REFERENCES bnb_account(subject),
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(guest_subject,property_id)
);
CREATE TABLE IF NOT EXISTS bnb_guest_message (
 id uuid PRIMARY KEY,
 booking_request_id uuid NOT NULL REFERENCES bnb_booking_request(id),
 sender_subject text NOT NULL REFERENCES bnb_account(subject),
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now(),
 client_nonce text NOT NULL,
 UNIQUE(booking_request_id,sender_subject,client_nonce)
);
CREATE INDEX IF NOT EXISTS bnb_guest_message_request ON bnb_guest_message(booking_request_id,created_at,id);
CREATE TABLE IF NOT EXISTS bnb_guest_review (
 id uuid PRIMARY KEY,
 reservation_id uuid NOT NULL UNIQUE REFERENCES bnb_reservation(id),
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 guest_subject text NOT NULL REFERENCES bnb_account(subject),
 rating int NOT NULL CHECK(rating BETWEEN 1 AND 5),
 body text NOT NULL CHECK(char_length(body) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'pending_moderation' CHECK(status IN ('pending_moderation','approved','rejected','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bnb_guest_review_public ON bnb_guest_review(property_id,status);
CREATE TABLE IF NOT EXISTS bnb_guest_review_decision (
 issuer text NOT NULL,
 jti text NOT NULL,
 review_id uuid NOT NULL REFERENCES bnb_guest_review(id),
 decision text NOT NULL CHECK(decision IN ('approved','rejected','withdrawn')),
 decided_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(issuer,jti)
);
