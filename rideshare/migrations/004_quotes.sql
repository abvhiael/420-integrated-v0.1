CREATE TABLE liftd.fare_quotes (
  quote_id text PRIMARY KEY CHECK(quote_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  rider_id text NOT NULL CHECK(rider_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  account_id text NOT NULL CHECK(account_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  route_ref text NOT NULL REFERENCES liftd.private_locations(route_ref),
  issued_at bigint NOT NULL CHECK(issued_at>=0),
  expires_at bigint NOT NULL CHECK(expires_at>issued_at AND expires_at<=issued_at+300),
  quote_hash text NOT NULL CHECK(quote_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL,
  UNIQUE(quote_id,rider_id,account_id,quote_hash),
  CHECK(payload->>'quoteId'=quote_id AND payload->>'riderId'=rider_id AND payload->>'accountId'=account_id AND payload->>'routeRef'=route_ref),
  CHECK((payload->>'issuedAt')::bigint=issued_at AND (payload->>'expiresAt')::bigint=expires_at),
  CHECK(payload->'amounts'->>'currency'='CAD'),
  CHECK(NOT payload ?| ARRAY['pickup','dropoff','latitude','longitude','address'])
);
CREATE TABLE liftd.quote_consents (
  quote_id text PRIMARY KEY,
  rider_id text NOT NULL,
  account_id text NOT NULL,
  quote_hash text NOT NULL,
  accepted_at bigint NOT NULL,
  FOREIGN KEY(quote_id,rider_id,account_id,quote_hash) REFERENCES liftd.fare_quotes(quote_id,rider_id,account_id,quote_hash)
);
CREATE FUNCTION liftd.consent_deadline() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM liftd.fare_quotes WHERE quote_id=NEW.quote_id AND issued_at<=NEW.accepted_at AND expires_at>NEW.accepted_at) THEN
    RAISE EXCEPTION 'quote consent outside deadline' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_deadline_guard BEFORE INSERT ON liftd.quote_consents FOR EACH ROW EXECUTE FUNCTION liftd.consent_deadline();
CREATE TABLE liftd.quote_commands (
  rider_id text NOT NULL,
  command_id text NOT NULL CHECK(command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  action text NOT NULL CHECK(action IN ('issue','accept')),
  request jsonb NOT NULL,
  quote_id text NOT NULL REFERENCES liftd.fare_quotes(quote_id),
  result jsonb NOT NULL,
  PRIMARY KEY(rider_id,command_id)
);
CREATE TABLE liftd.trip_quotes (
  trip_id text PRIMARY KEY REFERENCES liftd.trips(trip_id),
  quote_id text UNIQUE NOT NULL REFERENCES liftd.quote_consents(quote_id)
);
CREATE TABLE liftd.trip_viability (
  trip_id text NOT NULL REFERENCES liftd.trip_quotes(trip_id),
  revision bigint NOT NULL CHECK(revision>0),
  payload jsonb NOT NULL,
  PRIMARY KEY(trip_id,revision)
);
CREATE TABLE liftd.subsidy_bindings (
  funding_ref text PRIMARY KEY CHECK(funding_ref ~ '^[A-Za-z0-9_-]{1,128}$'),
  trip_id text NOT NULL REFERENCES liftd.trip_quotes(trip_id)
);
CREATE TRIGGER immutable_subsidy_bindings BEFORE UPDATE OR DELETE ON liftd.subsidy_bindings FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TABLE liftd.cancellation_assessments (
  trip_id text PRIMARY KEY REFERENCES liftd.trip_quotes(trip_id),
  quote_id text NOT NULL REFERENCES liftd.quote_consents(quote_id),
  revision bigint NOT NULL CHECK(revision>0),
  payload jsonb NOT NULL,
  CHECK((payload->>'riderFeeCents')::bigint=0)
);
CREATE TRIGGER immutable_fare_quotes BEFORE UPDATE OR DELETE ON liftd.fare_quotes FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_quote_consents BEFORE UPDATE OR DELETE ON liftd.quote_consents FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_quote_commands BEFORE UPDATE OR DELETE ON liftd.quote_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_trip_quotes BEFORE UPDATE OR DELETE ON liftd.trip_quotes FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_trip_viability BEFORE UPDATE OR DELETE ON liftd.trip_viability FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_cancellation_assessments BEFORE UPDATE OR DELETE ON liftd.cancellation_assessments FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.fare_quotes,liftd.quote_consents,liftd.quote_commands,liftd.trip_quotes,liftd.trip_viability,liftd.cancellation_assessments,liftd.subsidy_bindings FROM PUBLIC;
REVOKE ALL ON FUNCTION liftd.consent_deadline() FROM PUBLIC;
