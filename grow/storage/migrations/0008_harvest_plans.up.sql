-- GROW-V2-09 tenant-private planned harvest calendar
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.harvest_plans(
 tenant_id uuid NOT NULL, facility_id uuid NOT NULL, zone_id uuid NOT NULL, plant_id uuid NOT NULL,
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 source text NOT NULL CHECK(length(source) BETWEEN 1 AND 128),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,plant_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,plant_id) REFERENCES grow_private.plants(tenant_id,plant_id),
 CHECK(start_at<end_at AND end_at-start_at<=interval '180 days')
);
CREATE INDEX harvest_plans_calendar ON grow_private.harvest_plans
 (tenant_id,facility_id,zone_id,start_at,plant_id);
ALTER TABLE grow_private.harvest_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.harvest_plans FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.harvest_plans
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
CREATE TABLE grow_private.harvest_plan_events(
 tenant_id uuid NOT NULL, event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 plant_id uuid NOT NULL, facility_id uuid NOT NULL, zone_id uuid NOT NULL,
 old_start_at timestamptz, old_end_at timestamptz,
 new_start_at timestamptz NOT NULL, new_end_at timestamptz NOT NULL,
 actor_subject text NOT NULL, source text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id),
 FOREIGN KEY(tenant_id,plant_id) REFERENCES grow_private.plants(tenant_id,plant_id)
);
CREATE INDEX harvest_plan_events_by_plant ON grow_private.harvest_plan_events(tenant_id,plant_id,changed_at);
ALTER TABLE grow_private.harvest_plan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.harvest_plan_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.harvest_plan_events
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
CREATE FUNCTION grow_private.record_harvest_plan_change() RETURNS trigger
 LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO grow_private.harvest_plan_events
 (tenant_id,plant_id,facility_id,zone_id,old_start_at,old_end_at,new_start_at,new_end_at,actor_subject,source)
 VALUES(NEW.tenant_id,NEW.plant_id,NEW.facility_id,NEW.zone_id,
 CASE WHEN TG_OP='UPDATE' THEN OLD.start_at ELSE NULL END,
 CASE WHEN TG_OP='UPDATE' THEN OLD.end_at ELSE NULL END,
 NEW.start_at,NEW.end_at,NEW.actor_subject,NEW.source);
 RETURN NEW;
END $$;
CREATE TRIGGER harvest_plan_audit AFTER INSERT OR UPDATE ON grow_private.harvest_plans
 FOR EACH ROW EXECUTE FUNCTION grow_private.record_harvest_plan_change();
CREATE FUNCTION grow_private.reject_harvest_plan_event_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'harvest plan events are immutable'; END $$;
CREATE TRIGGER harvest_plan_event_immutable BEFORE UPDATE OR DELETE ON grow_private.harvest_plan_events
 FOR EACH ROW EXECUTE FUNCTION grow_private.reject_harvest_plan_event_mutation();
COMMIT;
