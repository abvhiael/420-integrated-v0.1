-- R02.12 tamper-evident operational audit metadata and instance heartbeats.
BEGIN;
SELECT pg_advisory_xact_lock(4202112);
CREATE TABLE doobr_private.operation_audit (
 tenant_id uuid NOT NULL, audit_id bigint GENERATED ALWAYS AS IDENTITY,
 order_id uuid, command_id uuid, action text NOT NULL CHECK(length(action) BETWEEN 1 AND 96),
 actor_ref uuid, occurred_at timestamptz NOT NULL DEFAULT now(),
 prev_digest bytea NOT NULL CHECK(octet_length(prev_digest)=32),
 entry_digest bytea NOT NULL CHECK(octet_length(entry_digest)=32),
 PRIMARY KEY(tenant_id,audit_id), UNIQUE(tenant_id,command_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES doobr_private.order_commands(tenant_id,command_id)
);
CREATE TABLE doobr_private.instance_heartbeats (
 tenant_id uuid NOT NULL REFERENCES doobr_private.tenants(tenant_id),
 instance_id uuid NOT NULL, role text NOT NULL CHECK(role IN ('API','OUTBOX','SCHEDULER','MAINTENANCE')),
 last_seen_at timestamptz NOT NULL, started_at timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,instance_id), CHECK(last_seen_at>=started_at)
);
CREATE INDEX doobr_instance_last_seen ON doobr_private.instance_heartbeats(tenant_id,role,last_seen_at);
CREATE FUNCTION doobr_private.audit_order_command() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,doobr_private AS $audit$
DECLARE previous bytea; stamp timestamptz; digest bytea;
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('doobr.tenant_id',true),'')::uuid THEN
  RAISE EXCEPTION 'audit tenant mismatch';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text,4202112));
 SELECT entry_digest INTO previous FROM doobr_private.operation_audit
  WHERE tenant_id=NEW.tenant_id ORDER BY audit_id DESC LIMIT 1;
 previous:=coalesce(previous,decode(repeat('00',32),'hex'));
 stamp:=clock_timestamp();
 digest:=sha256(previous||convert_to(NEW.command_id::text||':'||NEW.order_id::text||':'||
  NEW.action||':'||NEW.applied_revision::text||':'||to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US'),'UTF8'));
 INSERT INTO doobr_private.operation_audit(tenant_id,order_id,command_id,action,actor_ref,occurred_at,prev_digest,entry_digest)
 VALUES(NEW.tenant_id,NEW.order_id,NEW.command_id,NEW.action,NEW.actor_id,stamp,previous,digest);
 RETURN NEW;
END $audit$;
CREATE TRIGGER order_command_audit AFTER INSERT ON doobr_private.order_commands
FOR EACH ROW EXECUTE FUNCTION doobr_private.audit_order_command();
CREATE FUNCTION doobr_private.block_audit_modification() RETURNS trigger
LANGUAGE plpgsql AS $block$
BEGIN RAISE EXCEPTION 'operation audit is append-only'; END $block$;
CREATE TRIGGER deny_operation_audit_mutation BEFORE UPDATE OR DELETE ON doobr_private.operation_audit
FOR EACH ROW EXECUTE FUNCTION doobr_private.block_audit_modification();
DO $rls$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['operation_audit','instance_heartbeats'] LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $rls$;
REVOKE ALL ON doobr_private.operation_audit,doobr_private.instance_heartbeats FROM PUBLIC;
COMMIT;
