-- GROW-V2-03: PostgreSQL 15+ schema. Application data, never Genesis state.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE SCHEMA IF NOT EXISTS grow_private;
REVOKE ALL ON SCHEMA grow_private FROM PUBLIC;
CREATE TABLE grow_private.schema_migrations(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE grow_private.tenants(
 tenant_id uuid PRIMARY KEY, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 visibility text NOT NULL DEFAULT 'PRIVATE' CHECK(visibility='PRIVATE'),
 jurisdiction text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revision bigint NOT NULL DEFAULT 1 CHECK(revision>0));
CREATE TABLE grow_private.memberships(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id) ON DELETE RESTRICT,
 subject_id text NOT NULL CHECK(length(subject_id) BETWEEN 1 AND 180),
 role text NOT NULL CHECK(role IN ('OWNER','MANAGER','TECHNICIAN','REVIEWER','MAINTAINER')),
 state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','SUSPENDED','REVOKED')),
 facility_id uuid, zone_id uuid, revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,subject_id));
CREATE TABLE grow_private.facilities(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id) ON DELETE RESTRICT,
 facility_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,facility_id));
CREATE TABLE grow_private.zones(
 tenant_id uuid NOT NULL, facility_id uuid NOT NULL, zone_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(tenant_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,facility_id) REFERENCES grow_private.facilities(tenant_id,facility_id) ON DELETE RESTRICT);
ALTER TABLE grow_private.memberships ADD CONSTRAINT member_facility_fk FOREIGN KEY(tenant_id,facility_id)
 REFERENCES grow_private.facilities(tenant_id,facility_id) ON DELETE RESTRICT;
ALTER TABLE grow_private.memberships ADD CONSTRAINT member_zone_fk FOREIGN KEY(tenant_id,facility_id,zone_id)
 REFERENCES grow_private.zones(tenant_id,facility_id,zone_id) ON DELETE RESTRICT;
ALTER TABLE grow_private.memberships ADD CONSTRAINT member_zone_requires_facility CHECK(zone_id IS NULL OR facility_id IS NOT NULL);
CREATE TABLE grow_private.plants(
 tenant_id uuid NOT NULL, facility_id uuid NOT NULL, zone_id uuid NOT NULL,
 plant_id uuid NOT NULL, label text NOT NULL CHECK(length(label) BETWEEN 1 AND 160),
 state text NOT NULL CHECK(state IN ('SEED','CLONE','VEGETATIVE','FLOWERING','HARVESTED','RETIRED')),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0), recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,plant_id), UNIQUE(tenant_id,plant_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id));
CREATE TABLE grow_private.plant_lineage(
 tenant_id uuid NOT NULL, child_id uuid NOT NULL, parent_id uuid NOT NULL,
 relation text NOT NULL CHECK(relation IN ('SEED_PARENT','CLONE_PARENT')),
 PRIMARY KEY(tenant_id,child_id,parent_id),
 FOREIGN KEY(tenant_id,child_id) REFERENCES grow_private.plants(tenant_id,plant_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,parent_id) REFERENCES grow_private.plants(tenant_id,plant_id) ON DELETE RESTRICT,
 CHECK(child_id <> parent_id));
CREATE TABLE grow_private.observations(
 tenant_id uuid NOT NULL, observation_id uuid NOT NULL,
 facility_id uuid NOT NULL, zone_id uuid NOT NULL,
 kind text NOT NULL, reading numeric NOT NULL, unit text NOT NULL,
 measured_at timestamptz NOT NULL, source text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,observation_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id));
CREATE TABLE grow_private.inventory_lots(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id),
 lot_id uuid NOT NULL, category text NOT NULL, unit text NOT NULL, balance numeric NOT NULL DEFAULT 0 CHECK(balance>=0),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 PRIMARY KEY(tenant_id,lot_id));
CREATE TABLE grow_private.inventory_movements(
 tenant_id uuid NOT NULL, movement_id uuid NOT NULL, lot_id uuid NOT NULL,
 quantity_delta numeric NOT NULL CHECK(quantity_delta<>0), actor_subject text NOT NULL,
 reason text NOT NULL, idempotency_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,movement_id), UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,lot_id) REFERENCES grow_private.inventory_lots(tenant_id,lot_id));
CREATE TABLE grow_private.harvests(
 tenant_id uuid NOT NULL, harvest_id uuid NOT NULL, plant_id uuid NOT NULL,
 amount numeric NOT NULL CHECK(amount>=0), unit text NOT NULL,
 harvested_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,harvest_id),
 FOREIGN KEY(tenant_id,plant_id) REFERENCES grow_private.plants(tenant_id,plant_id));
CREATE TABLE grow_private.consents(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id),
 consent_id uuid NOT NULL, subject_id text NOT NULL, purpose text NOT NULL,
 granted boolean NOT NULL DEFAULT false, changed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,consent_id));
CREATE TABLE grow_private.export_jobs(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id),
 job_id uuid NOT NULL, actor_subject text NOT NULL,
 status text NOT NULL CHECK(status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,job_id));
CREATE TABLE grow_private.audit_events(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id),
 event_id uuid NOT NULL, actor_subject text NOT NULL,
 action text NOT NULL, resource_id text NOT NULL, outcome text NOT NULL,
 event_at timestamptz NOT NULL DEFAULT now(), revision bigint NOT NULL CHECK(revision>0),
 PRIMARY KEY(tenant_id,event_id));
CREATE INDEX plant_tenant_zone ON grow_private.plants(tenant_id,facility_id,zone_id);
CREATE INDEX observations_tenant_time ON grow_private.observations(tenant_id,measured_at DESC);
CREATE INDEX audit_tenant_time ON grow_private.audit_events(tenant_id,event_at DESC);
CREATE INDEX movements_tenant_time ON grow_private.inventory_movements(tenant_id,created_at DESC);
-- Strict RLS: FORCE prevents table owners accidentally reading private tenant data.
-- Runtime DB role MUST NOT own these tables or carry BYPASSRLS.
CREATE FUNCTION grow_private.current_tenant() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('grow.tenant_id',true),'')::uuid
$$;
REVOKE ALL ON FUNCTION grow_private.current_tenant() FROM PUBLIC;
DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='grow_private' AND tablename <> 'schema_migrations'
 LOOP
  EXECUTE format('ALTER TABLE grow_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE grow_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scoped ON grow_private.%I USING (tenant_id = grow_private.current_tenant()) WITH CHECK (tenant_id = grow_private.current_tenant())',t);
 END LOOP;
END $$;
-- Only a privileged offline migration owner gets DDL rights.
-- Dedicated app login is provisioned by operator, has no table ownership or BYPASSRLS.
-- Schema migration ledger is intentionally not granted to runtime.
COMMIT;
