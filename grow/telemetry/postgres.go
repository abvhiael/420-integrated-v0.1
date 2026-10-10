package telemetry

import (
	"context"
	"database/sql"
	"errors"
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
func (s SQLStore) Insert(ctx context.Context, r Reading) error {
	return s.withinTenant(ctx, r.TenantID, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO grow_private.observations
(tenant_id,observation_id,facility_id,zone_id,sensor_id,kind,reading,unit,measured_at,source)
VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10)`,
			r.TenantID, r.ObservationID, r.FacilityID, r.ZoneID, r.SensorID, r.Kind, r.Value, r.Unit, r.MeasuredAt, r.Source)
		return err
	})
}
func (s SQLStore) History(ctx context.Context, tenant, facility, zone, kind string, from, to time.Time, limit int) ([]Reading, error) {
	result := make([]Reading, 0)
	err := s.withinTenant(ctx, tenant, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, `SELECT tenant_id::text,facility_id::text,zone_id::text,observation_id::text,
sensor_id,kind,reading::float8,unit,source,measured_at,recorded_at
FROM grow_private.observations WHERE tenant_id=$1::uuid AND facility_id=$2::uuid
AND zone_id=$3::uuid AND kind=$4 AND measured_at >= $5 AND measured_at < $6
ORDER BY measured_at ASC,observation_id ASC LIMIT $7`, tenant, facility, zone, kind, from, to, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r Reading
			if err := rows.Scan(&r.TenantID, &r.FacilityID, &r.ZoneID, &r.ObservationID,
				&r.SensorID, &r.Kind, &r.Value, &r.Unit, &r.Source, &r.MeasuredAt, &r.RecordedAt); err != nil {
				return err
			}
			result = append(result, r)
		}
		return rows.Err()
	})
	if errors.Is(err, sql.ErrNoRows) {
		return []Reading{}, nil
	}
	return result, err
}
