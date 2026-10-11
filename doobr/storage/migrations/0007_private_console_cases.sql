-- R03.7 private dual-control ledger. Apply only via controlled, reviewed migration chain.
CREATE TABLE IF NOT EXISTS doobr_private.console_cases (
 tenant_id uuid NOT NULL,
 case_id uuid NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('INCIDENT_ESCALATION','SAFETY_HOLD','COMPLIANCE_REVIEW')),
 requester_id uuid NOT NULL,
 requester_subject text NOT NULL,
 proposer_token_digest bytea NOT NULL CHECK (octet_length(proposer_token_digest)=32),
 proposal_ref text NOT NULL,
 evidence_ref text NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','APPROVED','EXECUTED','REJECTED','EXPIRED')),
 revision bigint NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL,
 expires_at timestamptz NOT NULL,
 approver_id uuid,
 approver_subject text,
 reviewed_at timestamptz,
 executed_at timestamptz,
 PRIMARY KEY (tenant_id,case_id),
 UNIQUE (tenant_id,proposal_ref),
 CHECK (expires_at>created_at),
 CHECK (approver_id IS NULL OR approver_id<>requester_id),
 CHECK (approver_subject IS NULL OR approver_subject<>requester_subject),
 CHECK ((state IN ('APPROVED','EXECUTED'))=(approver_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS doobr_private.console_case_events (
 tenant_id uuid NOT NULL,
 event_id uuid NOT NULL,
 case_id uuid NOT NULL,
 operation text NOT NULL CHECK (operation IN ('PROPOSE','APPROVE','EXECUTE','REJECT','EXPIRE')),
 actor_id uuid NOT NULL,
 case_revision bigint NOT NULL CHECK (case_revision>0),
 evidence_digest bytea NOT NULL CHECK (octet_length(evidence_digest)=32),
 recorded_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,event_id),
 UNIQUE (tenant_id,case_id,case_revision),
 FOREIGN KEY(tenant_id,case_id) REFERENCES doobr_private.console_cases(tenant_id,case_id)
);
ALTER TABLE doobr_private.console_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.console_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.console_case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.console_case_events FORCE ROW LEVEL SECURITY;
CREATE POLICY console_cases_tenant ON doobr_private.console_cases
 USING (tenant_id = NULLIF(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('doobr.tenant_id',true),'')::uuid);
CREATE POLICY console_events_tenant ON doobr_private.console_case_events
 USING (tenant_id = NULLIF(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('doobr.tenant_id',true),'')::uuid);
