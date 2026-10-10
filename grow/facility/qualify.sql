\set ON_ERROR_STOP on
BEGIN;
-- Setup with privileged migration owner, not a runtime application session.
INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Facility Owner','CA-SK'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Different Owner','CA-SK');
INSERT INTO grow_private.facilities(tenant_id,facility_id,name) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Facility One');
INSERT INTO grow_private.rooms(tenant_id,facility_id,room_id,name) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','dddddddd-dddd-4ddd-8ddd-dddddddddddd','Room One');
INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,room_id,name) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','dddddddd-dddd-4ddd-8ddd-dddddddddddd','Zone One');
DO $$
BEGIN
 BEGIN
 INSERT INTO grow_private.rooms(tenant_id,facility_id,room_id,name) VALUES
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-aaaa-4111-8111-111111111111','Cross tenant');
 RAISE EXCEPTION 'cross-tenant room accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,room_id,name) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-aaaa-4111-8111-111111111111','22222222-bbbb-4222-8222-222222222222','Orphan');
 RAISE EXCEPTION 'zone orphan room accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
COMMIT;
-- Separate nonowner app identity with explicit tenant context.
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.facilities) != 1 THEN RAISE EXCEPTION 'facility A visibility'; END IF;
 IF (SELECT count(*) FROM grow_private.rooms) != 1 THEN RAISE EXCEPTION 'room A visibility'; END IF;
 IF (SELECT count(*) FROM grow_private.zones) != 1 THEN RAISE EXCEPTION 'zone A visibility'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.rooms) != 0 THEN RAISE EXCEPTION 'cross-tenant room leak'; END IF;
 IF (SELECT count(*) FROM grow_private.zones) != 0 THEN RAISE EXCEPTION 'cross-tenant zone leak'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
