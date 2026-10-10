-- GROW-V2-05: cultivation genetics lineage and lifecycle audit, scoped per tenant.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.cultivars(
 tenant_id uuid NOT NULL REFERENCES grow_private.tenants(tenant_id),
 cultivar_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 description text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,cultivar_id));
ALTER TABLE grow_private.plants ADD COLUMN cultivar_id uuid;
ALTER TABLE grow_private.plants ADD CONSTRAINT cultivar_tenant_fk
 FOREIGN KEY(tenant_id,cultivar_id) REFERENCES grow_private.cultivars(tenant_id,cultivar_id) ON DELETE RESTRICT;
CREATE TABLE grow_private.plant_events(
 tenant_id uuid NOT NULL, event_id uuid NOT NULL, plant_id uuid NOT NULL,
 actor_subject text NOT NULL CHECK(length(actor_subject)>0),
 from_state text, to_state text NOT NULL,
 expected_revision bigint NOT NULL CHECK(expected_revision>0),
 occurred_at timestamptz NOT NULL DEFAULT now(), note text NOT NULL DEFAULT '',
 PRIMARY KEY(tenant_id,event_id), UNIQUE(tenant_id,plant_id,expected_revision),
 FOREIGN KEY(tenant_id,plant_id) REFERENCES grow_private.plants(tenant_id,plant_id),
 CHECK(from_state IS DISTINCT FROM to_state));
CREATE INDEX lineage_parent ON grow_private.plant_lineage(tenant_id,parent_id);
-- Enforce graph acyclicity in database, including concurrent additions via
-- per-tenant transaction advisory lock acquired before ancestor traversal.
CREATE FUNCTION grow_private.prevent_lineage_cycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cyclic boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text, 420205));
 WITH RECURSIVE ancestors(id) AS (
  SELECT parent_id FROM grow_private.plant_lineage
   WHERE tenant_id=NEW.tenant_id AND child_id=NEW.parent_id
  UNION
  SELECT l.parent_id FROM grow_private.plant_lineage l JOIN ancestors a ON l.child_id=a.id
   WHERE l.tenant_id=NEW.tenant_id
 ) SELECT EXISTS(SELECT 1 FROM ancestors WHERE id=NEW.child_id) INTO cyclic;
 IF cyclic OR NEW.child_id=NEW.parent_id THEN
  RAISE EXCEPTION 'plant genealogy cycle prohibited';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prevent_lineage_cycle BEFORE INSERT OR UPDATE ON grow_private.plant_lineage
 FOR EACH ROW EXECUTE FUNCTION grow_private.prevent_lineage_cycle();
ALTER TABLE grow_private.cultivars ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.cultivars FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.cultivars
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
ALTER TABLE grow_private.plant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.plant_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.plant_events
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
COMMIT;
