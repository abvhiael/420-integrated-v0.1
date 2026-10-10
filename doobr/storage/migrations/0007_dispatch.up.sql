-- R02.7 capacity-safe offers and dispatch reservations.
BEGIN;
SELECT pg_advisory_xact_lock(4202107);
CREATE TABLE doobr_private.dispatch_offers (
 tenant_id uuid NOT NULL,offer_id uuid NOT NULL,order_id uuid NOT NULL,courier_id uuid NOT NULL,
 region_id uuid NOT NULL, requested_units integer NOT NULL CHECK(requested_units>0 AND requested_units<=100),
 state text NOT NULL CHECK(state IN ('OFFERED','ACCEPTED','DECLINED','EXPIRED','SUPERSEDED','RELEASED')),
 offered_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,
 decided_at timestamptz,
 PRIMARY KEY(tenant_id,offer_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 FOREIGN KEY(tenant_id,courier_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 FOREIGN KEY(tenant_id,region_id) REFERENCES doobr_private.service_regions(tenant_id,region_id),
 CHECK(expires_at>offered_at)
);
CREATE UNIQUE INDEX dispatch_active_offer_per_order ON doobr_private.dispatch_offers(tenant_id,order_id) WHERE state IN ('OFFERED','ACCEPTED');
CREATE UNIQUE INDEX dispatch_active_offer_courier_order ON doobr_private.dispatch_offers(tenant_id,courier_id,order_id) WHERE state IN ('OFFERED','ACCEPTED');
CREATE TABLE doobr_private.dispatch_assignments (
 tenant_id uuid NOT NULL,order_id uuid NOT NULL,courier_id uuid NOT NULL,offer_id uuid NOT NULL,
 reserved_units integer NOT NULL CHECK(reserved_units>0 AND reserved_units<=100),
 state text NOT NULL CHECK(state IN ('ACTIVE','RELEASED')),
 assigned_at timestamptz NOT NULL DEFAULT now(),released_at timestamptz,
 PRIMARY KEY(tenant_id,order_id),
 FOREIGN KEY(tenant_id,order_id) REFERENCES doobr_private.delivery_orders(tenant_id,order_id),
 FOREIGN KEY(tenant_id,offer_id) REFERENCES doobr_private.dispatch_offers(tenant_id,offer_id),
 FOREIGN KEY(tenant_id,courier_id) REFERENCES doobr_private.actors(tenant_id,actor_id),
 CHECK((state='ACTIVE' AND released_at IS NULL) OR (state='RELEASED' AND released_at IS NOT NULL))
);
CREATE INDEX dispatch_courier_active ON doobr_private.dispatch_assignments(tenant_id,courier_id) WHERE state='ACTIVE';
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['dispatch_offers','dispatch_assignments'] LOOP
  EXECUTE format('ALTER TABLE doobr_private.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE doobr_private.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_isolation ON doobr_private.%I USING(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid) WITH CHECK(tenant_id=nullif(current_setting(''doobr.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
REVOKE ALL ON doobr_private.dispatch_offers,doobr_private.dispatch_assignments FROM PUBLIC;
COMMIT;
