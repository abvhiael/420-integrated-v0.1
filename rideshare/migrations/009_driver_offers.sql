-- Offer replies use canonical trip/lease state, not a second booking authority.
CREATE TABLE liftd.offer_commands (
 driver_id text NOT NULL CHECK(driver_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 command_id text NOT NULL CHECK(command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 offer_id text NOT NULL CHECK(offer_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 request jsonb NOT NULL,
 result jsonb NOT NULL,
 PRIMARY KEY(driver_id,command_id)
);
CREATE TRIGGER immutable_offer_commands BEFORE UPDATE OR DELETE ON liftd.offer_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
ALTER TABLE liftd.events DROP CONSTRAINT events_action_check;
ALTER TABLE liftd.events ADD CONSTRAINT events_action_check CHECK(action IN ('create','assign','arrive','start','complete','cancel','expire','safety_resolve','offer_reject'));
CREATE OR REPLACE FUNCTION liftd.lease_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.trip_id<>OLD.trip_id OR NEW.driver_id<>OLD.driver_id OR NEW.vehicle_id<>OLD.vehicle_id OR NEW.expires_at<>OLD.expires_at OR
   NOT ((OLD.state='PENDING' AND NEW.state IN ('ACCEPTED','CLOSED')) OR (OLD.state='ACCEPTED' AND NEW.state='CLOSED')) THEN
  RAISE EXCEPTION 'invalid assignment lease lifecycle' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON liftd.offer_commands FROM PUBLIC;
