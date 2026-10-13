-- R02.10 failed-delivery and return authorization trail.
BEGIN;
SELECT pg_advisory_xact_lock(4202110);
CREATE TABLE doobr_private.return_cases (
 tenant_id uuid NOT NULL, order_id uuid NOT NULL, case_id uuid NOT NULL,
 reason text NOT NULL CHECK(reason IN ('NO_SHOW','RECIPIENT_REJECTED','ID_FAILED','TIMEOUT','UNSAFE_HANDOFF','OTHER_VERIFIED')),
 carrier_policy_ref text NOT NULL CHECK(length(carrier_policy_ref) BETWEEN 1 AND 256),
 deadline_at timestamptz NOT NULL, opened_at timestamptz NOT NULL,
 state text NOT NULL CHECK(state IN ('FAILED','RETURN_REQUIRED','RETURNED','RECONCILED')),
 closed_at timestamptz,
 PRIMARY KEY(tenant_id,order_id),
 UNIQUE(tenant_id,case_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 CHECK(deadline_at>opened_at),
 CHECK((state='RECONCILED' AND closed_at IS NOT NULL) OR (state<>'RECONCILED' AND closed_at IS NULL))
);
CREATE TABLE doobr_private.return_events (
 tenant_id uuid NOT NULL, event_id uuid NOT NULL, order_id uuid NOT NULL,
 command_id uuid NOT NULL, actor_id uuid NOT NULL, action text NOT NULL
 CHECK(action IN ('FAIL_DELIVERY','REQUIRE_RETURN','RETURN','RECONCILE')),
 proof_ciphertext bytea NOT NULL CHECK(octet_length(proof_ciphertext)>28),
 key_version text NOT NULL CHECK(length(key_version)>0),
 recorded_at timestamptz NOT NULL,retention_until timestamptz NOT NULL,
 PRIMARY KEY(tenant_id,event_id),
 UNIQUE(tenant_id,command_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.return_cases(tenant_id,order_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES doobr_private.order_commands(tenant_id,command_id),
 FOREIGN KEY(tenant_id,actor_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 CHECK(retention_until>recorded_at)
);
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['return_cases','return_events'] LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',t);
 END LOOP;
END $$;
REVOKE ALL ON doobr_private.return_cases,doobr_private.return_events FROM PUBLIC;
COMMIT;
