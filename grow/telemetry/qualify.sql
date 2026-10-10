\set ON_ERROR_STOP on
BEGIN;
INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES
('aaaabbbb-1111-4111-8111-111111111111','Telemetry A','CA-SK'),
('bbbbcccc-2222-4222-8222-222222222222','Telemetry B','CA-SK');
INSERT INTO grow_private.facilities(tenant_id,facility_id,name) VALUES
('aaaabbbb-1111-4111-8111-111111111111','aaaabbbb-3333-4333-8333-333333333333','Facility');
INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name) VALUES
('aaaabbbb-1111-4111-8111-111111111111','aaaabbbb-3333-4333-8333-333333333333','aaaabbbb-4444-4444-8444-444444444444','Zone');
INSERT INTO grow_private.observations(tenant_id,observation_id,facility_id,zone_id,sensor_id,kind,reading,unit,measured_at,source)
VALUES('aaaabbbb-1111-4111-8111-111111111111','aaaabbbb-5555-4555-8555-555555555555','aaaabbbb-3333-4333-8333-333333333333',
'aaaabbbb-4444-4444-8444-444444444444','sensor-1','temperature',21.5,'C',now()-interval '1 minute','manual');
DO $$
BEGIN
 BEGIN
 INSERT INTO grow_private.observations(tenant_id,observation_id,facility_id,zone_id,sensor_id,kind,reading,unit,measured_at,source)
 VALUES('aaaabbbb-1111-4111-8111-111111111111','aaaabbbb-6666-4666-8666-666666666666',
 'aaaabbbb-3333-4333-8333-333333333333','aaaabbbb-4444-4444-8444-444444444444',
 'sensor-2','humidity',150,'%',now(),'manual');
 RAISE EXCEPTION 'invalid humidity accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
 INSERT INTO grow_private.observations(tenant_id,observation_id,facility_id,zone_id,sensor_id,kind,reading,unit,measured_at,source)
 VALUES('bbbbcccc-2222-4222-8222-222222222222','aaaabbbb-7777-4777-8777-777777777777',
 'aaaabbbb-3333-4333-8333-333333333333','aaaabbbb-4444-4444-8444-444444444444',
 'sensor-cross','temperature',21,'C',now(),'manual');
 RAISE EXCEPTION 'cross-tenant zone reference accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbcccc-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.observations) THEN RAISE EXCEPTION 'tenant telemetry leaked'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='aaaabbbb-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.observations WHERE kind='temperature')<>1 THEN RAISE EXCEPTION 'tenant history not visible'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
