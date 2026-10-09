\set ON_ERROR_STOP on
-- GROW-V2-11 real PostgreSQL tenant, consent and immutable human-review checks.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='ai_consents' AND c.relrowsecurity AND c.relforcerowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='ai_advice_jobs' AND c.relrowsecurity AND c.relforcerowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='ai_recommendations' AND c.relrowsecurity AND c.relforcerowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='ai_reviews' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'AI private tables missing FORCE RLS'; END IF;
END $$;
BEGIN;
INSERT INTO grow_private.ai_consents
(tenant_id,consent_id,facility_id,zone_id,actor_subject,purpose,granted)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000101',
 'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
 'operator','CULTIVATION_ADVICE',true);
INSERT INTO grow_private.ai_advice_jobs
(tenant_id,job_id,facility_id,zone_id,consent_id,source_kind,source_id,requested_by,requested_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000102',
 'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
 'aaaaaaaa-0000-4000-8000-000000000101','PLANT',
 'aaaaaaaa-8888-4888-8888-888888888888','operator',now());
INSERT INTO grow_private.ai_recommendations
(tenant_id,recommendation_id,job_id,facility_id,zone_id,provider,model,text,explanation,limitations,confidence,created_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000103',
 'aaaaaaaa-0000-4000-8000-000000000102','aaaaaaaa-3333-4333-8333-333333333333',
 'aaaaaaaa-4444-4444-8444-444444444444','trusted-test','test-model','Inspect the plant',
 'Based on entered history','Not validated; human inspection mandatory','LOW',now());
INSERT INTO grow_private.ai_reviews
(tenant_id,review_id,recommendation_id,facility_id,zone_id,actor_subject,decision,reason,reviewed_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000104',
 'aaaaaaaa-0000-4000-8000-000000000103','aaaaaaaa-3333-4333-8333-333333333333',
 'aaaaaaaa-4444-4444-8444-444444444444','operator','REJECTED','Not useful',now());
DO $$ BEGIN
 BEGIN
  UPDATE grow_private.ai_reviews SET decision='ACCEPTED_FOR_REVIEW'
  WHERE review_id='aaaaaaaa-0000-4000-8000-000000000104';
  RAISE EXCEPTION 'review overwritten';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='review overwritten' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO grow_private.ai_reviews
  (tenant_id,review_id,recommendation_id,facility_id,zone_id,actor_subject,decision,reason,reviewed_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000105',
   'aaaaaaaa-0000-4000-8000-000000000103','aaaaaaaa-3333-4333-8333-333333333333',
   'aaaaaaaa-4444-4444-8444-444444444444','operator','EXECUTE_HVAC','unsafe',now());
  RAISE EXCEPTION 'automatic actuation status accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
INSERT INTO grow_private.ai_advice_jobs
(tenant_id,job_id,facility_id,zone_id,consent_id,source_kind,source_id,requested_by,requested_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000106',
 'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
 'aaaaaaaa-0000-4000-8000-000000000101','PLANT',
 'aaaaaaaa-8888-4888-8888-888888888888','operator',now());
UPDATE grow_private.ai_consents SET granted=false
WHERE consent_id='aaaaaaaa-0000-4000-8000-000000000101';
DO $$ BEGIN
 IF (SELECT status FROM grow_private.ai_advice_jobs
 WHERE job_id='aaaaaaaa-0000-4000-8000-000000000106')<>'REVOKED'
 THEN RAISE EXCEPTION 'consent withdrawal did not cancel queued AI job'; END IF;
END $$;
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.ai_consent_events
 WHERE consent_id='aaaaaaaa-0000-4000-8000-000000000101')<>2
 THEN RAISE EXCEPTION 'AI consent grant/revocation provenance missing'; END IF;
 BEGIN
  UPDATE grow_private.ai_consent_events SET new_granted=true
  WHERE consent_id='aaaaaaaa-0000-4000-8000-000000000101';
  RAISE EXCEPTION 'AI consent audit mutation accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='AI consent audit mutation accepted' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO grow_private.ai_recommendations
  (tenant_id,recommendation_id,job_id,facility_id,zone_id,provider,model,text,explanation,limitations,confidence,created_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000107',
  'aaaaaaaa-0000-4000-8000-000000000106','aaaaaaaa-3333-4333-8333-333333333333',
  'aaaaaaaa-4444-4444-8444-444444444444','trusted-test','test-model','Late advice',
  'Observation','Human review','LOW',now());
  RAISE EXCEPTION 'revoked AI job produced advice';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.ai_consents)
 OR EXISTS(SELECT 1 FROM grow_private.ai_advice_jobs)
 OR EXISTS(SELECT 1 FROM grow_private.ai_recommendations)
 OR EXISTS(SELECT 1 FROM grow_private.ai_reviews)
 OR EXISTS(SELECT 1 FROM grow_private.ai_consent_events)
 THEN RAISE EXCEPTION 'cross tenant AI information exposed'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='aaaaaaaa-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.ai_reviews)<>1
 OR (SELECT count(*) FROM grow_private.ai_recommendations)<>1
 THEN RAISE EXCEPTION 'correct tenant lost advisory audit records'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
