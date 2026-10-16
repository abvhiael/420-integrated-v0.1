-- Operator observations and recovery evidence are append-only, private and bounded.
CREATE TABLE liftd.operator_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text NOT NULL,
  account_id text NOT NULL,
  trip_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('monitor','incident.read','incident.resolve')),
  result text NOT NULL CHECK (result IN ('READ','CANCELLED')),
  command_id text,
  recorded_at bigint NOT NULL CHECK (recorded_at >= 0),
  CHECK (actor_id ~ '^[A-Za-z0-9_-]{1,128}$' AND account_id ~ '^[A-Za-z0-9_-]{1,128}$'
    AND trip_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  CHECK (command_id IS NULL OR command_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  CHECK ((action = 'incident.resolve') = (command_id IS NOT NULL))
);
CREATE UNIQUE INDEX operator_audit_recovery_once ON liftd.operator_audit(actor_id, command_id) WHERE command_id IS NOT NULL;
CREATE INDEX operator_audit_trip_order ON liftd.operator_audit(trip_id, id);
REVOKE ALL ON liftd.operator_audit FROM PUBLIC;
