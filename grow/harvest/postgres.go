package harvest

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
func (s SQLStore) Append(ctx context.Context, r Record) error {
	return s.withinTenant(ctx, r.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.harvest_records
 (tenant_id,harvest_id,facility_id,zone_id,plant_id,weight_grams,harvested_at,actor_subject,source,idempotency_key)
 SELECT $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10
 FROM grow_private.plants
 WHERE tenant_id=$1::uuid AND facility_id=$3::uuid AND zone_id=$4::uuid
 AND plant_id=$5::uuid AND state='HARVESTED'
 ON CONFLICT DO NOTHING`,
			r.TenantID, r.ID, r.FacilityID, r.ZoneID, r.PlantID, r.WeightGrams, r.HarvestedAt, r.Actor, r.Source, r.IdempotencyKey)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if n != 1 {
			return ErrConflict
		}
		return nil
	})
}
func (s SQLStore) List(ctx context.Context, tenant, facility, zone string, from, to time.Time, limit int) ([]Record, error) {
	out := []Record{}
	err := s.withinTenant(ctx, tenant, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, `SELECT h.tenant_id::text,h.harvest_id::text,h.facility_id::text,h.zone_id::text,
 h.plant_id::text,h.weight_grams::float8,h.harvested_at,h.actor_subject,h.source,h.idempotency_key,
 coalesce(p.cultivar_id::text,'')
 FROM grow_private.harvest_records h
 JOIN grow_private.plants p ON p.tenant_id=h.tenant_id AND p.plant_id=h.plant_id
 WHERE h.tenant_id=$1::uuid AND h.facility_id=$2::uuid AND h.zone_id=$3::uuid
 AND h.harvested_at >= $4 AND h.harvested_at < $5
 ORDER BY h.harvested_at,h.harvest_id LIMIT $6`, tenant, facility, zone, from, to, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var r Record
			if err := rows.Scan(&r.TenantID, &r.ID, &r.FacilityID, &r.ZoneID, &r.PlantID, &r.WeightGrams, &r.HarvestedAt, &r.Actor, &r.Source, &r.IdempotencyKey, &r.CultivarID); err != nil {
				return err
			}
			out = append(out, r)
		}
		return rows.Err()
	})
	return out, err
}
