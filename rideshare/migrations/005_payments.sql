CREATE TABLE liftd.trip_financial_timing (
  trip_id text PRIMARY KEY REFERENCES liftd.trips(trip_id),
  requested_at bigint NOT NULL CHECK(requested_at>=0),
  assigned_at bigint CHECK(assigned_at>=requested_at),
  ended_at bigint CHECK(ended_at>=COALESCE(assigned_at,requested_at))
);
CREATE FUNCTION liftd.financial_timing_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.trip_id<>OLD.trip_id OR NEW.requested_at<>OLD.requested_at OR
    (OLD.assigned_at IS NOT NULL AND NEW.assigned_at IS DISTINCT FROM OLD.assigned_at) OR
    (OLD.ended_at IS NOT NULL AND NEW.ended_at IS DISTINCT FROM OLD.ended_at) THEN
    RAISE EXCEPTION 'immutable financial timing' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER financial_timing_guard BEFORE UPDATE OR DELETE ON liftd.trip_financial_timing FOR EACH ROW EXECUTE FUNCTION liftd.financial_timing_guard();
CREATE TABLE liftd.payment_intents (
  intent_id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES liftd.trip_quotes(trip_id),
  intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL,
  payment_id text GENERATED ALWAYS AS(payload->>'paymentId') STORED UNIQUE NOT NULL,
  invoice_id text GENERATED ALWAYS AS(payload->>'invoiceId') STORED UNIQUE NOT NULL,
  status text NOT NULL CHECK(status IN ('PREPARED','AUTHORIZED','CAPTURED','RECOVERY_REQUIRED','SUPERSEDED')),
  captured boolean NOT NULL DEFAULT false,
  revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
  authority_revision bigint NOT NULL DEFAULT 0 CHECK(authority_revision>=0)
);
CREATE UNIQUE INDEX one_current_payment ON liftd.payment_intents(trip_id) WHERE status<>'SUPERSEDED';
CREATE FUNCTION liftd.payment_state_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.intent_id<>OLD.intent_id OR NEW.trip_id<>OLD.trip_id OR NEW.intent_hash<>OLD.intent_hash OR NEW.payload<>OLD.payload OR NEW.revision<>OLD.revision+1 OR
    NEW.authority_revision<OLD.authority_revision OR (OLD.captured AND NOT NEW.captured) OR
    NOT ((OLD.status='PREPARED' AND NEW.status IN ('AUTHORIZED','RECOVERY_REQUIRED')) OR
         (OLD.status IN ('AUTHORIZED','CAPTURED','RECOVERY_REQUIRED') AND NEW.status IN ('CAPTURED','RECOVERY_REQUIRED')) OR (OLD.status='RECOVERY_REQUIRED' AND NOT OLD.captured AND NEW.status='SUPERSEDED')) THEN
    RAISE EXCEPTION 'invalid financial state' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_state_guard BEFORE UPDATE OR DELETE ON liftd.payment_intents FOR EACH ROW EXECUTE FUNCTION liftd.payment_state_guard();
CREATE TABLE liftd.wallet_consents(intent_id text PRIMARY KEY REFERENCES liftd.payment_intents(intent_id),payload jsonb NOT NULL);
CREATE TABLE liftd.payment_events(event_id text PRIMARY KEY,intent_id text NOT NULL REFERENCES liftd.payment_intents(intent_id),receipt_hash text NOT NULL,digest text NOT NULL,payload jsonb NOT NULL);
CREATE TABLE liftd.financial_receipts(receipt_hash text PRIMARY KEY,owner_id text NOT NULL,owner_kind text NOT NULL CHECK(owner_kind IN ('CAPTURE','OPERATION','FUNDING')));
CREATE TABLE liftd.financial_commands(actor_id text NOT NULL,command_id text NOT NULL,action text NOT NULL,request jsonb NOT NULL,trip_id text NOT NULL REFERENCES liftd.trips(trip_id),result jsonb NOT NULL,PRIMARY KEY(actor_id,command_id));
CREATE TABLE liftd.payout_projections(id bigserial PRIMARY KEY,plan_hash text UNIQUE NOT NULL,trip_id text NOT NULL REFERENCES liftd.trip_quotes(trip_id),payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE liftd.settlement_funding(funding_ref text PRIMARY KEY,trip_id text NOT NULL REFERENCES liftd.trip_quotes(trip_id),payload jsonb NOT NULL);
CREATE TABLE liftd.pay_operations(
  operation_id text PRIMARY KEY,
  trip_id text NOT NULL REFERENCES liftd.trip_quotes(trip_id),
  pay_operation_id text UNIQUE NOT NULL,
  kind text NOT NULL CHECK(kind IN ('refund','driver','platform','passThrough')),
  recipient text NOT NULL,
  amount_cents bigint NOT NULL CHECK(amount_cents>0),
  amount_units text NOT NULL CHECK(amount_units ~ '^[1-9][0-9]{0,77}$'),
  payload jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('RESERVED','FINALIZED','FAILED','RECOVERY_REQUIRED')),
  revision bigint NOT NULL DEFAULT 0
);
CREATE FUNCTION liftd.pay_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR NEW.operation_id<>OLD.operation_id OR NEW.trip_id<>OLD.trip_id OR NEW.pay_operation_id<>OLD.pay_operation_id OR NEW.kind<>OLD.kind OR NEW.recipient<>OLD.recipient OR NEW.amount_cents<>OLD.amount_cents OR NEW.amount_units<>OLD.amount_units OR NEW.payload<>OLD.payload OR NEW.revision<>OLD.revision+1 OR
    NOT ((OLD.status='RESERVED' AND NEW.status IN ('FINALIZED','FAILED')) OR (OLD.status='FINALIZED' AND NEW.status='RECOVERY_REQUIRED') OR (OLD.status='RECOVERY_REQUIRED' AND NEW.status='FINALIZED')) THEN
    RAISE EXCEPTION 'invalid disbursement lifecycle' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pay_operation_guard BEFORE UPDATE OR DELETE ON liftd.pay_operations FOR EACH ROW EXECUTE FUNCTION liftd.pay_operation_guard();
CREATE TABLE liftd.operation_events(event_id text PRIMARY KEY,operation_id text NOT NULL REFERENCES liftd.pay_operations(operation_id),receipt_hash text NOT NULL,digest text NOT NULL,payload jsonb NOT NULL);
CREATE TRIGGER immutable_wallet_consents BEFORE UPDATE OR DELETE ON liftd.wallet_consents FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_payment_events BEFORE UPDATE OR DELETE ON liftd.payment_events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_financial_receipts BEFORE UPDATE OR DELETE ON liftd.financial_receipts FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_financial_commands BEFORE UPDATE OR DELETE ON liftd.financial_commands FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_payout_projections BEFORE UPDATE OR DELETE ON liftd.payout_projections FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_settlement_funding BEFORE UPDATE OR DELETE ON liftd.settlement_funding FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
CREATE TRIGGER immutable_operation_events BEFORE UPDATE OR DELETE ON liftd.operation_events FOR EACH ROW EXECUTE FUNCTION liftd.immutable_history();
REVOKE ALL ON liftd.trip_financial_timing,liftd.payment_intents,liftd.wallet_consents,liftd.payment_events,liftd.financial_receipts,liftd.financial_commands,liftd.payout_projections,liftd.settlement_funding,liftd.pay_operations,liftd.operation_events FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA liftd FROM PUBLIC;
REVOKE ALL ON FUNCTION liftd.financial_timing_guard(),liftd.payment_state_guard(),liftd.pay_operation_guard() FROM PUBLIC;
