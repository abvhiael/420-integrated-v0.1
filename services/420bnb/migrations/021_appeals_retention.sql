-- BNB-3.9: appeals and privacy lifecycle; immutable separate appeal decisions.
CREATE TABLE bnb_moderation_appeal (
 id uuid PRIMARY KEY,
 report_id uuid NOT NULL REFERENCES bnb_abuse_report(id),
 appellant_subject text NOT NULL REFERENCES bnb_account(subject),
 grounds text NOT NULL CHECK (char_length(grounds) BETWEEN 10 AND 1000),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','upheld','overturned')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 decided_by text,
 UNIQUE(report_id,appellant_subject)
);
CREATE TABLE bnb_moderation_appeal_decision_nonce (
 issuer text NOT NULL,
 jti text NOT NULL,
 appeal_id uuid NOT NULL REFERENCES bnb_moderation_appeal(id),
 decision text NOT NULL CHECK (decision IN ('upheld','overturned')),
 PRIMARY KEY(issuer,jti)
);
CREATE TABLE bnb_privacy_retention_hold (
 report_id uuid PRIMARY KEY REFERENCES bnb_abuse_report(id),
 until_at timestamptz NOT NULL,
 reason_code text NOT NULL CHECK (reason_code IN ('appeal','legal_hold')),
 created_at timestamptz NOT NULL DEFAULT now()
);
