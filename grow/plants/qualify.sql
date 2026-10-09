\set ON_ERROR_STOP on
-- Test in own PostgreSQL 16 ephemeral service, existing V2-03/04 already migrated.
BEGIN;
INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES('aaaaaaaa-1111-4111-8111-111111111111','Genealogy A','CA-SK'),('bbbbbbbb-2222-4222-8222-222222222222','Genealogy B','CA-SK');
INSERT INTO grow_private.facilities(tenant_id,facility_id,name) VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333','Test Facility');
INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name) VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444','Zone');
INSERT INTO grow_private.cultivars(tenant_id,cultivar_id,name) VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-5555-4555-8555-555555555555','Test Cultivar');
INSERT INTO grow_private.plants(tenant_id,facility_id,zone_id,plant_id,label,state,cultivar_id) VALUES
 ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444','aaaaaaaa-6666-4666-8666-666666666666','Mother','VEGETATIVE','aaaaaaaa-5555-4555-8555-555555555555'),
 ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444','aaaaaaaa-7777-4777-8777-777777777777','Clone','CLONE','aaaaaaaa-5555-4555-8555-555555555555');
INSERT INTO grow_private.plant_lineage(tenant_id,child_id,parent_id,relation) VALUES
 ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-7777-4777-8777-777777777777','aaaaaaaa-6666-4666-8666-666666666666','CLONE_PARENT');
DO $$
BEGIN
 BEGIN
 INSERT INTO grow_private.plant_lineage(tenant_id,child_id,parent_id,relation) VALUES
 ('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-6666-4666-8666-666666666666','aaaaaaaa-7777-4777-8777-777777777777','SEED_PARENT');
 RAISE EXCEPTION 'cycle admitted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM = 'cycle admitted' THEN RAISE; END IF;
 END;
 BEGIN
 INSERT INTO grow_private.cultivars(tenant_id,cultivar_id,name) VALUES
 ('bbbbbbbb-2222-4222-8222-222222222222','aaaaaaaa-5555-4555-8555-555555555555','Tenant B');
 INSERT INTO grow_private.plants(tenant_id,facility_id,zone_id,plant_id,label,state,cultivar_id) VALUES
 ('bbbbbbbb-2222-4222-8222-222222222222','aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444','bbbbbbbb-9999-4999-8999-999999999999','Spoof','CLONE','aaaaaaaa-5555-4555-8555-555555555555');
 RAISE EXCEPTION 'cross tenant plant admitted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.plants) OR EXISTS(SELECT 1 FROM grow_private.cultivars)
 THEN RAISE EXCEPTION 'private genealogy leaked across tenants'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
