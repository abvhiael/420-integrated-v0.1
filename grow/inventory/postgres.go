package inventory

import (
	"context"
	"database/sql"
	"errors"
)

type SQLStore struct{ DB *sql.DB }

func (s SQLStore) transaction(ctx context.Context, tenant string, callback func(*sql.Tx) error) error {
	if s.DB == nil || tenant == "" {
		return ErrDenied
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT set_config('grow.tenant_id',$1,true)", tenant); err != nil {
		return err
	}
	if err = callback(tx); err != nil {
		return err
	}
	return tx.Commit()
}
func (s SQLStore) Create(ctx context.Context, l Lot, actor string) error {
	return s.transaction(ctx, l.TenantID, func(tx *sql.Tx) error {
		if l.Kind == "HARVEST" {
			var recorded float64
			err := tx.QueryRowContext(ctx, `SELECT weight_grams::float8 FROM grow_private.harvest_records
WHERE tenant_id=$1::uuid AND harvest_id=$2::uuid AND facility_id=$3::uuid AND zone_id=$4::uuid`,
				l.TenantID, l.HarvestID, l.FacilityID, l.ZoneID).Scan(&recorded)
			if errors.Is(err, sql.ErrNoRows) {
				return ErrDenied
			}
			if err != nil {
				return err
			}
			if l.Opening != recorded {
				return ErrInvalid
			}
		}
		res, err := tx.ExecContext(ctx, `INSERT INTO grow_private.inventory_lots_v2
(tenant_id,lot_id,facility_id,zone_id,kind,unit,label,harvest_id,created_by)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,NULLIF($8,'')::uuid,$9)
ON CONFLICT DO NOTHING`, l.TenantID, l.ID, l.FacilityID, l.ZoneID, l.Kind, l.Unit, l.Label, l.HarvestID, actor)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n != 1 {
			return ErrConflict
		}
		if l.Opening > 0 {
			res, err = tx.ExecContext(ctx, `INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,occurred_at)
VALUES($1::uuid,gen_random_uuid(),$2::uuid,$3::uuid,$4::uuid,'OPENING',$5,'initial audited stock',$6,'creation',$7,now())`,
				l.TenantID, l.ID, l.FacilityID, l.ZoneID, l.Opening, actor, "open:"+l.ID)
			if err != nil {
				return err
			}
			n, err = res.RowsAffected()
			if err != nil {
				return err
			}
			if n != 1 {
				return ErrConflict
			}
		}
		return nil
	})
}
func (s SQLStore) Apply(ctx context.Context, e Entry) error {
	return s.transaction(ctx, e.TenantID, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,reference_id,occurred_at)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13)
ON CONFLICT(tenant_id,idempotency_key) DO NOTHING`,
			e.TenantID, e.ID, e.LotID, e.FacilityID, e.ZoneID, e.Kind, e.Quantity, e.Reason, e.Actor, e.Source, e.IdempotencyKey, e.ReferenceID, e.OccurredAt)
		if err != nil {
			return err
		}
		n, err := res.RowsAffected()
		if err != nil {
			return err
		}
		if n != 1 {
			return ErrConflict
		}
		return nil
	})
}
func (s SQLStore) Snapshot(ctx context.Context, tenant, facility, zone, lot string, limit int) (Snapshot, error) {
	var result Snapshot
	err := s.transaction(ctx, tenant, func(tx *sql.Tx) error {
		err := tx.QueryRowContext(ctx, `SELECT tenant_id::text,lot_id::text,facility_id::text,zone_id::text,
kind,unit,label,coalesce(harvest_id::text,''),balance::float8,created_at,created_by
FROM grow_private.inventory_lots_v2 WHERE tenant_id=$1::uuid AND lot_id=$2::uuid
AND facility_id=$3::uuid AND zone_id=$4::uuid`, tenant, lot, facility, zone).
			Scan(&result.Lot.TenantID, &result.Lot.ID, &result.Lot.FacilityID, &result.Lot.ZoneID,
				&result.Lot.Kind, &result.Lot.Unit, &result.Lot.Label, &result.Lot.HarvestID, &result.Balance, &result.Lot.CreatedAt, &result.Lot.CreatedBy)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrDenied
		}
		if err != nil {
			return err
		}
		var correct bool
		err = tx.QueryRowContext(ctx, `SELECT l.balance = COALESCE((
SELECT SUM(CASE WHEN e.kind IN ('ISSUE','CONSUME','ADJUST_OUT','TRANSFER_OUT')
THEN -e.quantity ELSE e.quantity END)
FROM grow_private.inventory_ledger_v2 e
WHERE e.tenant_id=l.tenant_id AND e.lot_id=l.lot_id
),0) FROM grow_private.inventory_lots_v2 l
WHERE l.tenant_id=$1::uuid AND l.lot_id=$2::uuid`, tenant, lot).Scan(&correct)
		if err != nil {
			return err
		}
		if !correct {
			return ErrConflict
		}
		rows, err := tx.QueryContext(ctx, `SELECT tenant_id::text,event_id::text,lot_id::text,facility_id::text,zone_id::text,
kind,quantity::float8,reason,actor_subject,source,idempotency_key,reference_id,occurred_at
FROM grow_private.inventory_ledger_v2
WHERE tenant_id=$1::uuid AND lot_id=$2::uuid AND facility_id=$3::uuid AND zone_id=$4::uuid
ORDER BY occurred_at,event_id LIMIT $5`, tenant, lot, facility, zone, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e Entry
			if err = rows.Scan(&e.TenantID, &e.ID, &e.LotID, &e.FacilityID, &e.ZoneID, &e.Kind,
				&e.Quantity, &e.Reason, &e.Actor, &e.Source, &e.IdempotencyKey, &e.ReferenceID, &e.OccurredAt); err != nil {
				return err
			}
			result.Entries = append(result.Entries, e)
		}
		return rows.Err()
	})
	return result, err
}

func (s SQLStore) Transfer(ctx context.Context, from, to Entry) error {
	return s.transaction(ctx, from.TenantID, func(tx *sql.Tx) error {
		if from.TenantID != to.TenantID || from.LotID == to.LotID {
			return ErrInvalid
		}
		rows, err := tx.QueryContext(ctx, `SELECT lot_id::text,facility_id::text,zone_id::text,kind,unit
FROM grow_private.inventory_lots_v2
WHERE tenant_id=$1::uuid AND lot_id IN ($2::uuid,$3::uuid)
ORDER BY lot_id`, from.TenantID, from.LotID, to.LotID)
		if err != nil {
			return err
		}
		type locked struct{ facility, zone, kind, unit string }
		found := map[string]locked{}
		for rows.Next() {
			var id string
			var x locked
			if err = rows.Scan(&id, &x.facility, &x.zone, &x.kind, &x.unit); err != nil {
				rows.Close()
				return err
			}
			found[id] = x
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		a, okA := found[from.LotID]
		b, okB := found[to.LotID]
		if !okA || !okB || len(found) != 2 ||
			a.facility != from.FacilityID || a.zone != from.ZoneID ||
			b.facility != to.FacilityID || b.zone != to.ZoneID ||
			a.kind != b.kind || a.unit != b.unit {
			return ErrDenied
		}
		for _, e := range []Entry{from, to} {
			result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.inventory_ledger_v2
(tenant_id,event_id,lot_id,facility_id,zone_id,kind,quantity,reason,actor_subject,source,idempotency_key,reference_id,occurred_at)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13)
ON CONFLICT(tenant_id,idempotency_key) DO NOTHING`,
				e.TenantID, e.ID, e.LotID, e.FacilityID, e.ZoneID, e.Kind, e.Quantity,
				e.Reason, e.Actor, e.Source, e.IdempotencyKey, e.ReferenceID, e.OccurredAt)
			if err != nil {
				return err
			}
			count, err := result.RowsAffected()
			if err != nil {
				return err
			}
			if count != 1 {
				return ErrConflict
			}
		}
		return nil
	})
}
