CREATE TABLE IF NOT EXISTS compliance_review_heads (
 tenant TEXT NOT NULL, domain TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 draft_id TEXT NOT NULL, draft_revision BIGINT NOT NULL CHECK (draft_revision > 0),
 document_digest TEXT NOT NULL CHECK (char_length(document_digest) = 64),
 review_revision BIGINT NOT NULL DEFAULT 0 CHECK (review_revision >= 0),
 PRIMARY KEY (tenant,domain,jurisdiction,draft_id)
);
CREATE TABLE IF NOT EXISTS compliance_review_versions (
 tenant TEXT NOT NULL, domain TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 draft_id TEXT NOT NULL, review_revision BIGINT NOT NULL CHECK (review_revision > 0),
 draft_revision BIGINT NOT NULL CHECK (draft_revision > 0),
 document_digest TEXT NOT NULL CHECK (char_length(document_digest)=64),
 reviewer_id TEXT NOT NULL, state TEXT NOT NULL,
 record JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY (tenant,domain,jurisdiction,draft_id,review_revision),
 FOREIGN KEY (tenant,domain,jurisdiction,draft_id)
 REFERENCES compliance_review_heads(tenant,domain,jurisdiction,draft_id)
);
