package equipment

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// SQLStore always uses tenant-local RLS context inside each database transaction.
// It never grants dispatch permission and never runs with a BYPASSRLS role.
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
func (s SQLStore) Device(ctx context.Context, tenant, id string) (Device, error) {
	var d Device
	err := s.withinTenant(ctx, tenant, func(tx *sql.Tx) error {
		return tx.QueryRowContext(ctx, `SELECT tenant_id::text,facility_id::text,zone_id::text,device_id::text,
device_type,safe_minimum::float8,safe_maximum::float8,online,interlock_ok,manual_override,control_signing_key
FROM grow_private.equipment WHERE tenant_id=$1::uuid AND device_id=$2::uuid`, tenant, id).Scan(
			&d.TenantID, &d.FacilityID, &d.ZoneID, &d.ID, &d.Type, &d.SafeMinimum, &d.SafeMaximum,
			&d.Online, &d.InterlockOK, &d.ManualOverride, &d.ControlSigningKey)
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Device{}, ErrDenied
	}
	return d, err
}
func (s SQLStore) ClaimNonce(ctx context.Context, tenant, device string, nonce [16]byte, expiry time.Time) (bool, error) {
	if nonce == ([16]byte{}) || !expiry.After(time.Now()) {
		return false, ErrInvalid
	}
	claimed := false
	err := s.withinTenant(ctx, tenant, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.equipment_nonces
(tenant_id,device_id,nonce,expires_at) VALUES ($1::uuid,$2::uuid,$3,$4)
ON CONFLICT(tenant_id,device_id,nonce) DO NOTHING`, tenant, device, nonce[:], expiry)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		}
		claimed = n == 1
		return nil
	})
	return claimed, err
}
