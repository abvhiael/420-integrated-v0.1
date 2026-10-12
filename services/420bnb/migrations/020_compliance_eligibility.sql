-- BNB-2.12 compliance eligibility is explicitly independent of hosting identity.
CREATE TABLE IF NOT EXISTS bnb_compliance_eligibility (
 property_id uuid PRIMARY KEY REFERENCES bnb_property(id),
 jurisdiction_id text NOT NULL CHECK(jurisdiction_id ~ '^[A-Za-z0-9_-]{1,100}$'),
 decision text NOT NULL CHECK(decision IN ('allowed','prohibited')),
 license_reference text NOT NULL CHECK(length(license_reference) BETWEEN 1 AND 160),
 minimum_guest_age integer CHECK(minimum_guest_age BETWEEN 0 AND 120),
 identity_required boolean NOT NULL,
 issuer text NOT NULL,
 proof_jti text NOT NULL UNIQUE,
 revision bigint NOT NULL CHECK(revision>0),
 property_version bigint NOT NULL,
 effective_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK(expires_at>effective_at)
);
CREATE INDEX IF NOT EXISTS bnb_compliance_eligibility_active
 ON bnb_compliance_eligibility(jurisdiction_id,decision) WHERE revoked_at IS NULL;
