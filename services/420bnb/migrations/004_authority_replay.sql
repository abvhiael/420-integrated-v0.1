-- Purpose-bound recovery and external property claim replay rejection.
CREATE TABLE IF NOT EXISTS bnb_authority_proof_used (
 authority text NOT NULL, issuer text NOT NULL, proof_jti text NOT NULL,
 subject text NOT NULL, used_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(authority,issuer,proof_jti)
);
