-- GROW-V2-12: isolated event outbox, scoped source attribution and bounded retries.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.integration_opt_ins(
 tenant_id uuid NOT NULL,facility_id uuid NOT NULL,zone_id uuid NOT NULL,
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 enabled boolean NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,facility_id,zone_id,actor_subject),
 FOREIGN KEY(tenant_id,facility_id,zone_id)
 REFERENCES grow_private.zones(tenant_id,facility_id,zone_id)
);
CREATE TABLE grow_private.integration_outbox(
 tenant_id uuid NOT NULL,event_id uuid NOT NULL,
 facility_id uuid NOT NULL,zone_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('HARVEST_RECORDED','EQUIPMENT_ALERT','AI_REVIEW_READY')),
 source_id uuid NOT NULL,requested_by text NOT NULL,
 state text NOT NULL DEFAULT 'QUEUED'
 CHECK(state IN ('QUEUED','IN_FLIGHT','ACCEPTED','DEAD','REVOKED')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 4),
 claim_token text NOT NULL DEFAULT '',
 lease_until timestamptz,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL,
 accepted_at timestamptz,
 PRIMARY KEY(tenant_id,event_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id)
 REFERENCES grow_private.zones(tenant_id,facility_id,zone_id)
);
CREATE INDEX integration_outbox_pending ON grow_private.integration_outbox
(tenant_id,state,next_attempt_at,event_id);
CREATE FUNCTION grow_private.verify_grow_integration_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE allowed boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM grow_private.integration_opt_ins o
 WHERE o.tenant_id=NEW.tenant_id AND o.facility_id=NEW.facility_id
 AND o.zone_id=NEW.zone_id AND o.actor_subject=NEW.requested_by AND o.enabled)
 INTO allowed;
 IF NOT allowed THEN RAISE EXCEPTION 'integration consent missing' USING ERRCODE='23514'; END IF;
 IF NEW.kind='HARVEST_RECORDED' THEN
  SELECT EXISTS(SELECT 1 FROM grow_private.harvest_records h
  WHERE h.tenant_id=NEW.tenant_id AND h.facility_id=NEW.facility_id
  AND h.zone_id=NEW.zone_id AND h.harvest_id=NEW.source_id) INTO allowed;
 ELSIF NEW.kind='AI_REVIEW_READY' THEN
  SELECT EXISTS(SELECT 1 FROM grow_private.ai_reviews r
  WHERE r.tenant_id=NEW.tenant_id AND r.facility_id=NEW.facility_id
  AND r.zone_id=NEW.zone_id AND r.review_id=NEW.source_id) INTO allowed;
 ELSE
  SELECT EXISTS(SELECT 1 FROM grow_private.equipment e
  WHERE e.tenant_id=NEW.tenant_id AND e.facility_id=NEW.facility_id
  AND e.zone_id=NEW.zone_id AND e.device_id=NEW.source_id) INTO allowed;
 END IF;
 IF NOT allowed THEN RAISE EXCEPTION 'integration source outside authorization scope' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER integration_source_guard BEFORE INSERT ON grow_private.integration_outbox
 FOR EACH ROW EXECUTE FUNCTION grow_private.verify_grow_integration_event();
CREATE FUNCTION grow_private.revoke_integration_events() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT NEW.enabled THEN
  UPDATE grow_private.integration_outbox SET state='REVOKED',claim_token='',lease_until=NULL
  WHERE tenant_id=NEW.tenant_id AND facility_id=NEW.facility_id AND zone_id=NEW.zone_id
  AND requested_by=NEW.actor_subject AND state IN ('QUEUED','IN_FLIGHT');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER integration_opt_out AFTER UPDATE ON grow_private.integration_opt_ins
 FOR EACH ROW WHEN(OLD.enabled IS DISTINCT FROM NEW.enabled)
 EXECUTE FUNCTION grow_private.revoke_integration_events();
ALTER TABLE grow_private.integration_opt_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.integration_opt_ins FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.integration_opt_ins
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
ALTER TABLE grow_private.integration_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.integration_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.integration_outbox
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
COMMIT;
