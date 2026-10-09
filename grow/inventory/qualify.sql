\set ON_ERROR_STOP on
-- Real inventory ledger: previously run V2-05 plant and V2-09 harvest fixtures.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='inventory_lots_v2' AND c.relrowsecurity AND c.relforcerowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='grow_private' AND c.relname='inventory_ledger_v2' AND c.relrowsecurity AND c.relforcerowsecurity)
 THEN RAISE EXCEPTION 'inventory tenant isolation not forced'; END IF;
END $$;
BEGIN;
INSERT INTO grow_private.inventory_lots_v2
(tenant_id,lot_id,facility_id,zone_id,kind,unit,label,harvest_id,created_by)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000001',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'HARVEST','g','harvest inventory','aaaaaaaa-9999-4999-8999-999999999999','u');
INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000002',
'aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','OPENING',42,'linked harvested weight','u','manual','inventory-opening-1',now());
-- Conflict replay must not cause BEFORE INSERT balance increment.
INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000003',
'aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','OPENING',42,'replay attempt','u','manual','inventory-opening-1',now())
ON CONFLICT(tenant_id,idempotency_key) DO NOTHING;
DO $$ BEGIN
 IF (SELECT balance FROM grow_private.inventory_lots_v2 WHERE lot_id='aaaaaaaa-0000-4000-8000-000000000001')<>42
 THEN RAISE EXCEPTION 'replay modified inventory balance'; END IF;
END $$;
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.inventory_ledger_v2
  (tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000004',
  'aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-3333-4333-8333-333333333333',
  'aaaaaaaa-4444-4444-8444-444444444444','ISSUE',43,'overdraw','u','manual','inventory-overdraft',now());
  RAISE EXCEPTION 'overdraft accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  UPDATE grow_private.inventory_ledger_v2 SET quantity=1 WHERE idempotency_key='inventory-opening-1';
  RAISE EXCEPTION 'immutable ledger mutated';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='immutable ledger mutated' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO grow_private.inventory_lots_v2
  (tenant_id,lot_id,facility_id,zone_id,kind,unit,label,created_by)
  VALUES('bbbbbbbb-2222-4222-8222-222222222222','aaaaaaaa-0000-4000-8000-000000000005',
   'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
   'INPUT','g','cross tenant','u');
  RAISE EXCEPTION 'cross tenant lot parent admitted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $$;
INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000006',
'aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-3333-4333-8333-333333333333',
'aaaaaaaa-4444-4444-8444-444444444444','ISSUE',4,'quality sample','u','manual','inventory-issue-1',now());

INSERT INTO grow_private.inventory_lots_v2
(tenant_id,lot_id,facility_id,zone_id,kind,unit,label,created_by)
VALUES
('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000010',
 'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444','INPUT','g','source','u'),
('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000011',
 'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444','INPUT','g','destination','u');
INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000012',
 'aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-3333-4333-8333-333333333333',
 'aaaaaaaa-4444-4444-8444-444444444444','OPENING',10,'initial input','u','manual','source-open',now());
INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,reference_id,occurred_at)
VALUES
('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000013',
 'aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-3333-4333-8333-333333333333',
 'aaaaaaaa-4444-4444-8444-444444444444','TRANSFER_OUT',4,'move','u','manual','move-out','move-1',now()),
('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000014',
 'aaaaaaaa-0000-4000-8000-000000000011','aaaaaaaa-3333-4333-8333-333333333333',
 'aaaaaaaa-4444-4444-8444-444444444444','TRANSFER_IN',4,'move','u','manual','move-in','move-1',now());
DO $$ BEGIN
 IF (SELECT balance FROM grow_private.inventory_lots_v2 WHERE lot_id='aaaaaaaa-0000-4000-8000-000000000010')<>6
 OR (SELECT balance FROM grow_private.inventory_lots_v2 WHERE lot_id='aaaaaaaa-0000-4000-8000-000000000011')<>4
 THEN RAISE EXCEPTION 'atomic custody move did not conserve inventory'; END IF;
END $$;

INSERT INTO grow_private.inventory_lots_v2
(tenant_id,lot_id,facility_id,zone_id,kind,unit,label,created_by)
VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000020',
'aaaaaaaa-3333-4333-8333-333333333333','aaaaaaaa-4444-4444-8444-444444444444',
'SEED','each','discrete seeds','u');
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.inventory_ledger_v2
  (tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000021',
  'aaaaaaaa-0000-4000-8000-000000000020','aaaaaaaa-3333-4333-8333-333333333333',
  'aaaaaaaa-4444-4444-8444-444444444444','RECEIVE',0.5,'invalid fractional seed','u','manual','fractional-seed',now());
  RAISE EXCEPTION 'fractional discrete unit accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;

-- An unmatched custody leg must fail at constraint evaluation and roll back its debit.
DO $$ BEGIN
 BEGIN
  INSERT INTO grow_private.inventory_ledger_v2
  (tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,reference_id,occurred_at)
  VALUES('aaaaaaaa-1111-4111-8111-111111111111','aaaaaaaa-0000-4000-8000-000000000030',
   'aaaaaaaa-0000-4000-8000-000000000010','aaaaaaaa-3333-4333-8333-333333333333',
   'aaaaaaaa-4444-4444-8444-444444444444','TRANSFER_OUT',1,'orphan attempt','u','manual','orphan-out','orphan-ref',now());
  SET CONSTRAINTS grow_private.inventory_transfer_pair IMMEDIATE;
  RAISE EXCEPTION 'unpaired transfer accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
COMMIT;
SET ROLE grow_v2_test_runtime;
BEGIN;
SET LOCAL grow.tenant_id='bbbbbbbb-2222-4222-8222-222222222222';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM grow_private.inventory_lots_v2)
 OR EXISTS(SELECT 1 FROM grow_private.inventory_ledger_v2)
 THEN RAISE EXCEPTION 'cross tenant inventory leak'; END IF;
END $$;
ROLLBACK;
BEGIN;
SET LOCAL grow.tenant_id='aaaaaaaa-1111-4111-8111-111111111111';
DO $$ BEGIN
 IF (SELECT balance FROM grow_private.inventory_lots_v2 WHERE lot_id='aaaaaaaa-0000-4000-8000-000000000001')<>38
 OR (SELECT count(*) FROM grow_private.inventory_ledger_v2 WHERE lot_id='aaaaaaaa-0000-4000-8000-000000000001')<>2
 THEN RAISE EXCEPTION 'inventory balance/traceability reconciliation mismatch'; END IF;
END $$;
ROLLBACK;
RESET ROLE;
