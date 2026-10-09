package integrations

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type SQLStore struct {
	DB *sql.DB
}

func (s SQLStore) tx(ctx context.Context, tenant string, fn func(*sql.Tx) error) error {
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

func (s SQLStore) OptIn(ctx context.Context, scope Scope, facility, zone string, enabled bool) error {
	return s.tx(ctx, scope.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.integration_opt_ins
(tenant_id,facility_id,zone_id,actor_subject,enabled)
VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5)
ON CONFLICT(tenant_id,facility_id,zone_id,actor_subject)
DO UPDATE SET enabled=EXCLUDED.enabled,updated_at=now()`,
			scope.TenantID, facility, zone, scope.Principal.SubjectID, enabled)
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

func (s SQLStore) Queue(ctx context.Context, event Event, actor string) error {
	return s.tx(ctx, event.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.integration_outbox
(tenant_id,event_id,facility_id,zone_id,kind,source_id,requested_by,created_at)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid,$7,$8)
ON CONFLICT DO NOTHING`, event.TenantID, event.ID, event.FacilityID, event.ZoneID,
			event.Kind, event.SourceID, actor, event.CreatedAt)
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

func (s SQLStore) Claim(ctx context.Context, tenant, worker string, now time.Time) (Delivery, error) {
	var out Delivery
	err := s.tx(ctx, tenant, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `UPDATE grow_private.integration_outbox
SET state='DEAD',claim_token='',lease_until=NULL
WHERE tenant_id=$1::uuid AND state='IN_FLIGHT' AND attempts>=4
AND lease_until<$2`, tenant, now); err != nil {
			return err
		}
		return tx.QueryRowContext(ctx, `WITH picked AS(
 SELECT tenant_id,event_id FROM grow_private.integration_outbox
 WHERE tenant_id=$1::uuid AND ((state='QUEUED' AND next_attempt_at<=$3)
 OR (state='IN_FLIGHT' AND lease_until<$3))
 AND attempts<4
 ORDER BY next_attempt_at,event_id FOR UPDATE SKIP LOCKED LIMIT 1
)
UPDATE grow_private.integration_outbox o
SET state='IN_FLIGHT',attempts=attempts+1,claim_token=$2,lease_until=$3+interval '5 minutes'
FROM picked p WHERE o.tenant_id=p.tenant_id AND o.event_id=p.event_id
RETURNING o.tenant_id::text,o.facility_id::text,o.zone_id::text,
o.event_id::text,o.kind,o.source_id::text`, tenant, worker, now).
			Scan(&out.TenantID, &out.FacilityID, &out.ZoneID, &out.EventID, &out.Kind, &out.SourceID)
	})
	if errors.Is(err, sql.ErrNoRows) {
		return Delivery{}, ErrConflict
	}
	return out, err
}

func (s SQLStore) Complete(ctx context.Context, tenant, eventID, worker string, successful bool, now time.Time) error {
	return s.tx(ctx, tenant, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `UPDATE grow_private.integration_outbox
SET state=CASE WHEN $4 THEN 'ACCEPTED'
 WHEN attempts>=4 THEN 'DEAD' ELSE 'QUEUED' END,
 next_attempt_at=CASE WHEN $4 THEN next_attempt_at
 ELSE $5+(attempts*attempts)*interval '1 minute' END,
 accepted_at=CASE WHEN $4 THEN $5 ELSE NULL END,
 claim_token='',lease_until=NULL
WHERE tenant_id=$1::uuid AND event_id=$2::uuid AND claim_token=$3
AND state='IN_FLIGHT' AND lease_until>=$5`, tenant, eventID, worker, successful, now)
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
