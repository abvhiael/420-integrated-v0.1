CREATE TABLE liftd.driver_availability (
  driver_id text PRIMARY KEY CHECK(driver_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  account_id text NOT NULL CHECK(account_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  vehicle_id text NOT NULL CHECK(vehicle_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  online boolean NOT NULL,
  revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
  expires_at bigint NOT NULL CHECK(expires_at>=0),
  session_context jsonb NOT NULL
);
CREATE TABLE liftd.availability_commands (
  driver_id text NOT NULL REFERENCES liftd.driver_availability(driver_id),
  command_id text NOT NULL CHECK(command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  request jsonb NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY(driver_id,command_id)
);
CREATE TRIGGER immutable_availability_commands BEFORE UPDATE OR DELETE ON liftd.availability_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE FUNCTION liftd.availability_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.driver_id<>OLD.driver_id OR NEW.account_id<>OLD.account_id OR NEW.revision<>OLD.revision+1 THEN
    RAISE EXCEPTION 'invalid availability lifecycle' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER availability_guard BEFORE UPDATE OR DELETE ON liftd.driver_availability FOR EACH ROW EXECUTE FUNCTION liftd.availability_lifecycle();
CREATE TABLE liftd.assignment_leases (
  trip_id text PRIMARY KEY REFERENCES liftd.trips(trip_id),
  driver_id text NOT NULL CHECK(driver_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  vehicle_id text NOT NULL CHECK(vehicle_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  expires_at bigint NOT NULL CHECK(expires_at>=0),
  state text NOT NULL CHECK(state IN ('PENDING','ACCEPTED','CLOSED'))
);
CREATE FUNCTION liftd.lease_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.trip_id<>OLD.trip_id OR NEW.driver_id<>OLD.driver_id OR NEW.vehicle_id<>OLD.vehicle_id OR NEW.expires_at<>OLD.expires_at OR
    NOT ((OLD.state='PENDING' AND NEW.state IN ('ACCEPTED','CLOSED')) OR (OLD.state='ACCEPTED' AND NEW.state='CLOSED')) THEN
    RAISE EXCEPTION 'invalid assignment lease lifecycle' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lease_guard BEFORE UPDATE OR DELETE ON liftd.assignment_leases FOR EACH ROW EXECUTE FUNCTION liftd.lease_lifecycle();
ALTER TABLE liftd.events DROP CONSTRAINT events_action_check;
ALTER TABLE liftd.events ADD CONSTRAINT events_action_check CHECK(action IN ('create','assign','arrive','start','complete','cancel','expire'));
REVOKE ALL ON liftd.driver_availability,liftd.availability_commands,liftd.assignment_leases FROM PUBLIC;
REVOKE ALL ON FUNCTION liftd.availability_lifecycle(),liftd.lease_lifecycle() FROM PUBLIC;
