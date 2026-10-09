-- GROW-V2-11: private AI consent, queued references, immutable human-reviewed outcomes.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.ai_consents(
 tenant_id uuid NOT NULL,
 consent_id uuid NOT NULL,
 facility_id uuid NOT NULL,
 zone_id uuid NOT NULL,
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 purpose text NOT NULL CHECK(purpose='CULTIVATION_ADVICE'),
 granted boolean NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,consent_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id)
);
CREATE TABLE grow_private.ai_advice_jobs(
 tenant_id uuid NOT NULL,
 job_id uuid NOT NULL,
 facility_id uuid NOT NULL,
 zone_id uuid NOT NULL,
 consent_id uuid NOT NULL,
 source_kind text NOT NULL CHECK(source_kind IN ('PLANT','OBSERVATION')),
 source_id uuid NOT NULL,
 requested_by text NOT NULL CHECK(length(requested_by) BETWEEN 1 AND 180),
 requested_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'QUEUED' CHECK(status IN ('QUEUED','COMPLETED','REVOKED')),
 PRIMARY KEY(tenant_id,job_id),
 UNIQUE(tenant_id,job_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,consent_id) REFERENCES grow_private.ai_consents(tenant_id,consent_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id)
);
CREATE TABLE grow_private.ai_recommendations(
 tenant_id uuid NOT NULL,
 recommendation_id uuid NOT NULL,
 job_id uuid NOT NULL,
 facility_id uuid NOT NULL,
 zone_id uuid NOT NULL,
 provider text NOT NULL CHECK(length(provider) BETWEEN 1 AND 128),
 model text NOT NULL CHECK(length(model) BETWEEN 1 AND 128),
 text text NOT NULL CHECK(length(text) BETWEEN 1 AND 3000),
 explanation text NOT NULL CHECK(length(explanation) BETWEEN 1 AND 3000),
 limitations text NOT NULL CHECK(length(limitations) BETWEEN 1 AND 1500),
 confidence text NOT NULL CHECK(confidence IN ('LOW','MEDIUM','HIGH')),
 created_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,recommendation_id),
 UNIQUE(tenant_id,job_id),
 FOREIGN KEY(tenant_id,job_id,facility_id,zone_id)
 REFERENCES grow_private.ai_advice_jobs(tenant_id,job_id,facility_id,zone_id)
);
CREATE TABLE grow_private.ai_reviews(
 tenant_id uuid NOT NULL,
 review_id uuid NOT NULL,
 recommendation_id uuid NOT NULL,
 facility_id uuid NOT NULL,
 zone_id uuid NOT NULL,
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 decision text NOT NULL CHECK(decision IN ('ACCEPTED_FOR_REVIEW','REJECTED')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 1000),
 reviewed_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,review_id),
 UNIQUE(tenant_id,recommendation_id),
 FOREIGN KEY(tenant_id,recommendation_id) REFERENCES grow_private.ai_recommendations(tenant_id,recommendation_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id)
);
CREATE FUNCTION grow_private.block_ai_audit_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AI advice audit history immutable'; END $$;
CREATE TRIGGER ai_recommendations_immutable BEFORE UPDATE OR DELETE ON grow_private.ai_recommendations
 FOR EACH ROW EXECUTE FUNCTION grow_private.block_ai_audit_mutation();
CREATE TRIGGER ai_reviews_immutable BEFORE UPDATE OR DELETE ON grow_private.ai_reviews
 FOR EACH ROW EXECUTE FUNCTION grow_private.block_ai_audit_mutation();
CREATE FUNCTION grow_private.revoke_ai_jobs() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT NEW.granted THEN
  UPDATE grow_private.ai_advice_jobs SET status='REVOKED'
  WHERE tenant_id=NEW.tenant_id AND consent_id=NEW.consent_id AND status='QUEUED';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_consent_revoke AFTER UPDATE ON grow_private.ai_consents
 FOR EACH ROW WHEN(OLD.granted IS DISTINCT FROM NEW.granted)
 EXECUTE FUNCTION grow_private.revoke_ai_jobs();
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['ai_consents','ai_advice_jobs','ai_recommendations','ai_reviews'] LOOP
  EXECUTE format('ALTER TABLE grow_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE grow_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scoped ON grow_private.%I USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant())',t);
 END LOOP;
END $$;
COMMIT;
