package facility

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type SQLStore struct{ DB *sql.DB }

func (s SQLStore) withTenant(ctx context.Context, tenant string, fn func(*sql.Tx) error) error {
	if s.DB == nil || !validID(tenant) {
		return ErrDenied
	}
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "SELECT set_config('grow.tenant_id', $1, true)", tenant); err != nil {
		return err
	}
	if err = fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}
func sqlTable(kind Kind) (string, error) {
	switch kind {
	case Facility:
		return "grow_private.facilities", nil
	case Room:
		return "grow_private.rooms", nil
	case Zone:
		return "grow_private.zones", nil
	}
	return "", ErrInvalid
}
func (s SQLStore) Create(ctx context.Context, r Record) (Record, error) {
	table, err := sqlTable(r.Kind)
	if err != nil {
		return Record{}, err
	}
	err = s.withTenant(ctx, r.TenantID, func(tx *sql.Tx) error {
		switch r.Kind {
		case Facility:
			_, err = tx.ExecContext(ctx, "INSERT INTO "+table+" (tenant_id,facility_id,name) VALUES ($1::uuid,$2::uuid,$3)", r.TenantID, r.ID, r.Name)
		case Room:
			_, err = tx.ExecContext(ctx, "INSERT INTO "+table+" (tenant_id,facility_id,room_id,name) VALUES ($1::uuid,$2::uuid,$3::uuid,$4)", r.TenantID, r.ParentID, r.ID, r.Name)
		case Zone:
			_, err = tx.ExecContext(ctx, "INSERT INTO "+table+" (tenant_id,facility_id,zone_id,room_id,name) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)", r.TenantID, r.FacilityID, r.ID, r.ParentID, r.Name)
		}
		return err
	})
	if err != nil {
		return Record{}, err
	}
	r.Revision = 1
	return r, nil
}
func (s SQLStore) Get(ctx context.Context, t, id string, kind Kind) (Record, error) {
	table, err := sqlTable(kind)
	if err != nil {
		return Record{}, err
	}
	var r Record
	r.Kind = kind
	err = s.withTenant(ctx, t, func(tx *sql.Tx) error {
		var row *sql.Row
		switch kind {
		case Facility:
			row = tx.QueryRowContext(ctx, "SELECT tenant_id::text,facility_id::text,name,revision FROM "+table+" WHERE tenant_id=$1::uuid AND facility_id=$2::uuid", t, id)
			return row.Scan(&r.TenantID, &r.ID, &r.Name, &r.Revision)
		case Room:
			row = tx.QueryRowContext(ctx, "SELECT tenant_id::text,room_id::text,facility_id::text,name,revision FROM "+table+" WHERE tenant_id=$1::uuid AND room_id=$2::uuid", t, id)
			return row.Scan(&r.TenantID, &r.ID, &r.ParentID, &r.Name, &r.Revision)
		case Zone:
			row = tx.QueryRowContext(ctx, "SELECT tenant_id::text,zone_id::text,room_id::text,facility_id::text,name,revision FROM "+table+" WHERE tenant_id=$1::uuid AND zone_id=$2::uuid", t, id)
			return row.Scan(&r.TenantID, &r.ID, &r.ParentID, &r.FacilityID, &r.Name, &r.Revision)
		}
		return ErrInvalid
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Record{}, ErrDenied
	}
	return r, err
}
func (s SQLStore) List(ctx context.Context, t string, kind Kind, parent string) ([]Record, error) {
	table, err := sqlTable(kind)
	if err != nil {
		return nil, err
	}
	result := []Record{}
	err = s.withTenant(ctx, t, func(tx *sql.Tx) error {
		var rows *sql.Rows
		var e error
		switch kind {
		case Facility:
			rows, e = tx.QueryContext(ctx, "SELECT tenant_id::text,facility_id::text,name,revision FROM "+table+" WHERE tenant_id=$1::uuid ORDER BY facility_id LIMIT 100", t)
		case Room:
			rows, e = tx.QueryContext(ctx, "SELECT tenant_id::text,room_id::text,facility_id::text,name,revision FROM "+table+" WHERE tenant_id=$1::uuid AND facility_id=$2::uuid ORDER BY room_id LIMIT 100", t, parent)
		case Zone:
			rows, e = tx.QueryContext(ctx, "SELECT tenant_id::text,zone_id::text,room_id::text,facility_id::text,name,revision FROM "+table+" WHERE tenant_id=$1::uuid AND room_id=$2::uuid ORDER BY zone_id LIMIT 100", t, parent)
		}
		if e != nil {
			return e
		}
		defer rows.Close()
		for rows.Next() {
			r := Record{Kind: kind}
			switch kind {
			case Facility:
				e = rows.Scan(&r.TenantID, &r.ID, &r.Name, &r.Revision)
			case Room:
				e = rows.Scan(&r.TenantID, &r.ID, &r.ParentID, &r.Name, &r.Revision)
			case Zone:
				e = rows.Scan(&r.TenantID, &r.ID, &r.ParentID, &r.FacilityID, &r.Name, &r.Revision)
			}
			if e != nil {
				return e
			}
			result = append(result, r)
		}
		return rows.Err()
	})
	return result, err
}
func (s SQLStore) Update(ctx context.Context, r Record, expected int64) (Record, error) {
	table, err := sqlTable(r.Kind)
	if err != nil {
		return Record{}, err
	}
	var idColumn string
	switch r.Kind {
	case Facility:
		idColumn = "facility_id"
	case Room:
		idColumn = "room_id"
	case Zone:
		idColumn = "zone_id"
	}
	err = s.withTenant(ctx, r.TenantID, func(tx *sql.Tx) error {
		query := fmt.Sprintf("UPDATE %s SET name=$1,revision=revision+1 WHERE tenant_id=$2::uuid AND %s=$3::uuid AND revision=$4 RETURNING revision", table, idColumn)
		return tx.QueryRowContext(ctx, query, r.Name, r.TenantID, r.ID, expected).Scan(&r.Revision)
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Record{}, ErrConflict
	}
	return r, err
}
