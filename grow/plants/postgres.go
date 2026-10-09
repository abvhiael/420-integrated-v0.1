package plants

import (
	"context"
	"database/sql"
	"errors"
)

type SQLStore struct{ DB *sql.DB }

func (s SQLStore) transaction(ctx context.Context, tenant string, fn func(*sql.Tx) error) error {
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
func (s SQLStore) Get(ctx context.Context, tenant, id string) (Plant, error) {
	var p Plant
	err := s.transaction(ctx, tenant, func(tx *sql.Tx) error {
		return tx.QueryRowContext(ctx, "SELECT tenant_id::text,plant_id::text,facility_id::text,zone_id::text,label,state,revision,coalesce(cultivar_id::text,'') FROM grow_private.plants WHERE tenant_id=$1::uuid AND plant_id=$2::uuid", tenant, id).
			Scan(&p.TenantID, &p.ID, &p.FacilityID, &p.ZoneID, &p.Label, &p.State, &p.Revision, &p.CultivarID)
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Plant{}, ErrDenied
	}
	return p, err
}
func (s SQLStore) Create(ctx context.Context, p Plant) (Plant, error) {
	err := s.transaction(ctx, p.TenantID, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, "INSERT INTO grow_private.plants(tenant_id,plant_id,facility_id,zone_id,label,state,cultivar_id) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,NULLIF($7,'')::uuid)", p.TenantID, p.ID, p.FacilityID, p.ZoneID, p.Label, p.State, p.CultivarID)
		return err
	})
	if err != nil {
		return Plant{}, err
	}
	p.Revision = 1
	return p, nil
}
func (s SQLStore) ChangeStage(ctx context.Context, p Plant, expected int64, actor string) (Plant, error) {
	err := s.transaction(ctx, p.TenantID, func(tx *sql.Tx) error {
		var old Stage
		err := tx.QueryRowContext(ctx, "SELECT state FROM grow_private.plants WHERE tenant_id=$1::uuid AND plant_id=$2::uuid AND revision=$3 FOR UPDATE", p.TenantID, p.ID, expected).Scan(&old)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrConflict
		}
		if err != nil {
			return err
		}
		if !canMove(old, p.State) {
			return ErrInvalid
		}
		if err = tx.QueryRowContext(ctx, "UPDATE grow_private.plants SET state=$1,revision=revision+1 WHERE tenant_id=$2::uuid AND plant_id=$3::uuid AND revision=$4 RETURNING revision", p.State, p.TenantID, p.ID, expected).Scan(&p.Revision); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "INSERT INTO grow_private.plant_events(tenant_id,event_id,plant_id,actor_subject,from_state,to_state,expected_revision) VALUES ($1::uuid,gen_random_uuid(),$2::uuid,$3,$4,$5,$6)", p.TenantID, p.ID, actor, old, p.State, expected)
		return err
	})
	if err != nil {
		return Plant{}, err
	}
	return p, nil
}
func (s SQLStore) Ancestors(ctx context.Context, tenant, id string) ([]string, error) {
	ids := []string{}
	err := s.transaction(ctx, tenant, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, `WITH RECURSIVE ancestors(id) AS (
SELECT parent_id FROM grow_private.plant_lineage WHERE tenant_id=$1::uuid AND child_id=$2::uuid
UNION SELECT l.parent_id FROM grow_private.plant_lineage l JOIN ancestors a ON a.id=l.child_id WHERE l.tenant_id=$1::uuid
) SELECT id::text FROM ancestors`, tenant, id)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var value string
			if err = rows.Scan(&value); err != nil {
				return err
			}
			ids = append(ids, value)
		}
		return rows.Err()
	})
	return ids, err
}
func (s SQLStore) Link(ctx context.Context, e Edge) error {
	return s.transaction(ctx, e.TenantID, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, "INSERT INTO grow_private.plant_lineage(tenant_id,child_id,parent_id,relation) VALUES ($1::uuid,$2::uuid,$3::uuid,$4)", e.TenantID, e.ChildID, e.ParentID, e.Relation)
		return err
	})
}
