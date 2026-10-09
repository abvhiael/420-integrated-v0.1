\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='integration_outbox' AND c.relrowsecurity AND c.relforcerowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='integration_opt_ins' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'Grow private outbox RLS unavailable'; END IF;
END $$;
BEGIN;
INSERT INTO grow_private.integration_opt_ins
(tenant_id,facility_id,zone_id,actor_subject,enabled)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','operator',true);
INSERT INTO grow_private.integration_outbox
(tenant_id,event_id,facility_id,zone_id,kind,source_id,requested_by,created_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000201',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'HARVEST_RECORDED','aaaaaaaa-9999-4999-8999-999999999999','operator',now());
INSERT INTO grow_private.integration_outbox
(tenant_id,event_id,facility_id,zone_id,kind,source_id,requested_by,created_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000202',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'HARVEST_RECORDED','aaaaaaaa-9999-4999-8999-999999999999','operator',now())
ON CONFLICT(tenant_id,event_id) DO NOTHING;
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.integration_outbox
  (tenant_id,event_id,facility_id,zone_id,kind,source_id,requested_by,created_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000203',
  'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
  'HARVEST_RECORDED','bbbbbbbb-9999-4999-8999-999999999999','operator',now());
  RAISE EXCEPTION 'cross-tenant source accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
UPDATE grow_private.integration_opt_ins SET enabled=false WHERE actor_subject='operator';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.integration_outbox WHERE state='REVOKED')<>2
 THEN RAISE EXCEPTION 'opt-out failed to revoke queued notifications'; END IF;
 BEGIN
  INSERT INTO grow_private.integration_outbox
  (tenant_id,event_id,facility_id,zone_id,kind,source_id,requested_by,created_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000204',
  'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
  'HARVEST_RECORDED','aaaaaaaa-9999-4999-8999-999999999999','operator',now());
  RAISE EXCEPTION 'revoked consent queued notification';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.integration_outbox)
 OR EXISTS(SELECT 1 FROM grow_private.integration_opt_ins)
 THEN RAISE EXCEPTION 'private notifications exposed cross-tenant'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
