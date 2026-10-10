-- GROW-V2-10 private inventory ledger, locked nonnegative accounting and traceability.
BEGIN;
SELECT pg_advisory_xact_lock(420203);
ALTER TABLE grow_private.harvest_records
 ADD CONSTRAINT harvest_records_location_reference UNIQUE(tenant_id,harvest_id,facility_id,zone_id);
CREATE TABLE grow_private.inventory_lots_v2(
 tenant_id uuid NOT NULL,lot_id uuid NOT NULL,facility_id uuid NOT NULL,zone_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('SEED','CLONE','INPUT','MATERIAL','EQUIPMENT','HARVEST')),
 unit text NOT NULL CHECK(unit IN ('g','kg','L','mL','each')),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 160),
 harvest_id uuid, balance numeric NOT NULL DEFAULT 0 CHECK(balance>=0 AND balance<=1000000),
 created_at timestamptz NOT NULL DEFAULT now(),created_by text NOT NULL CHECK(length(created_by)>0),
 PRIMARY KEY(tenant_id,lot_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 FOREIGN KEY(tenant_id,harvest_id,facility_id,zone_id) REFERENCES grow_private.harvest_records(tenant_id,harvest_id,facility_id,zone_id),
 CHECK((kind NOT IN ('SEED','CLONE','EQUIPMENT') OR unit='each')),
 CHECK((kind='HARVEST' AND harvest_id IS NOT NULL AND unit='g')
 OR (kind<>'HARVEST' AND harvest_id IS NULL))
);
CREATE UNIQUE INDEX inventory_harvest_unique ON grow_private.inventory_lots_v2(tenant_id,harvest_id) WHERE harvest_id IS NOT NULL;
CREATE TABLE grow_private.inventory_ledger_v2(
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
 FOREIGN KEY(tenant_id,lot_id) REFERENCES grow_private.inventory_lots_v2(tenant_id,lot_id),
 FOREIGN KEY(tenant_id,facility_id,zone_id) REFERENCES grow_private.zones(tenant_id,facility_id,zone_id),
 CHECK ((kind NOT IN ('TRANSFER_IN','TRANSFER_OUT')) OR length(reference_id)>0)
);
CREATE INDEX inventory_ledger_v2_history ON grow_private.inventory_ledger_v2(tenant_id,lot_id,occurred_at,event_id);
CREATE FUNCTION grow_private.apply_inventory_ledger_v2() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,grow_private AS $$
DECLARE changed integer; lot_unit text;
BEGIN
 -- Row-level lock and guarded debit in the same database transaction; no overdraft or cross-parent attribution.
 SELECT unit INTO lot_unit FROM grow_private.inventory_lots_v2
 WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id AND facility_id=NEW.facility_id AND zone_id=NEW.zone_id FOR UPDATE;
 IF lot_unit IS NULL THEN RAISE EXCEPTION 'inventory parent unavailable' USING ERRCODE='23514'; END IF;
 IF lot_unit='each' AND NEW.quantity<>trunc(NEW.quantity) THEN
  RAISE EXCEPTION 'discrete inventory must be whole units' USING ERRCODE='23514'; END IF;
 IF NEW.kind IN ('ISSUE','CONSUME','ADJUST_OUT','TRANSFER_OUT') THEN
  UPDATE grow_private.inventory_lots_v2 SET balance=balance-NEW.quantity
  WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id
  AND facility_id=NEW.facility_id AND zone_id=NEW.zone_id AND balance>=NEW.quantity;
 ELSE
  UPDATE grow_private.inventory_lots_v2 SET balance=balance+NEW.quantity
  WHERE tenant_id=NEW.tenant_id AND lot_id=NEW.lot_id
  AND facility_id=NEW.facility_id AND zone_id=NEW.zone_id AND balance+NEW.quantity<=1000000;
 END IF;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'inventory lot unavailable or balance violation' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER inventory_balance AFTER INSERT ON grow_private.inventory_ledger_v2
 FOR EACH ROW EXECUTE FUNCTION grow_private.apply_inventory_ledger_v2();
CREATE FUNCTION grow_private.reject_inventory_mutation() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'inventory ledger is immutable'; END $$;
CREATE TRIGGER inventory_immutable BEFORE UPDATE OR DELETE ON grow_private.inventory_ledger_v2
 FOR EACH ROW EXECUTE FUNCTION grow_private.reject_inventory_mutation();
ALTER TABLE grow_private.inventory_lots_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.inventory_lots_v2 FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.inventory_lots_v2
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
ALTER TABLE grow_private.inventory_ledger_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE grow_private.inventory_ledger_v2 FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scoped ON grow_private.inventory_ledger_v2
 USING(tenant_id=grow_private.current_tenant()) WITH CHECK(tenant_id=grow_private.current_tenant());
-- A custody transfer commits only with precisely one matching out and one matching in.
CREATE FUNCTION grow_private.validate_inventory_transfer_pair() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,grow_private AS $$
DECLARE matching integer; out_count integer; in_count integer; units integer; kinds integer; amounts integer; lots integer;
BEGIN
 IF NEW.kind NOT IN ('TRANSFER_IN','TRANSFER_OUT') THEN RETURN NEW; END IF;
 SELECT count(*),count(*) FILTER(WHERE e.kind='TRANSFER_OUT'),count(*) FILTER(WHERE e.kind='TRANSFER_IN'),
        count(DISTINCT l.unit),count(DISTINCT l.kind),count(DISTINCT e.quantity),count(DISTINCT e.lot_id)
 INTO matching,out_count,in_count,units,kinds,amounts,lots
 FROM grow_private.inventory_ledger_v2 e JOIN grow_private.inventory_lots_v2 l
 ON l.tenant_id=e.tenant_id AND l.lot_id=e.lot_id
 WHERE e.tenant_id=NEW.tenant_id AND e.reference_id=NEW.reference_id
 AND e.kind IN ('TRANSFER_IN','TRANSFER_OUT');
 IF matching<>2 OR out_count<>1 OR in_count<>1 OR units<>1 OR kinds<>1 OR amounts<>1 OR lots<>2 THEN
  RAISE EXCEPTION 'unpaired or mismatched inventory transfer' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER inventory_transfer_pair AFTER INSERT ON grow_private.inventory_ledger_v2
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION grow_private.validate_inventory_transfer_pair();
COMMIT;
