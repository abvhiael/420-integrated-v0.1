-- GROW-V2-04 room hierarchy
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.rooms (tenant_id uuid NOT NULL, facility_id uuid NOT NULL, room_id uuid NOT NULL, name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160), revision bigint NOT NULL DEFAULT 1 CHECK(revision>0), PRIMARY KEY(tenant_id,room_id), UNIQUE(tenant_id,facility_id,room_id), FOREIGN KEY(tenant_id,facility_id) REFERENCES grow_private.facilities(tenant_id,facility_id) ON DELETE RESTRICT);
ALTER TABLE grow_private.zones ADD COLUMN room_id uuid;
ALTER TABLE grow_private.zones ADD CONSTRAINT zone_room_parent_fk FOREIGN KEY(tenant_id,facility_id,room_id) REFERENCES grow_private.rooms(tenant_id,facility_id,room_id) ON DELETE RESTRICT;
ALTER TABLE grow_private.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.rooms FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.rooms USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
CREATE INDEX zone_by_room ON grow_private.zones(tenant_id,facility_id,room_id);
COMMIT;
