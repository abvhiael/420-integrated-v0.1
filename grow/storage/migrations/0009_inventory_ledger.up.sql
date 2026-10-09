-- GROW-V2-10 private inventory ledger, locked nonnegative accounting and traceability.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
CREATE TABLE grow_private.inventory_lots(
 tenant_id uuid NOT NULL,lot_id uuid NOT NULL,facility_id uuid NOT NULL,zone_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('SEED','CLONE','INPUT','MATERIAL','EQUIPMENT','HARVEST')),
 unit text NOT NULL CHECK(unit IN ('g','kg','L','mL','each')),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 160),
 harvest_id uuid, balance numeric NOT NULL DEFAULT 0 CHECK(balance>=0 AND balance<=1000000),
 created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL CHECK(length(created_by)>0),
 PRIMARY KEY(tenant_id,lot_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,harvest_id) REFERENCES grow_private.harvest_records(tenant_id,harvest_id),
 CHECK((kind='HARVEST' AND harvest_id IS NOT NULL AND unit='g')
 OR (kind<>'HARVEST' AND harvest_id IS NULL))
);
CREATE UNIQUE INDEX inventory_harvest_unique ON grow_private.inventory_lots(tenant_id,harvest_id) WHERE harvest_id IS NOT NULL;
CREATE TABLE grow_private.inventory_ledger(
 tenant_id uuid NOT NULL,event_id uuid NOT NULL,lot_id uuid NOT NULL,
 facility_id uuid NOT NULL,zone_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('OPENING','RECEIVE','ADJUST_IN','TRANSFER_IN','ISSUE','CONSUME','ADJUST_OUT','TRANSFER_OUT')),
 quantity numeric NOT NULL CHECK(quantity>0 AND quantity<=1000000),
 reason text NOT NULL CHECK(length(reason) BETWEEN 1 AND 500),
 actor_subject text NOT NULL CHECK(length(actor_subject) BETWEEN 1 AND 180),
 source text NOT NULL CHECK(length(source) BETWEEN 1 AND 128),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 128),
 reference_id text NOT NULL DEFAULT '',occurred_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,event_id),UNIQUE(tenant_id,idempotency_key),
 FOREIGN KEY(tenant_id,lot_id) REFERENCES grow_private.inventory_lots(tenant_id,lot_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 CHECK ((kind NOT IN ('TRANSFER_IN','TRANSFER_OUT')) OR length(reference_id)>0)
);
CREATE INDEX inventory_ledger_history ON grow_private.inventory_ledger(tenant_id,lot_id,occurred_at,event_id);
CREATE FUNCTION grow_private.apply_inventory_ledger() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,grow_private AS $$
DECLARE changed integer;
BEGIN
 -- Row-level lock and guarded debit in the same database transaction; no overdraft or cross-parent attribution.
 IF NEW.kind IN ('ISSUE','CONSUME','ADJUST_OUT','TRANSFER_OUT') THEN
  UPDATE grow_private.inventory_lots SET balance=balance-NEW.quantity
  WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id
  AND facility_id=NEW.facility_id AND zone_id=NEW.zone_id AND balance>=NEW.quantity;
 ELSE
  UPDATE grow_private.inventory_lots SET balance=balance+NEW.quantity
  WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id
  AND facility_id=NEW.facility_id AND zone_id=NEW.zone_id AND balance+NEW.quantity<=1000000;
 END IF;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'inventory lot unavailable or balance violation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_balance BEFORE INSERT ON grow_private.inventory_ledger
 FOR EACH ROW EXECUTE FUNCTION grow_private.apply_inventory_ledger();
CREATE FUNCTION grow_private.reject_inventory_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'inventory ledger is immutable'; END $$;
CREATE TRIGGER inventory_immutable BEFORE UPDATE OR DELETE ON grow_private.inventory_ledger
 FOR EACH ROW EXECUTE FUNCTION grow_private.reject_inventory_mutation();
ALTER TABLE grow_private.inventory_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.inventory_lots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.inventory_lots
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
ALTER TABLE grow_private.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.inventory_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.inventory_ledger
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
COMMIT;
