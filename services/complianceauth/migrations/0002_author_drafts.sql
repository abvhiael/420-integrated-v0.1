CREATE TABLE IF NOT EXISTS compliance_author_heads (
    tenant TEXT NOT NULL,
    domain TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    draft_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    revision BIGINT NOT NULL CHECK (revision >= 0),
    PRIMARY KEY (tenant, domain, jurisdiction, draft_id)
);
CREATE TABLE IF NOT EXISTS compliance_author_versions (
    tenant TEXT NOT NULL,
    domain TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    draft_id TEXT NOT NULL,
    revision BIGINT NOT NULL CHECK (revision > 0),
    author_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    document_digest TEXT NOT NULL CHECK (char_length(document_digest) = 64),
    document JSONB NOT NULL,
    PRIMARY KEY (tenant, domain, jurisdiction, draft_id, revision),
    FOREIGN KEY (tenant, domain, jurisdiction, draft_id)
        REFERENCES compliance_author_heads(tenant, domain, jurisdiction, draft_id)
);
