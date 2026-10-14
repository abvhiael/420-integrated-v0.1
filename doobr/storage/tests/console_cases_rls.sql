-- Independent restricted-role verification of migration 0007.
CREATE ROLE doobr_case_reader NOLOGIN;
GRANT USAGE ON SCHEMA doobr_private TO doobr_case_reader;
GRANT SELECT ON doobr_private.console_cases,doobr_private.console_case_events TO doobr_case_reader;
INSERT INTO doobr_private.console_cases
(tenant_id,case_id,purpose,requester_id,requester_subject,proposer_token_digest,proposal_ref,evidence_ref,created_at,expires_at)
VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000201','SAFETY_HOLD','00000000-0000-4000-8000-000000000301','a',decode(repeat('aa',32),'hex'),'p1','opaque',now(),now()+interval '1 hour'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000202','SAFETY_HOLD','00000000-0000-4000-8000-000000000302','b',decode(repeat('bb',32),'hex'),'p2','opaque',now(),now()+interval '1 hour');
BEGIN;
SET LOCAL ROLE doobr_case_reader;
SELECT set_config('doobr.tenant_id','00000000-0000-4000-8000-000000000101',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM doobr_private.console_cases) <> 1 THEN
  RAISE EXCEPTION 'cross-tenant case leaked';
 END IF;
 IF EXISTS(SELECT 1 FROM doobr_private.console_cases WHERE tenant_id='00000000-0000-4000-8000-000000000102') THEN
  RAISE EXCEPTION 'foreign tenant accessible';
 END IF;
END $check$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE doobr_case_reader;
DO $check$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.console_cases) THEN
  RAISE EXCEPTION 'missing tenant context did not fail closed';
 END IF;
END $check$;
ROLLBACK;
