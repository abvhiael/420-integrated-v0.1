\set ON_ERROR_STOP on
BEGIN;
INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES
('aaaa1111-1111-4111-8111-111111111111','Equipment A','CA-SK'),
('bbbb2222-2222-4222-8222-222222222222','Equipment B','CA-SK');
INSERT INTO grow_private.facilities(tenant_id,facility_id,name) VALUES
('aaaa1111-1111-4111-8111-111111111111','aaaa3333-3333-4333-8333-333333333333','Facility');
INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name) VALUES
('aaaa1111-1111-4111-8111-111111111111','aaaa3333-3333-4333-8333-333333333333','aaaa4444-4444-4444-8444-444444444444','Zone');
INSERT INTO grow_private.equipment(tenant_id,facility_id,zone_id,device_id,device_type,safe_minimum,safe_maximum)
 VALUES('aaaa1111-1111-4111-8111-111111111111','aaaa3333-3333-4333-8333-333333333333',
'aaaa4444-4444-4444-8444-444444444444','aaaa5555-5555-4555-8555-555555555555','heater',15,30);
DO $$ BEGIN
 BEGIN
 INSERT INTO grow_private.equipment(tenant_id,facility_id,zone_id,device_id,device_type,safe_minimum,safe_maximum)
 VALUES('bbbb2222-2222-4222-8222-222222222222','aaaa3333-3333-4333-8333-333333333333',
'aaaa4444-4444-4444-8444-444444444444','bbbb6666-6666-4666-8666-666666666666','heater',15,30);
 RAISE EXCEPTION 'cross tenant equipment permitted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO grow_private.equipment(tenant_id,facility_id,zone_id,device_id,device_type,safe_minimum,safe_maximum)
 VALUES('aaaa1111-1111-4111-8111-111111111111','aaaa3333-3333-4333-8333-333333333333',
'aaaa4444-4444-4444-8444-444444444444','bbbb7777-7777-4777-8777-777777777777','heater',30,15);
 RAISE EXCEPTION 'inverted safety limits permitted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
INSERT INTO grow_private.equipment_nonces(tenant_id,device_id,nonce,expires_at)
VALUES('aaaa1111-1111-4111-8111-111111111111','aaaa5555-5555-4555-8555-555555555555',
decode('00000000000000000000000000000001','hex'),now()+interval '1 minute');
DO $$ BEGIN
 BEGIN
 INSERT INTO grow_private.equipment_nonces(tenant_id,device_id,nonce,expires_at)
 VALUES('aaaa1111-1111-4111-8111-111111111111','aaaa5555-5555-4555-8555-555555555555',
 decode('00000000000000000000000000000001','hex'),now()+interval '1 minute');
 RAISE EXCEPTION 'nonce replay permitted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbb2222-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.equipment) OR EXISTS(SELECT 1 FROM grow_private.equipment_nonces)
 THEN RAISE EXCEPTION 'tenant B equipment leakage'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
