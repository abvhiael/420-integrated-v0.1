-- BNB-2.11 retained guest-review/reputation/message abuse extension.
CREATE TABLE IF NOT EXISTS bnb_review_host_response (
 review_id uuid PRIMARY KEY REFERENCES bnb_guest_review(id),
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 host_subject text NOT NULL,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 2000),
 status text NOT NULL DEFAULT 'pending_moderation'
 CHECK(status IN ('pending_moderation','approved','rejected','withdrawn')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_abuse_report (
 id uuid PRIMARY KEY,
 reporter_subject text NOT NULL REFERENCES bnb_account(subject),
 property_id uuid NOT NULL REFERENCES bnb_property(id),
 target_type text NOT NULL CHECK(target_type IN ('review','message','host_response')),
 target_id uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN ('harassment','spam','fraud','privacy','other')),
 detail text NOT NULL CHECK(char_length(detail)<=1000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(reporter_subject,target_type,target_id)
);
CREATE TABLE IF NOT EXISTS bnb_review_moderation_nonce (
 issuer text NOT NULL, jti text NOT NULL,
 target_type text NOT NULL, target_id uuid NOT NULL,
 decision text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(issuer,jti)
);
CREATE TABLE IF NOT EXISTS bnb_reputation_export (
 review_id uuid PRIMARY KEY REFERENCES bnb_guest_review(id),
 last_revision bigint NOT NULL DEFAULT 0,
 exported_at timestamptz,
 external_reference text
);

ALTER TABLE bnb_guest_message ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'visible'
 CHECK(moderation_status IN ('visible','quarantined'));
CREATE INDEX IF NOT EXISTS bnb_abuse_pending ON bnb_abuse_report(status,created_at);
