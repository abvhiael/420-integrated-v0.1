package cultivation

import (
	"context"
	"database/sql"
	"time"
)

type SQLStore struct{ DB *sql.DB }

func (s SQLStore) withinTenant(ctx context.Context, tenant string, fn func(*sql.Tx) error) error {
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
	if err = fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}
func (s SQLStore) Append(ctx context.Context, e Event) error {
	return s.withinTenant(ctx, e.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.cultivation_events
(tenant_id,event_id,facility_id,zone_id,kind,metric,amount,unit,occurred_at,actor_subject,source,idempotency_key,notes)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11,$12,$13)
ON CONFLICT(tenant_id,idempotency_key) DO NOTHING`,
			e.TenantID, e.ID, e.FacilityID, e.ZoneID, e.Kind, e.Metric, e.Amount, e.Unit, e.OccurredAt, e.Actor, e.Source, e.IdempotencyKey, e.Notes)
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
		return nil
	})
}
func (s SQLStore) History(ctx context.Context, tenant, facility, zone, kind string, from, to time.Time, limit int) ([]Event, error) {
	out := []Event{}
	err := s.withinTenant(ctx, tenant, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, `SELECT tenant_id::text,event_id::text,facility_id::text,zone_id::text,
kind,metric,amount::float8,unit,occurred_at,actor_subject,source,idempotency_key,notes
FROM grow_private.cultivation_events
WHERE tenant_id=$1::uuid AND facility_id=$2::uuid AND zone_id=$3::uuid
AND kind=$4 AND occurred_at >= $5 AND occurred_at < $6
ORDER BY occurred_at,event_id LIMIT $7`, tenant, facility, zone, kind, from, to, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var e Event
			if err := rows.Scan(&e.TenantID, &e.ID, &e.FacilityID, &e.ZoneID, &e.Kind, &e.Metric,
				&e.Amount, &e.Unit, &e.OccurredAt, &e.Actor, &e.Source, &e.IdempotencyKey, &e.Notes); err != nil {
				return err
			}
			out = append(out, e)
		}
		return rows.Err()
	})
	return out, err
}
