-- GROW-V2-08 tenant-private nutrient, irrigation and environmental journal
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.cultivation_events(
 tenant_id uuid NOT NULL, event_id uuid NOT NULL, facility_id uuid NOT NULL, zone_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('NUTRIENT','IRRIGATION','ENVIRONMENT')),
 metric text NOT NULL CHECK(metric IN ('NUTRIENT_EC','NUTRIENT_PH','NUTRIENT_VOLUME','IRRIGATION_VOLUME','ENV_TEMPERATURE','ENV_HUMIDITY')),
 amount numeric NOT NULL, unit text NOT NULL,
 occurred_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 source text NOT NULL CHECK(length(source) BETWEEN 1 AND 128),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 PRIMARY KEY(tenant_id,event_id), UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 CHECK(
  (kind='NUTRIENT' AND ((metric='NUTRIENT_EC' AND unit='mS/cm' AND amount BETWEEN 0 AND 100) OR
                        (metric='NUTRIENT_PH' AND unit='pH' AND amount BETWEEN 0 AND 14) OR
                        (metric='NUTRIENT_VOLUME' AND unit='L' AND amount BETWEEN 0 AND 100000))) OR
  (kind='IRRIGATION' AND metric='IRRIGATION_VOLUME' AND unit='L' AND amount BETWEEN 0 AND 100000) OR
  (kind='ENVIRONMENT' AND ((metric='ENV_TEMPERATURE' AND unit='C' AND amount BETWEEN -50 AND 100) OR
                           (metric='ENV_HUMIDITY' AND unit='%' AND amount BETWEEN 0 AND 100)))
 )
);
CREATE INDEX cultivation_events_history ON grow_private.cultivation_events
 (tenant_id,facility_id,zone_id,kind,occurred_at,event_id);
ALTER TABLE grow_private.cultivation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.cultivation_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.cultivation_events
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
-- Journal is append-only for the normal runtime. Corrections require a new audited event.
CREATE FUNCTION grow_private.reject_cultivation_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'cultivation event journal is immutable'; END $$;
CREATE TRIGGER cultivation_immutable BEFORE UPDATE OR DELETE ON grow_private.cultivation_events
 FOR EACH ROW EXECUTE FUNCTION grow_private.reject_cultivation_mutation();
COMMIT;
