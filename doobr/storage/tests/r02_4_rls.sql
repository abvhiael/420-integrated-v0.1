-- R02.4 DB tenant separation and forced-RLS verification
\set ON_ERROR_STOP on
CREATE ROLE doobr_r024_test LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA doobr_private TO doobr_r024_test;
GRANT SELECT ON doobr_private.courier_credentials TO doobr_r024_test;
INSERT INTO doobr_private.tenants(tenant_id,label)
VALUES ('00000000-0000-4000-8000-000000000701','courier A'),
       ('00000000-0000-4000-8000-000000000702','courier B');
INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state)
VALUES ('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000711','identity:courier','COURIER','ACTIVE');
INSERT INTO doobr_private.courier_credentials(tenant_id,credential_id,courier_id,kind,carrier_class,issuer_ref,evidence_digest,jurisdiction_ref,valid_from,valid_until)
VALUES('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000721',
'00000000-0000-4000-8000-000000000711','TRAINING','DELIVERY_PERSON','issuer',
decode(repeat('aa',32),'hex'),'CA-BC-VANCOUVER',now()-interval '1 day',now()+interval '1 day');
SET ROLE doobr_r024_test;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.courier_credentials) THEN RAISE EXCEPTION 'Unscoped credential leak'; END IF;
END $$;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000701';
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.courier_credentials)<>1 THEN RAISE EXCEPTION 'Expected authorized row'; END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000702';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.courier_credentials) THEN RAISE EXCEPTION 'Cross-tenant leak'; END IF;
END $$;
COMMIT;
RESET ROLE;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='doobr_private' AND c.relname='courier_credentials' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'Missing courier FORCE RLS'; END IF;
END $$;
REVOKE ALL ON doobr_private.courier_credentials FROM doobr_r024_test;
REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r024_test;
DROP ROLE doobr_r024_test;
