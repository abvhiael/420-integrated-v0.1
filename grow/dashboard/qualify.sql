\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='grow_private' AND c.relname='dashboard_sessions' AND c.relrowsecurity AND c.relforcerowsecurity) THEN
  RAISE EXCEPTION 'dashboard session FORCE RLS missing';
 END IF;
END $$;
BEGIN;
INSERT INTO grow_private.dashboard_sessions(tenant_id,session_id,token_hash,subject_id,expires_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000301',decode(repeat('aa',32),'hex'),'operator',now()+interval '1 hour');
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.dashboard_sessions(tenant_id,session_id,token_hash,subject_id,expires_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000302',decode(repeat('bb',32),'hex'),'operator',now()+interval '2 days');
  RAISE EXCEPTION 'unbounded dashboard session accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
UPDATE grow_private.dashboard_sessions SET revoked_at=now()
WHERE tenant_id='aaaaaaaa-1111-4111-8111-111111111111'
AND session_id='aaaaaaaa-0000-4000-8000-000000000301';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.dashboard_sessions WHERE revoked_at IS NOT NULL)<>1 THEN
 RAISE EXCEPTION 'session revocation not durable';
 END IF;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.dashboard_sessions)
 THEN RAISE EXCEPTION 'cross-tenant session disclosed'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='aaaaaaaa-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.dashboard_sessions WHERE revoked_at IS NULL)
 THEN RAISE EXCEPTION 'revoked session still usable'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
