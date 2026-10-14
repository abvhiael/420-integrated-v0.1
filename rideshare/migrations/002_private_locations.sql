CREATE TABLE liftd.private_locations (
  route_ref text PRIMARY KEY CHECK (route_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  rider_id text NOT NULL CHECK (rider_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  account_id text NOT NULL CHECK (account_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  command_id text NOT NULL CHECK (command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  trip_id text REFERENCES liftd.trips(trip_id),
  expires_at bigint NOT NULL CHECK (expires_at>=0),
  sealed jsonb,
  descriptor jsonb NOT NULL,
  tombstoned boolean NOT NULL DEFAULT false,
  UNIQUE (rider_id,command_id),
  CHECK ((tombstoned AND sealed IS NULL) OR (NOT tombstoned AND sealed IS NOT NULL)),
  CHECK (NOT descriptor ?| ARRAY['latitude','longitude','pickup','dropoff','points','address'])
);
CREATE FUNCTION liftd.location_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'location tombstone must remain' USING ERRCODE='23514'; END IF;
  IF NEW.route_ref<>OLD.route_ref OR NEW.rider_id<>OLD.rider_id OR NEW.account_id<>OLD.account_id OR
     NEW.command_id<>OLD.command_id OR NEW.expires_at<>OLD.expires_at OR NEW.descriptor<>OLD.descriptor OR
     (OLD.trip_id IS NOT NULL AND NEW.trip_id IS DISTINCT FROM OLD.trip_id) OR
     (OLD.tombstoned AND (NOT NEW.tombstoned OR NEW.sealed IS NOT NULL)) OR
     (NEW.sealed IS DISTINCT FROM OLD.sealed AND NOT (NEW.tombstoned AND NEW.sealed IS NULL)) THEN
    RAISE EXCEPTION 'invalid private location lifecycle' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER private_location_guard BEFORE UPDATE OR DELETE ON liftd.private_locations FOR EACH ROW EXECUTE FUNCTION liftd.location_lifecycle();
REVOKE ALL ON liftd.private_locations FROM PUBLIC;
REVOKE ALL ON FUNCTION liftd.location_lifecycle() FROM PUBLIC;
