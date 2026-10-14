-- R02.2 SQL authorization persistence checks, isolated CI database only.
\set ON_ERROR_STOP on
CREATE ROLE doobr_r022_test LOGIN PASSWORD 'ci-only-password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA doobr_private TO doobr_r022_test;
GRANT SELECT,INSERT,UPDATE ON doobr_private.tenants, doobr_private.actors, doobr_private.identity_sessions, doobr_private.role_grants, doobr_private.access_audit TO doobr_r022_test;
INSERT INTO doobr_private.tenants(tenant_id,label) VALUES
('00000000-0000-4000-8000-000000000101','R022 A'),
('00000000-0000-4000-8000-000000000102','R022 B');
INSERT INTO doobr_private.actors(tenant_id,actor_id,identity_ref,kind,state) VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000111','identity:user-1','COURIER','ACTIVE'),
('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000112','identity:user-2','COURIER','ACTIVE');
SET ROLE doobr_r022_test;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM doobr_private.identity_sessions) THEN RAISE EXCEPTION 'Unscoped sessions leaked'; END IF;
 IF EXISTS (SELECT 1 FROM doobr_private.role_grants) THEN RAISE EXCEPTION 'Unscoped grants leaked'; END IF;
END $$;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000101';
INSERT INTO doobr_private.identity_sessions(tenant_id,session_id,actor_id,issuer_ref,token_jti_digest,audience,wallet_consent,wallet_consent_expires_at,expires_at) VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000121','00000000-0000-4000-8000-000000000111','issuer:420Identity',decode(repeat('01',32),'hex'),'doobr-api',true,now()+interval '10 minutes',now()+interval '15 minutes');
INSERT INTO doobr_private.role_grants(tenant_id,actor_id,grant_id,role,resource_ref,granted_by,expires_at) VALUES
('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000131','COURIER','order:1','issuer:reviewer',now()+interval '15 minutes');
DO $$
BEGIN
 IF (SELECT count(*) FROM doobr_private.identity_sessions)<>1 THEN RAISE EXCEPTION 'Tenant A session missing'; END IF;
 BEGIN
 INSERT INTO doobr_private.role_grants(tenant_id,actor_id,grant_id,role,resource_ref,granted_by,expires_at) VALUES
 ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000132','COURIER','order:2','issuer:reviewer',now()+interval '15 minutes');
 RAISE EXCEPTION 'Cross tenant grant inserted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
COMMIT;
BEGIN;
SET LOCAL doobr.tenant_id='00000000-0000-4000-8000-000000000102';
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM doobr_private.identity_sessions) THEN RAISE EXCEPTION 'Cross tenant sessions leaked'; END IF;
 IF EXISTS (SELECT 1 FROM doobr_private.role_grants) THEN RAISE EXCEPTION 'Cross tenant grants leaked'; END IF;
END $$;
COMMIT;
RESET ROLE;
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace
 WHERE s.nspname='doobr_private' AND c.relname IN ('identity_sessions','role_grants','access_audit') AND c.relrowsecurity AND c.relforcerowsecurity;
 IF n<>3 THEN RAISE EXCEPTION 'Identity table FORCE RLS missing: %',n; END IF;
END $$;
REVOKE ALL ON doobr_private.tenants, doobr_private.actors, doobr_private.identity_sessions, doobr_private.role_grants, doobr_private.access_audit FROM doobr_r022_test;
REVOKE USAGE ON SCHEMA doobr_private FROM doobr_r022_test;
DROP ROLE doobr_r022_test;
