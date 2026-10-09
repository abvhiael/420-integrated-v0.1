package harvest

import (
	"context"
	"database/sql"
	"time"
)

func (s SQLStore) SavePlan(ctx context.Context, p Plan) error {
	return s.withinTenant(ctx, p.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.harvest_plans
 (tenant_id,facility_id,zone_id,plant_id,start_at,end_at,actor_subject,source)
 SELECT $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8
 FROM grow_private.plants
 WHERE tenant_id=$1::uuid AND facility_id=$2::uuid AND zone_id=$3::uuid
 AND plant_id=$4::uuid AND state IN ('SEED','CLONE','VEGETATIVE','FLOWERING')
 ON CONFLICT(tenant_id,plant_id) DO UPDATE
 SET start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,
 actor_subject=EXCLUDED.actor_subject,source=EXCLUDED.source,updated_at=now()
 WHERE harvest_plans.facility_id=EXCLUDED.facility_id AND harvest_plans.zone_id=EXCLUDED.zone_id`,
			p.TenantID, p.FacilityID, p.ZoneID, p.PlantID, p.Start, p.End, p.Actor, p.Source)
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
func (s SQLStore) Plans(ctx context.Context, tenant, facility, zone string, from, to time.Time, limit int) ([]Plan, error) {
	out := []Plan{}
	err := s.withinTenant(ctx, tenant, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, `SELECT tenant_id::text,facility_id::text,zone_id::text,plant_id::text,
 start_at,end_at,actor_subject,source FROM grow_private.harvest_plans
 WHERE tenant_id=$1::uuid AND facility_id=$2::uuid AND zone_id=$3::uuid
 AND start_at<$5 AND end_at>$4 ORDER BY start_at,plant_id LIMIT $6`, tenant, facility, zone, from, to, limit)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var p Plan
			if err = rows.Scan(&p.TenantID, &p.FacilityID, &p.ZoneID, &p.PlantID, &p.Start, &p.End, &p.Actor, &p.Source); err != nil {
				return err
			}
			out = append(out, p)
		}
		return rows.Err()
	})
	return out, err
}
