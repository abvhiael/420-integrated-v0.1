-- R02.11 durable tenant-isolated outbox, atomic with canonical order receipts.
BEGIN;
SELECT pg_advisory_xact_lock(4202111);
CREATE TABLE doobr_private.event_outbox (
 tenant_id uuid NOT NULL, event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 command_id uuid NOT NULL, order_id uuid NOT NULL, order_revision bigint NOT NULL,
 event_type text NOT NULL, payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','INFLIGHT','DELIVERED','DEAD')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count BETWEEN 0 AND 100),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_owner uuid, lease_until timestamptz,
 last_error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
 PRIMARY KEY(tenant_id,event_id), UNIQUE(tenant_id,command_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES doobr_private.order_commands(tenant_id,command_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 CHECK((status='INFLIGHT' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL)
 OR (status<>'INFLIGHT' AND lease_owner IS NULL AND lease_until IS NULL))
);
CREATE INDEX outbox_due ON doobr_private.event_outbox(tenant_id,status,next_attempt_at,created_at);
CREATE TABLE doobr_private.event_receipts(
 tenant_id uuid NOT NULL,event_id uuid NOT NULL,consumer_id text NOT NULL,
 receipt_ref text NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id,consumer_id),
 FOREIGN KEY(tenant_id,event_id) REFERENCES doobr_private.event_outbox(tenant_id,event_id),
 CHECK(length(consumer_id) BETWEEN 1 AND 128),CHECK(length(receipt_ref) BETWEEN 1 AND 256)
);
CREATE FUNCTION doobr_private.enqueue_order_command() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, doobr_private AS $
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('doobr.tenant_id',true),'')::uuid THEN
  RAISE EXCEPTION 'tenant context mismatch';
 END IF;
 INSERT INTO doobr_private.event_outbox(tenant_id,command_id,order_id,order_revision,event_type,payload)
 VALUES(NEW.tenant_id,NEW.command_id,NEW.order_id,NEW.applied_revision,
        'ORDER_'||NEW.action,jsonb_build_object('order_id',NEW.order_id,
           'revision',NEW.applied_revision,'state',NEW.target_state,
           'command_id',NEW.command_id));
 RETURN NEW;
END $$;
CREATE TRIGGER order_command_to_outbox AFTER INSERT ON doobr_private.order_commands
 FOR EACH ROW EXECUTE FUNCTION doobr_private.enqueue_order_command();
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['event_outbox','event_receipts'] LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
REVOKE ALL ON doobr_private.event_outbox,doobr_private.event_receipts FROM PUBLIC;
COMMIT;
