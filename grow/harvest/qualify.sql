\set ON_ERROR_STOP on
-- GROW-V2-09 actual PostgreSQL harvest/planning invariants and tenant isolation.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='grow_private' AND c.relname='harvest_records' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'recorded harvest missing forced RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='grow_private' AND c.relname='harvest_plans' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'planned harvest calendar missing forced RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
 WHERE conrelid='grow_private.harvest_plans'::regclass AND contype='f')
 THEN RAISE EXCEPTION 'planned harvest missing parent constraints'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='grow_private.harvest_records'::regclass
 AND tgname='harvest_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'harvest append-only trigger missing'; END IF;
END $$;
BEGIN;
INSERT INTO grow_private.plants
(tenant_id,facility_id,zone_id,plant_id,label,state,cultivar_id)
VALUES ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','aaaaaaaa-8888-4888-8888-888888888888','Harvest fixture','HARVESTED','aaaaaaaa-5555-4555-8555-555555555555');
INSERT INTO grow_private.harvest_records
(tenant_id,harvest_id,facility_id,zone_id,plant_id,weight_grams,harvested_at,actor_subject,source,idempotency_key)
VALUES ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-9999-4999-8999-999999999999',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'aaaaaaaa-8888-4888-8888-888888888888',42,now(),'operator','manual','fixture-1');
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.harvest_records h
 JOIN grow_private.plants p ON p.tenant_id=h.tenant_id AND p.plant_id=h.plant_id
 WHERE p.cultivar_id='aaaaaaaa-5555-4555-8555-555555555555' AND h.weight_grams=42)<>1
 THEN RAISE EXCEPTION 'cultivar production join failed'; END IF;
END $$;
INSERT INTO grow_private.harvest_plans
(tenant_id,facility_id,zone_id,plant_id,start_at,end_at,actor_subject,source)
VALUES ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','aaaaaaaa-6666-4666-8666-666666666666',
now()+interval '14 days',now()+interval '21 days','operator','manual');
UPDATE grow_private.harvest_plans SET start_at=now()+interval '15 days',
 end_at=now()+interval '22 days' WHERE actor_subject='operator';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.harvest_plan_events
 WHERE plant_id='aaaaaaaa-6666-4666-8666-666666666666')<>2
 THEN RAISE EXCEPTION 'harvest plan revision provenance lost'; END IF;
END $$;
DO $$
BEGIN
 BEGIN
  INSERT INTO grow_private.harvest_records
  (tenant_id,harvest_id,facility_id,zone_id,plant_id,weight_grams,harvested_at,actor_subject,source,idempotency_key)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-9999-4999-8999-999999999998',
  'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
  'aaaaaaaa-8888-4888-8888-888888888888',1,now(),'operator','manual','fixture-2');
  RAISE EXCEPTION 'double counted harvested plant';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  UPDATE grow_private.harvest_records SET weight_grams=1
  WHERE idempotency_key='fixture-1';
  RAISE EXCEPTION 'historical harvest mutation accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='historical harvest mutation accepted' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE grow_private.harvest_plans SET end_at=start_at WHERE actor_subject='operator';
  RAISE EXCEPTION 'invalid planned date accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.harvest_records)
 OR EXISTS(SELECT 1 FROM grow_private.harvest_plans)
 OR EXISTS(SELECT 1 FROM grow_private.harvest_plan_events)
 THEN RAISE EXCEPTION 'cross-tenant harvest/calendar leak'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='aaaaaaaa-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.harvest_records WHERE idempotency_key='fixture-1')<>1
 OR (SELECT count(*) FROM grow_private.harvest_plans WHERE actor_subject='operator')<>1
 THEN RAISE EXCEPTION 'correct tenant lost harvest/calendar visibility'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
