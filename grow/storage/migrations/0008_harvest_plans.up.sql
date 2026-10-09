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
COMMIT;
