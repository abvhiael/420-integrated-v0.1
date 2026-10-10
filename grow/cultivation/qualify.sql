\set ON_ERROR_STOP on
BEGIN;
INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES
('1111aaaa-1111-4111-8111-111111111111','Irrigation A','CA-SK'),
('2222bbbb-2222-4222-8222-222222222222','Irrigation B','CA-SK');
INSERT INTO grow_private.facilities(tenant_id,facility_id,name) VALUES
('1111aaaa-1111-4111-8111-111111111111','3333cccc-3333-4333-8333-333333333333','Facility');
INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name) VALUES
('1111aaaa-1111-4111-8111-111111111111','3333cccc-3333-4333-8333-333333333333','4444dddd-4444-4444-8444-444444444444','Zone');
INSERT INTO grow_private.cultivation_events(tenant_id,event_id,facility_id,zone_id,kind,metric,amount,unit,occurred_at,actor_subject,source,idempotency_key) VALUES
('1111aaaa-1111-4111-8111-111111111111','5555eeee-5555-4555-8555-555555555555',
 '3333cccc-3333-4333-8333-333333333333','4444dddd-4444-4444-8444-444444444444',
 'IRRIGATION','IRRIGATION_VOLUME',5,'L',now(),'operator','manual','irrigation-1');
DO $$ BEGIN
 BEGIN
 INSERT INTO grow_private.cultivation_events(tenant_id,event_id,facility_id,zone_id,kind,metric,amount,unit,occurred_at,actor_subject,source,idempotency_key) VALUES
 ('1111aaaa-1111-4111-8111-111111111111','6666eeee-6666-4666-8666-666666666666',
 '3333cccc-3333-4333-8333-333333333333','4444dddd-4444-4444-8444-444444444444',
 'IRRIGATION','IRRIGATION_VOLUME',5,'L',now(),'operator','manual','irrigation-1');
 RAISE EXCEPTION 'replay accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO grow_private.cultivation_events(tenant_id,event_id,facility_id,zone_id,kind,metric,amount,unit,occurred_at,actor_subject,source,idempotency_key) VALUES
 ('1111aaaa-1111-4111-8111-111111111111','7777eeee-7777-4777-8777-777777777777',
 '3333cccc-3333-4333-8333-333333333333','4444dddd-4444-4444-8444-444444444444',
 'NUTRIENT','NUTRIENT_PH',29,'pH',now(),'operator','manual','bad-ph');
 RAISE EXCEPTION 'out of range accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO grow_private.cultivation_events(tenant_id,event_id,facility_id,zone_id,kind,metric,amount,unit,occurred_at,actor_subject,source,idempotency_key) VALUES
 ('2222bbbb-2222-4222-8222-222222222222','8888eeee-8888-4888-8888-888888888888',
 '3333cccc-3333-4333-8333-333333333333','4444dddd-4444-4444-8444-444444444444',
 'IRRIGATION','IRRIGATION_VOLUME',5,'L',now(),'operator','manual','cross-tenant');
 RAISE EXCEPTION 'cross tenant accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
 UPDATE grow_private.cultivation_events SET amount=12 WHERE idempotency_key='irrigation-1';
 RAISE EXCEPTION 'history edited';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='history edited' THEN RAISE; END IF;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='2222bbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.cultivation_events) THEN RAISE EXCEPTION 'tenant isolation failed';END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='1111aaaa-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.cultivation_events)<>1 THEN RAISE EXCEPTION 'history not visible';END IF;
END $$;
ROLLBACK;
RESET ROLE;
