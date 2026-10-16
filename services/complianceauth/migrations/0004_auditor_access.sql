CREATE TABLE IF NOT EXISTS compliance_auditor_access (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant TEXT NOT NULL, domain TEXT NOT NULL, jurisdiction TEXT NOT NULL,
 case_id TEXT NOT NULL, actor_id TEXT NOT NULL, evidence_id TEXT NOT NULL,
 purpose TEXT NOT NULL, result TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS compliance_auditor_access_case_idx
 ON compliance_auditor_access(tenant,domain,jurisdiction,case_id,occurred_at);
