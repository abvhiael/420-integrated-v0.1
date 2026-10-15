CREATE TABLE liftd.trips (
  trip_id text PRIMARY KEY CHECK (trip_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  snapshot jsonb NOT NULL,
  state text GENERATED ALWAYS AS (snapshot->>'state') STORED NOT NULL,
  driver_id text GENERATED ALWAYS AS (snapshot->>'driverId') STORED,
  vehicle_id text GENERATED ALWAYS AS (snapshot->>'vehicleId') STORED,
  CHECK (snapshot = jsonb_build_object('id',trip_id,'revision',revision,'riderId',snapshot->>'riderId',
    'driverId',snapshot->>'driverId','vehicleId',snapshot->>'vehicleId','routeRef',snapshot->>'routeRef','state',snapshot->>'state')),
  CHECK ((snapshot->>'riderId') IS NOT NULL AND (snapshot->>'routeRef') IS NOT NULL AND (snapshot->>'riderId') ~ '^[A-Za-z0-9_-]{1,128}$' AND (snapshot->>'routeRef') ~ '^[A-Za-z0-9_-]{1,128}$'),
  CHECK (state IN ('REQUESTED','ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED','CANCELLED')),
  CHECK ((driver_id IS NULL) = (vehicle_id IS NULL)),
  CHECK (driver_id IS NULL OR (driver_id ~ '^[A-Za-z0-9_-]{1,128}$' AND vehicle_id ~ '^[A-Za-z0-9_-]{1,128}$' AND driver_id <> snapshot->>'riderId')),
  CHECK (state <> 'REQUESTED' OR driver_id IS NULL),
  CHECK (state NOT IN ('ASSIGNED','ARRIVED','IN_PROGRESS','COMPLETED') OR driver_id IS NOT NULL)
);
CREATE UNIQUE INDEX active_driver_once ON liftd.trips(driver_id) WHERE state IN ('ASSIGNED','ARRIVED','IN_PROGRESS');
CREATE UNIQUE INDEX active_vehicle_once ON liftd.trips(vehicle_id) WHERE state IN ('ASSIGNED','ARRIVED','IN_PROGRESS');
CREATE TABLE liftd.events (
  trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
  revision bigint NOT NULL,
  actor_id text NOT NULL CHECK (actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  command_id text NOT NULL CHECK (command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  action text NOT NULL CHECK (action IN ('create','assign','arrive','start','complete','cancel')),
  snapshot jsonb NOT NULL,
  previous_hash text NOT NULL CHECK (previous_hash ~ '^[a-f0-9]{64}$'),
  event_hash text NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (trip_id, revision),
  CHECK (snapshot->>'id' = trip_id AND (snapshot->>'revision')::numeric = revision)
);
CREATE TABLE liftd.commands (
  actor_id text NOT NULL CHECK (actor_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  command_id text NOT NULL CHECK (command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
  revision bigint NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (actor_id,command_id),
  FOREIGN KEY (trip_id, revision) REFERENCES liftd.events(trip_id,revision)
);
CREATE FUNCTION liftd.immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'immutable liftd history' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON liftd.events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_commands BEFORE UPDATE OR DELETE ON liftd.commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE FUNCTION liftd.trip_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'trip deletion denied' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.revision<>0 OR (NEW.snapshot->>'state')<>'REQUESTED' OR (NEW.snapshot->>'driverId') IS NOT NULL THEN RAISE EXCEPTION 'invalid initial trip' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.trip_id<>OLD.trip_id OR NEW.revision<>OLD.revision+1 OR
     NEW.snapshot->>'riderId' IS DISTINCT FROM OLD.snapshot->>'riderId' OR
     NEW.snapshot->>'routeRef' IS DISTINCT FROM OLD.snapshot->>'routeRef' OR
     (OLD.state<>'REQUESTED' AND ((NEW.snapshot->>'driverId') IS DISTINCT FROM OLD.driver_id OR (NEW.snapshot->>'vehicleId') IS DISTINCT FROM OLD.vehicle_id)) OR
     (OLD.state='REQUESTED' AND (NEW.snapshot->>'state')='CANCELLED' AND (NEW.snapshot->>'driverId') IS NOT NULL) OR
     NOT ((OLD.state='REQUESTED' AND (NEW.snapshot->>'state') IN ('ASSIGNED','CANCELLED')) OR
          (OLD.state='ASSIGNED' AND (NEW.snapshot->>'state') IN ('ARRIVED','CANCELLED')) OR
          (OLD.state='ARRIVED' AND (NEW.snapshot->>'state') IN ('IN_PROGRESS','CANCELLED')) OR
          (OLD.state='IN_PROGRESS' AND (NEW.snapshot->>'state')='COMPLETED')) THEN
    RAISE EXCEPTION 'invalid trip lifecycle' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_guard BEFORE INSERT OR UPDATE OR DELETE ON liftd.trips FOR EACH ROW EXECUTE FUNCTION liftd.trip_lifecycle();
REVOKE ALL ON ALL TABLES IN SCHEMA liftd FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA liftd FROM PUBLIC;
