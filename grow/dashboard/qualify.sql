\set ON_ERROR_STOP on
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='grow_private' AND c.relname='dashboard_sessions' AND c.relrowsecurity AND c.relforcerowsecurity) THEN
  RAISE EXCEPTION 'dashboard session FORCE RLS missing';
 END IF;
END $$;
BEGIN;
INSERT INTO grow_private.memberships(tenant_id,subject_id,role,state)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','operator','OWNER','ACTIVE')
ON CONFLICT(tenant_id,subject_id) DO NOTHING;
INSERT INTO grow_private.dashboard_identities(tenant_id,subject_id,cert_fingerprint,enabled)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','operator',decode(repeat('cc',32),'hex'),true);
INSERT INTO grow_private.dashboard_sessions(tenant_id,session_id,token_hash,subject_id,expires_at,identity_fingerprint)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000301',decode(repeat('aa',32),'hex'),'operator',now()+interval '1 hour',decode(repeat('cc',32),'hex'));
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.dashboard_sessions(tenant_id,session_id,token_hash,subject_id,expires_at,identity_fingerprint)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000302',decode(repeat('bb',32),'hex'),'operator',now()+interval '2 days',decode(repeat('cc',32),'hex'));
  RAISE EXCEPTION 'unbounded dashboard session accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
UPDATE grow_private.dashboard_sessions SET revoked_at=now()
WHERE tenant_id='aaaaaaaa-1111-4111-8111-111111111111'
AND session_id='aaaaaaaa-0000-4000-8000-000000000301';
DO $$ BEGIN
 IF (SELECT count(*) FROM grow_private.dashboard_sessions WHERE revoked_at IS NOT NULL)<>1 THEN
 RAISE EXCEPTION 'session revocation not durable';
 END IF;
END $$;
UPDATE grow_private.dashboard_identities SET enabled=false,revoked_at=now()
WHERE tenant_id='aaaaaaaa-1111-4111-8111-111111111111' AND subject_id='operator';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.dashboard_sessions s
 JOIN grow_private.dashboard_identities i ON i.tenant_id=s.tenant_id AND i.subject_id=s.subject_id
 AND i.cert_fingerprint=s.identity_fingerprint
 WHERE s.session_id='aaaaaaaa-0000-4000-8000-000000000301'
 AND s.revoked_at IS NULL AND i.enabled=true AND i.revoked_at IS NULL)
 THEN RAISE EXCEPTION 'revoked certificate still authenticates'; END IF;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.dashboard_sessions)
 THEN RAISE EXCEPTION 'cross-tenant session disclosed'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='aaaaaaaa-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.dashboard_sessions WHERE revoked_at IS NULL)
 THEN RAISE EXCEPTION 'revoked session still usable'; END IF;
END $$;
ROLLBACK;
RESET ROLE;


-- Production-shaped application role: no superuser, no BYPASSRLS, no table ownership.
CREATE ROLE grow_v2_dashboard_ci LOGIN PASSWORD 'ci-private-only' NOBYPASSRLS INHERIT IN ROLE grow_v2_test_runtime;
GRANT UPDATE(revoked_at) ON grow_private.dashboard_sessions TO grow_v2_dashboard_ci;
GRANT UPDATE(name,revision) ON grow_private.facilities TO grow_v2_dashboard_ci;
GRANT UPDATE(state,revision) ON grow_private.plants TO grow_v2_dashboard_ci;
GRANT UPDATE(balance) ON grow_private.inventory_lots_v2 TO grow_v2_dashboard_ci;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='grow_v2_dashboard_ci'
 AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb))
 THEN RAISE EXCEPTION 'dashboard integration role is privileged'; END IF;
END $$;
BEGIN;
INSERT INTO grow_private.zones(tenant_id,facility_id,zone_id,name)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444445','Other restricted zone');
INSERT INTO grow_private.plants(tenant_id,facility_id,zone_id,plant_id,label,state)
VALUES
('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444445','aaaaaaaa-6666-4666-8666-666666666667',
'Other zone plant','FLOWERING'),
('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','aaaaaaaa-6666-4666-8666-666666666668',
'Previously harvested plant','HARVESTED');
INSERT INTO grow_private.memberships(tenant_id,subject_id,role,state,facility_id,zone_id)
VALUES
('aaaaaaaa-1111-4111-8111-111111111111','ci-owner','OWNER','ACTIVE',NULL,NULL),
('aaaaaaaa-1111-4111-8111-111111111111','ci-zone','TECHNICIAN','ACTIVE',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444'),
('aaaaaaaa-1111-4111-8111-111111111111','ci-reviewer','REVIEWER','ACTIVE',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444'),
('bbbbbbbb-2222-4222-8222-222222222222','ci-other','OWNER','ACTIVE',NULL,NULL);
INSERT INTO grow_private.dashboard_identities(tenant_id,subject_id,cert_fingerprint)
VALUES
('aaaaaaaa-1111-4111-8111-111111111111','ci-owner',sha256(convert_to('grow-ci-cert-owner','UTF8'))),
('aaaaaaaa-1111-4111-8111-111111111111','ci-zone',sha256(convert_to('grow-ci-cert-zone','UTF8'))),
('aaaaaaaa-1111-4111-8111-111111111111','ci-reviewer',sha256(convert_to('grow-ci-cert-reviewer','UTF8'))),
('bbbbbbbb-2222-4222-8222-222222222222','ci-other',sha256(convert_to('grow-ci-cert-other','UTF8')));
INSERT INTO grow_private.inventory_lots_v2
(tenant_id,lot_id,facility_id,zone_id,kind,unit,label,created_by)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000321',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'INPUT','g','Internal export fixture','ci-owner');
INSERT INTO grow_private.ai_consents
(tenant_id,consent_id,facility_id,zone_id,actor_subject,purpose,granted)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000322',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'ci-owner','CULTIVATION_ADVICE',true);
INSERT INTO grow_private.ai_advice_jobs
(tenant_id,job_id,facility_id,zone_id,consent_id,source_kind,source_id,requested_by,requested_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000323',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'aaaaaaaa-0000-4000-8000-000000000322','PLANT',
'aaaaaaaa-6666-4666-8666-666666666668','ci-owner',now());
INSERT INTO grow_private.ai_recommendations
(tenant_id,recommendation_id,job_id,facility_id,zone_id,provider,model,text,explanation,limitations,confidence,created_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000324',
'aaaaaaaa-0000-4000-8000-000000000323','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','trusted-test','fixture-v1',
'Inspect the historical reading','Synthetic fixture, not an agronomic recommendation',
'Human review only','LOW',now());
COMMIT;

-- V2-14: second facility for same tenant must not be enumerable by zone-scoped staff.
INSERT INTO grow_private.facilities(tenant_id,facility_id,name)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-3333-4333-8333-333333333334','Restricted other facility');
