CREATE TABLE liftd.safety_incidents (
 incident_id text PRIMARY KEY CHECK(incident_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id),
 reporter_id text NOT NULL,
 reporter_role text NOT NULL CHECK(reporter_role IN ('rider','driver')),
 category text NOT NULL CHECK(category IN ('medical','collision','threat','vehicle','other')),
 created_at bigint NOT NULL CHECK(created_at>=0),
 trip_revision bigint NOT NULL CHECK(trip_revision>=0),
 UNIQUE(trip_id,incident_id)
);
CREATE TABLE liftd.safety_commands (
 actor_id text NOT NULL, command_id text NOT NULL, action text NOT NULL CHECK(action='report'),
 trip_id text NOT NULL REFERENCES liftd.trips(trip_id), request_hash text NOT NULL,
 result jsonb NOT NULL, PRIMARY KEY(actor_id,command_id)
);
CREATE TABLE liftd.safety_resolutions (
 trip_id text PRIMARY KEY REFERENCES liftd.trips(trip_id),
 incident_id text NOT NULL REFERENCES liftd.safety_incidents(incident_id),
 resolver_id text NOT NULL, resolved_at bigint NOT NULL CHECK(resolved_at>=0),
 resolution text NOT NULL CHECK(resolution IN ('safe_exit','interrupted')),
 outcome_revision bigint NOT NULL, UNIQUE(incident_id)
);
CREATE TRIGGER immutable_safety_incidents BEFORE UPDATE OR DELETE ON liftd.safety_incidents FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_safety_commands BEFORE UPDATE OR DELETE ON liftd.safety_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_safety_resolutions BEFORE UPDATE OR DELETE ON liftd.safety_resolutions FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
ALTER TABLE liftd.events DROP CONSTRAINT events_action_check;
ALTER TABLE liftd.events ADD CONSTRAINT events_action_check CHECK (action IN ('create','assign','arrive','start','complete','cancel','expire','safety_resolve'));
CREATE OR REPLACE FUNCTION liftd.trip_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
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
          (OLD.state='IN_PROGRESS' AND (NEW.snapshot->>'state') IN ('COMPLETED','CANCELLED'))) THEN
    RAISE EXCEPTION 'invalid trip lifecycle' USING ERRCODE='23514';
  END IF;
  IF OLD.state='IN_PROGRESS' AND (NEW.snapshot->>'state')='CANCELLED' THEN
    IF NOT EXISTS (SELECT 1 FROM liftd.safety_resolutions WHERE trip_id=NEW.trip_id AND outcome_revision=NEW.revision) THEN
      RAISE EXCEPTION 'safety authority required' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON liftd.safety_incidents,liftd.safety_commands,liftd.safety_resolutions FROM PUBLIC;
