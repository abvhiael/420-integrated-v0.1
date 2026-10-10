package assistance

import (
	"context"
	"database/sql"
	"errors"
)

type SQLStore struct {
	DB *sql.DB
}

func (s SQLStore) transact(ctx context.Context, tenant string, fn func(*sql.Tx) error) error {
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

func (s SQLStore) Enqueue(ctx context.Context, input Input, actor string) error {
	return s.transact(ctx, input.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.ai_advice_jobs
(tenant_id,job_id,facility_id,zone_id,consent_id,source_kind,source_id,requested_by,requested_at)
SELECT $1::uuid,$2::uuid,$3::uuid,$4::uuid,c.consent_id,$6,$7::uuid,$8,$9
FROM grow_private.ai_consents c
WHERE c.tenant_id=$1::uuid AND c.consent_id=$5::uuid
AND c.facility_id=$3::uuid AND c.zone_id=$4::uuid AND c.purpose='CULTIVATION_ADVICE'
AND c.granted=true AND c.actor_subject=$8
AND (($6='PLANT' AND EXISTS(
 SELECT 1 FROM grow_private.plants p WHERE p.tenant_id=$1::uuid
 AND p.facility_id=$3::uuid AND p.zone_id=$4::uuid AND p.plant_id=$7::uuid
)) OR ($6='OBSERVATION' AND EXISTS(
 SELECT 1 FROM grow_private.observations o WHERE o.tenant_id=$1::uuid
 AND o.facility_id=$3::uuid AND o.zone_id=$4::uuid AND o.observation_id=$7::uuid
)))
ON CONFLICT DO NOTHING`,
			input.TenantID, input.JobID, input.FacilityID, input.ZoneID, input.ConsentID,
			input.SourceKind, input.SourceID, actor, input.RequestedAt)
		if err != nil {
			return err
		}
		count, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if count != 1 {
			return ErrDenied
		}
		return nil
	})
}

func (s SQLStore) SaveRecommendation(ctx context.Context, r Recommendation) error {
	return s.transact(ctx, r.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.ai_recommendations
(tenant_id,recommendation_id,job_id,facility_id,zone_id,provider,model,text,
 explanation,limitations,confidence,created_at)
SELECT j.tenant_id,$2::uuid,j.job_id,j.facility_id,j.zone_id,$6,$7,$8,$9,$10,$11,$12
FROM grow_private.ai_advice_jobs j
JOIN grow_private.ai_consents c ON c.tenant_id=j.tenant_id AND c.consent_id=j.consent_id
WHERE j.tenant_id=$1::uuid AND j.job_id=$3::uuid AND j.facility_id=$4::uuid
AND j.zone_id=$5::uuid AND j.status='QUEUED' AND c.granted=true
ON CONFLICT DO NOTHING`, r.TenantID, r.ID, r.JobID, r.FacilityID, r.ZoneID,
			r.Provider, r.Model, r.Text, r.Explanation, r.Limitations, r.Confidence, r.CreatedAt)
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
		_, err = tx.ExecContext(ctx, `UPDATE grow_private.ai_advice_jobs SET status='COMPLETED'
WHERE tenant_id=$1::uuid AND job_id=$2::uuid AND status='QUEUED'`, r.TenantID, r.JobID)
		return err
	})
}

func (s SQLStore) Review(ctx context.Context, review Review) error {
	return s.transact(ctx, review.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.ai_reviews
(tenant_id,review_id,recommendation_id,facility_id,zone_id,actor_subject,decision,reason,reviewed_at)
SELECT r.tenant_id,$2::uuid,r.recommendation_id,r.facility_id,r.zone_id,$6,$7,$8,$9
FROM grow_private.ai_recommendations r
WHERE r.tenant_id=$1::uuid AND r.recommendation_id=$3::uuid
AND r.facility_id=$4::uuid AND r.zone_id=$5::uuid
ON CONFLICT DO NOTHING`, review.TenantID, review.ID, review.RecommendationID,
			review.FacilityID, review.ZoneID, review.Actor, review.Decision, review.Reason, review.ReviewedAt)
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

func (s SQLStore) Read(ctx context.Context, tenant, facility, zone, id string) (Recommendation, error) {
	var result Recommendation
	err := s.transact(ctx, tenant, func(tx *sql.Tx) error {
		err := tx.QueryRowContext(ctx, `SELECT tenant_id::text,facility_id::text,zone_id::text,
job_id::text,recommendation_id::text,provider,model,text,explanation,limitations,confidence,created_at
FROM grow_private.ai_recommendations
WHERE tenant_id=$1::uuid AND facility_id=$2::uuid AND zone_id=$3::uuid AND recommendation_id=$4::uuid`,
			tenant, facility, zone, id).Scan(&result.TenantID, &result.FacilityID,
			&result.ZoneID, &result.JobID, &result.ID, &result.Provider, &result.Model,
			&result.Text, &result.Explanation, &result.Limitations, &result.Confidence, &result.CreatedAt)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrDenied
		}
		return err
	})
	return result, err
}

// SetConsent uses a tenant-scoped upsert and revokes all pending jobs on withdrawal.
func (s SQLStore) SetConsent(ctx context.Context, scope Scope, consentID, facility, zone string, granted bool) error {
	return s.transact(ctx, scope.TenantID, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `INSERT INTO grow_private.ai_consents
(tenant_id,consent_id,facility_id,zone_id,actor_subject,purpose,granted)
VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'CULTIVATION_ADVICE',$6)
ON CONFLICT(tenant_id,consent_id) DO UPDATE SET granted=EXCLUDED.granted,updated_at=now()
WHERE ai_consents.facility_id=EXCLUDED.facility_id
AND ai_consents.zone_id=EXCLUDED.zone_id
AND ai_consents.actor_subject=EXCLUDED.actor_subject`,
			scope.TenantID, consentID, facility, zone, scope.Principal.SubjectID, granted)
		if err != nil {
			return err
		}
		count, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if count != 1 {
			return ErrDenied
		}
		return nil
	})
}

func (s SQLStore) Resolve(ctx context.Context, tenant, facility, zone, jobID string) (WorkItem, error) {
	var item WorkItem
	err := s.transact(ctx, tenant, func(tx *sql.Tx) error {
		var consentID, sourceID string
		err := tx.QueryRowContext(ctx, `SELECT j.tenant_id::text,j.job_id::text,j.facility_id::text,
j.zone_id::text,j.source_kind,j.source_id::text,j.consent_id::text
FROM grow_private.ai_advice_jobs j
JOIN grow_private.ai_consents c ON c.tenant_id=j.tenant_id AND c.consent_id=j.consent_id
WHERE j.tenant_id=$1::uuid AND j.facility_id=$2::uuid AND j.zone_id=$3::uuid
AND j.job_id=$4::uuid AND j.status='QUEUED' AND c.granted=true`,
			tenant, facility, zone, jobID).Scan(&item.Input.TenantID, &item.Input.JobID,
			&item.Input.FacilityID, &item.Input.ZoneID, &item.Input.SourceKind,
			&sourceID, &consentID)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrDenied
		}
		if err != nil {
			return err
		}
		item.Input.ConsentID = consentID
		item.Input.Purpose = "CULTIVATION_ADVICE"
		item.Input.SourceID = sourceID
		item.Observation.Kind = item.Input.SourceKind
		switch item.Input.SourceKind {
		case "PLANT":
			err = tx.QueryRowContext(ctx, `SELECT state,recorded_at
FROM grow_private.plants WHERE tenant_id=$1::uuid AND facility_id=$2::uuid
AND zone_id=$3::uuid AND plant_id=$4::uuid`, tenant, facility, zone, sourceID).
				Scan(&item.Observation.State, &item.Observation.ObservedAt)
		case "OBSERVATION":
			err = tx.QueryRowContext(ctx, `SELECT kind,unit,reading::float8,measured_at
FROM grow_private.observations WHERE tenant_id=$1::uuid AND facility_id=$2::uuid
AND zone_id=$3::uuid AND observation_id=$4::uuid`, tenant, facility, zone, sourceID).
				Scan(&item.Observation.Metric, &item.Observation.Unit,
					&item.Observation.Value, &item.Observation.ObservedAt)
		default:
			return ErrDenied
		}
		if errors.Is(err, sql.ErrNoRows) {
			return ErrDenied
		}
		return err
	})
	return item, err
}
