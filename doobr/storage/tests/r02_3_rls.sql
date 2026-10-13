-- R02.3 restricted-role and cross-tenant isolation smoke.
\set ON_ERROR_STOP on
CREATE ROLE doobr_r023_test LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA doobr_private TO doobr_r023_test;
GRANT SELECT ON doobr_private.retailer_authorizations,doobr_private.retailer_prepaid_evidence TO doobr_r023_test;
INSERT INTO doobr_private.tenants(tenant_id,label) VALUES
('00000000-0000-4000-8000-000000000301','R023 A'),
('00000000-0000-4000-8000-000000000302','R023 B');
INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES
('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000311','identity:retailer-a','RETAILER','ACTIVE');
INSERT INTO doobr_private.retailer_authorizations(
 tenant_id,authorization_id,retailer_id,legal_seller_ref,licence_ref,municipality_ref,
 retail_site_ref,issuer_ref,evidence_digest,valid_from,valid_until)
VALUES ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000321',
 '00000000-0000-4000-8000-000000000311','seller-a','licence-a','Vancouver',
 'shop-a','external-approved-issuer',decode(repeat('aa',32),'hex'),now()-interval '1 day',now()+interval '1 day');
SET ROLE doobr_r023_test;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.retailer_authorizations)
    OR EXISTS(SELECT 1 FROM doobr_private.retailer_prepaid_evidence)
 THEN RAISE EXCEPTION 'Unscoped retailer evidence leaked'; END IF;
END $$;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000301';
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.retailer_authorizations)<>1
 THEN RAISE EXCEPTION 'In-tenant retailer evidence missing'; END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000302';
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM doobr_private.retailer_authorizations)
 THEN RAISE EXCEPTION 'Other tenant saw licence'; END IF;
END $$;
COMMIT;
RESET ROLE;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='doobr_private' AND c.relname IN ('retailer_authorizations','retailer_prepaid_evidence')
 AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>2 THEN RAISE EXCEPTION 'R02.3 FORCE RLS missing'; END IF;
END $$;
REVOKE ALL ON doobr_private.retailer_authorizations,doobr_private.retailer_prepaid_evidence FROM doobr_r023_test;
REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r023_test;
DROP ROLE doobr_r023_test;
