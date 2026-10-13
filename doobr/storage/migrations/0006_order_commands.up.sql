-- R02.6 durable order command ledger: immutable receipts, bounded replay and tenant isolation.
BEGIN;
SELECT pg_advisory_xact_lock(4202106);
CREATE TABLE doobr_private.order_commands (
 tenant_id uuid NOT NULL,
 command_id uuid NOT NULL,
 order_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 action text NOT NULL CHECK (action IN ('CANCEL','EXPIRE','APPROVE_ELIGIBILITY','READY_PICKUP','OFFER','ASSIGN','PICKUP','START_TRANSIT','START_HANDOFF','DELIVER','CLOSE','FAIL_DELIVERY','REQUIRE_RETURN','RETURN','RECONCILE','DISPUTE')),
 target_state text NOT NULL CHECK (target_state IN ('CANCELLED','EXPIRED','ELIGIBLE','RETAILER_READY','OFFERED','ASSIGNED','PICKED_UP','IN_TRANSIT','HANDOFF_PENDING','DELIVERED','CLOSED','DELIVERY_FAILED','RETURN_REQUIRED','RETURNED','RECONCILED','DISPUTED')),
 request_digest bytea NOT NULL CHECK(octet_length(request_digest)=32),
 expected_revision bigint NOT NULL CHECK(expected_revision>0),
 applied_revision bigint NOT NULL CHECK(applied_revision=expected_revision+1),
 committed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,command_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,actor_id) REFERENCES doobr_private.actors(tenant_id,actor_id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,order_id,applied_revision)
);
CREATE INDEX order_commands_order_seq ON doobr_private.order_commands(tenant_id,order_id,applied_revision);
ALTER TABLE doobr_private.order_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE doobr_private.order_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON doobr_private.order_commands
 USING(tenant_id=nullif(current_setting('doobr.tenant_id',true),'')::uuid)
 WITH CHECK(tenant_id=nullif(current_setting('doobr.tenant_id',true),'')::uuid);
REVOKE ALL ON doobr_private.order_commands FROM PUBLIC;
COMMIT;
