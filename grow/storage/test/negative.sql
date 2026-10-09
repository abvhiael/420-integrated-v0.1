-- GROW-V2-03 negative integration assertions. Run inside a disposable PostgreSQL database.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE x uuid:='11111111-1111-4111-8111-111111111111'; y uuid:='22222222-2222-4222-8222-222222222222'; f uuid:='33333333-3333-4333-8333-333333333333'; z uuid:='44444444-4444-4444-8444-444444444444';
BEGIN
 INSERT INTO grow_private.tenants(tenant_id,name,jurisdiction) VALUES(x,'Tenant A','CA-SK'),(y,'Tenant B','CA-SK');
 INSERT INTO grow_private.facilities(tenant_id,facility_id,name) VALUES(x,f,'Room A');
 INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name) VALUES(x,f,z,'Zone A');
 BEGIN
  INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name) VALUES(y,f,z,'Cross-tenant');
  RAISE EXCEPTION 'Cross-tenant reference unexpectedly accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
ROLLBACK;
-- Test a non-owner, non-BYPASSRLS runtime identity in its own session below.
