package harvest

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

var ErrDenied = errors.New("harvest record unavailable")
var ErrInvalid = errors.New("invalid harvest record or analytics window")
var ErrConflict = errors.New("duplicate harvest record")

// WeightGrams is a recorded dry weight; predictions are always separately labelled estimates.
type Record struct {
	TenantID, FacilityID, ZoneID, PlantID, ID, Actor, IdempotencyKey, Source string
	WeightGrams                                                              float64
	HarvestedAt                                                              time.Time
	CultivarID                                                               string
}
type Scope struct {
	Principal security.Principal
	Grant     security.Grant
	TenantID  string
}
type Store interface {
	Append(context.Context, Record) error
	List(context.Context, string, string, string, time.Time, time.Time, int) ([]Record, error)
}
type Service struct{ store Store }

func New(store Store) Service { return Service{store: store} }
func allowed(s Scope, facility, zone string, action security.Action) bool {
	return s.TenantID != "" && facility != "" && zone != "" && s.Principal.Authenticated &&
		s.Principal.SubjectID != "" && s.Principal.SubjectID == s.Grant.SubjectID &&
		s.TenantID == s.Grant.TenantID &&
		security.Authorize(s.Principal, s.Grant, security.Resource{TenantID: s.TenantID, FacilityID: facility, ZoneID: zone}, action)
}
func (s Service) Record(ctx context.Context, scope Scope, r Record, now time.Time) error {
	if s.store == nil || scope.TenantID != r.TenantID || !allowed(scope, r.FacilityID, r.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if r.ID == "" || r.PlantID == "" || r.Actor != scope.Principal.SubjectID ||
		r.Source == "" || len(r.Source) > 128 || r.IdempotencyKey == "" || len(r.IdempotencyKey) > 128 ||
		math.IsNaN(r.WeightGrams) || math.IsInf(r.WeightGrams, 0) || r.WeightGrams <= 0 || r.WeightGrams > 1000000 ||
		r.HarvestedAt.IsZero() || r.HarvestedAt.After(now.Add(5*time.Minute)) ||
		r.HarvestedAt.Before(now.AddDate(-2, 0, 0)) {
		return ErrInvalid
	}
	return s.store.Append(ctx, r)
}

type Summary struct {
	Kind                  string // OBSERVED
	Count                 int
	TotalGrams, MeanGrams float64
	From, To              time.Time
}
type Forecast struct {
	Kind                                  string // ESTIMATE; not an observed harvest or guaranteed yield
	SampleCount                           int
	EstimateGrams, LowerGrams, UpperGrams float64
	Method                                string
	Available                             bool
	Status                                string
}

func (s Service) Analytics(ctx context.Context, scope Scope, facility, zone string, from, to time.Time, limit int) (Summary, Forecast, error) {
	if s.store == nil || !allowed(scope, facility, zone, security.View) {
		return Summary{}, Forecast{}, ErrDenied
	}
	if from.IsZero() || !from.Before(to) || to.Sub(from) > 366*24*time.Hour ||
		limit < 1 || limit > 500 {
		return Summary{}, Forecast{}, ErrInvalid
	}
	rows, err := s.store.List(ctx, scope.TenantID, facility, zone, from, to, limit+1)
	if err != nil {
		return Summary{}, Forecast{}, err
	}
	if len(rows) > limit {
		return Summary{}, Forecast{}, ErrInvalid // Incomplete aggregates must never masquerade as complete.
	}
	sum := Summary{Kind: "OBSERVED", From: from, To: to}
	mean, m2 := 0.0, 0.0
	for _, r := range rows {
		if r.TenantID != scope.TenantID || r.FacilityID != facility || r.ZoneID != zone ||
			r.HarvestedAt.Before(from) || !r.HarvestedAt.Before(to) ||
			math.IsNaN(r.WeightGrams) || math.IsInf(r.WeightGrams, 0) || r.WeightGrams <= 0 || r.WeightGrams > 1000000 {
			return Summary{}, Forecast{}, ErrDenied
		}
		sum.Count++
		delta := r.WeightGrams - mean
		mean += delta / float64(sum.Count)
		m2 += delta * (r.WeightGrams - mean)
		sum.TotalGrams += r.WeightGrams
	}
	if sum.Count > 0 {
		sum.MeanGrams = mean
	}
	forecast := Forecast{Kind: "ESTIMATE", SampleCount: sum.Count, Method: "Historical per-record mean with heuristic standard-error range; not an individual-plant prediction", Status: "INSUFFICIENT_DATA"}
	if sum.Count >= 3 {
		deviation := math.Sqrt(m2 / float64(sum.Count-1))
		if deviation/mean > 1.0 {
			forecast.Status = "HIGH_VARIANCE"
			forecast.Method = "Historical variance too high for an informative forecast"
			return sum, forecast, nil
		}
		margin := 1.96 * deviation / math.Sqrt(float64(sum.Count))
		forecast.Available = true
		forecast.Status = "AVAILABLE"
		forecast.EstimateGrams = mean
		forecast.LowerGrams = math.Max(0, mean-margin)
		forecast.UpperGrams = mean + margin
	} else {
		forecast.Method = "Insufficient data (minimum three recorded harvests); no forecast"
	}
	return sum, forecast, nil
}
