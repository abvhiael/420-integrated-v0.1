\set ON_ERROR_STOP on
-- R02.5 real PostGIS boundary correctness, tenant isolation and no public grants.
CREATE ROLE doobr_r025_reader LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA doobr_private TO doobr_r025_reader;
GRANT SELECT ON doobr_private.service_regions,doobr_private.courier_region_presence TO doobr_r025_reader;
INSERT INTO doobr_private.tenants(tenant_id,label) VALUES
 ('00000000-0000-4000-8000-000000000801','region A'),
 ('00000000-0000-4000-8000-000000000802','region B');
INSERT INTO doobr_private.service_regions(tenant_id,region_id,region_code,country_code,province_code,municipality_ref,boundary,policy_ref)
VALUES('00000000-0000-4000-8000-000000000801',
'00000000-0000-4000-8000-000000000811','test-vancouver','CA','BC','Vancouver',
ST_Multi(ST_GeomFromText('POLYGON((-123.2 49.2,-123.0 49.2,-123.0 49.4,-123.2 49.4,-123.2 49.2))',4326)),'compliance-deferred');
DO $$
DECLARE r geometry;
BEGIN
 SELECT boundary INTO r FROM doobr_private.service_regions
 WHERE region_id='00000000-0000-4000-8000-000000000811';
 IF NOT ST_Covers(r,ST_SetSRID(ST_Point(-123.1,49.3),4326))
 OR ST_Covers(r,ST_SetSRID(ST_Point(-122.5,49.3),4326))
 OR NOT ST_Covers(r,ST_SetSRID(ST_Point(-123.2,49.3),4326))
 THEN RAISE EXCEPTION 'PostGIS inside/outside/boundary assertion failed'; END IF;
END $$;
SET ROLE doobr_r025_reader;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.service_regions) THEN
 RAISE EXCEPTION 'unscoped service-region access'; END IF;
END $$;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000802';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.service_regions) THEN
 RAISE EXCEPTION 'cross-tenant region leak'; END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000801';
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.service_regions)<>1 THEN
 RAISE EXCEPTION 'own region not visible'; END IF;
END $$;
COMMIT;
RESET ROLE;
REVOKE ALL ON doobr_private.service_regions,doobr_private.courier_region_presence FROM doobr_r025_reader;
REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r025_reader;
DROP ROLE doobr_r025_reader;
