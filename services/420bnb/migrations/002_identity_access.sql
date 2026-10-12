-- BNB-2.1 accounts and scoped access, no self-granted verified claims.
CREATE TABLE IF NOT EXISTS bnb_account (
  subject text PRIMARY KEY, display_name text,
  state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_identity_session (
  id uuid PRIMARY KEY, subject text NOT NULL REFERENCES bnb_account(subject),
  issuer text NOT NULL, issuer_session_id text NOT NULL,
  expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(issuer,issuer_session_id)
);
CREATE INDEX IF NOT EXISTS bnb_identity_session_active ON bnb_identity_session(subject,expires_at)
 WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS bnb_property_grant (
  property_id uuid NOT NULL REFERENCES bnb_property(id),
  grantee_subject text NOT NULL REFERENCES bnb_account(subject),
  capability text NOT NULL CHECK(capability IN ('view_reservations','edit_calendar','edit_listing','handle_requests')),
  expires_at timestamptz NOT NULL, revoked_at timestamptz,
  granted_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(property_id,grantee_subject,capability)
);
-- Financial operations and property ownership transfer deliberately excluded.
