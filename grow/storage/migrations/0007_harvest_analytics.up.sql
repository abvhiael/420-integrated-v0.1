-- GROW-V2-09 tenant-private immutable harvest observations and production analytics
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.harvest_records(
 tenant_id uuid NOT NULL, harvest_id uuid NOT NULL,
 facility_id uuid NOT NULL, zone_id uuid NOT NULL, plant_id uuid NOT NULL,
 weight_grams numeric NOT NULL CHECK(weight_grams>0 AND weight_grams<=1000000),
 harvested_at timestamptz NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 source text NOT NULL CHECK(length(source) BETWEEN 1 AND 128),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 PRIMARY KEY(tenant_id,harvest_id), UNIQUE(tenant_id,idempotency_key), UNIQUE(tenant_id,plant_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,plant_id) REFERENCES grow_private.plants(tenant_id,plant_id)
);
CREATE INDEX harvest_records_history ON grow_private.harvest_records
 (tenant_id,facility_id,zone_id,harvested_at,harvest_id);
ALTER TABLE grow_private.harvest_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.harvest_records FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.harvest_records
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
CREATE FUNCTION grow_private.reject_harvest_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'harvest observations are immutable'; END $$;
CREATE TRIGGER harvest_immutable BEFORE UPDATE OR DELETE ON grow_private.harvest_records
 FOR EACH ROW EXECUTE FUNCTION grow_private.reject_harvest_mutation();
COMMIT;
