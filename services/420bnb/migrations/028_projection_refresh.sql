-- BNB-5.4 durable coalesced projection refresh; authority is never minted here.
CREATE TABLE bnb_projection_work (
 property_id uuid PRIMARY KEY REFERENCES bnb_property(id) ON DELETE CASCADE,
 requested_revision bigint NOT NULL DEFAULT 1 CHECK(requested_revision>0),
 completed_revision bigint NOT NULL DEFAULT 0 CHECK(completed_revision>=0),
 next_refresh_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(completed_revision<=requested_revision)
);
CREATE INDEX bnb_projection_work_due ON bnb_projection_work(next_refresh_at,property_id);

CREATE FUNCTION bnb_request_projection_refresh(pid uuid) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 -- Same property-first lock order as admission and the refresh worker.
 PERFORM id FROM bnb_property WHERE id=pid FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 INSERT INTO bnb_projection_work(property_id) VALUES(pid)
 ON CONFLICT(property_id) DO UPDATE SET
 requested_revision=bnb_projection_work.requested_revision+1,
 next_refresh_at=clock_timestamp();
 UPDATE bnb_availability_projection SET invalidated_at=clock_timestamp()
 WHERE property_id=pid AND invalidated_at IS NULL;
END $$;

CREATE FUNCTION bnb_projection_source_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE before_id uuid; after_id uuid;
BEGIN
 IF TG_TABLE_NAME='bnb_property' THEN
   IF TG_OP<>'INSERT' THEN before_id:=OLD.id; END IF;
   IF TG_OP<>'DELETE' THEN after_id:=NEW.id; END IF;
 ELSE
   IF TG_OP<>'INSERT' THEN before_id:=(to_jsonb(OLD)->>'property_id')::uuid; END IF;
   IF TG_OP<>'DELETE' THEN after_id:=(to_jsonb(NEW)->>'property_id')::uuid; END IF;
 END IF;
 -- Deterministic order for a moved source; updates with identical contents are no-ops.
 IF TG_OP='UPDATE' AND to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
 IF before_id IS NOT NULL AND (after_id IS NULL OR before_id<=after_id) THEN
   PERFORM bnb_request_projection_refresh(before_id);
 END IF;
 IF after_id IS NOT NULL AND after_id IS DISTINCT FROM before_id THEN
   PERFORM bnb_request_projection_refresh(after_id);
 END IF;
 IF before_id IS NOT NULL AND after_id IS NOT NULL AND before_id>after_id THEN
   PERFORM bnb_request_projection_refresh(before_id);
 END IF;
 RETURN NULL;
END $$;
DO $$
DECLARE source text;
BEGIN
 FOREACH source IN ARRAY ARRAY['bnb_property','bnb_unit','bnb_block','bnb_hold',
 'bnb_reservation','bnb_calendar_sync_event','bnb_travel_place_binding',
 'bnb_compliance_eligibility','bnb_property_claim','bnb_property_grant',
 'bnb_listing_review','bnb_listing_policy','bnb_listing_media','bnb_rate_plan'] LOOP
 EXECUTE format('CREATE TRIGGER bnb_projection_dirty AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION bnb_projection_source_changed()',source);
 END LOOP;
END $$;

CREATE FUNCTION bnb_projection_jurisdiction_changed() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE pid uuid; old_j text; new_j text;
BEGIN
 IF TG_OP<>'INSERT' THEN old_j:=OLD.jurisdiction_id; END IF;
 IF TG_OP<>'DELETE' THEN new_j:=NEW.jurisdiction_id; END IF;
 FOR pid IN SELECT property_id FROM bnb_travel_place_binding
 WHERE jurisdiction_id IN (old_j,new_j) ORDER BY property_id LOOP
  PERFORM bnb_request_projection_refresh(pid);
 END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER bnb_projection_dirty AFTER INSERT OR UPDATE OR DELETE ON bnb_travel_jurisdiction_policy
 FOR EACH ROW EXECUTE FUNCTION bnb_projection_jurisdiction_changed();
-- Existing projections enter the queue without fabricated refresh/consumer acceptance.
INSERT INTO bnb_projection_work(property_id) SELECT id FROM bnb_property;
UPDATE bnb_availability_projection SET invalidated_at=clock_timestamp() WHERE invalidated_at IS NULL;
