-- V2-09 data isolation, append-only, and observed yield qualification
SELECT 1 WHERE to_regclass('grow_private.harvest_records') IS NOT NULL;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='grow_private' AND c.relname='harvest_records' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'harvest records missing forced RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid
 WHERE n.nspname='grow_private' AND c.relname='harvest_plans' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'planned harvest calendar missing forced RLS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='grow_private.harvest_plans'::regclass AND contype='f')
 THEN RAISE EXCEPTION 'planned harvest missing plant and zone foreign keys'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='grow_private.harvest_records'::regclass
 AND tgname='harvest_immutable' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'harvest append-only trigger missing'; END IF;
END $$;
BEGIN;
SET ROLE grow_v2_test_runtime;
SET LOCAL grow.tenant_id='11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.harvest_records WHERE tenant_id='22222222-2222-4222-8222-222222222222')<>0
 THEN RAISE EXCEPTION 'cross tenant harvest records visible'; END IF;
END $$;
ROLLBACK;
