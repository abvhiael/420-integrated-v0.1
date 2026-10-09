package cultivation

import (
	"context"
	"errors"
	"github.com/420integrated/420-integrated/grow/security"
	"math"
	"time"
)

var ErrDenied = errors.New("cultivation history unavailable")
var ErrInvalid = errors.New("invalid cultivation entry")
var ErrConflict = errors.New("duplicate cultivation entry")

type Event struct {
	TenantID, FacilityID, ZoneID, ID, Kind, Metric, Unit, Actor, Source, IdempotencyKey, Notes string
	Amount                                                                                     float64
	OccurredAt                                                                                 time.Time
}
type Scope struct {
	Principal security.Principal
	Grant     security.Grant
	TenantID  string
}
type Store interface {
	Append(context.Context, Event) error
	History(context.Context, string, string, string, string, time.Time, time.Time, int) ([]Event, error)
}
type Service struct{ store Store }

func New(store Store) Service { return Service{store: store} }
func authorized(s Scope, facility, zone string, a security.Action) bool {
	return s.TenantID != "" && s.Principal.Authenticated && s.Principal.SubjectID != "" &&
		s.Principal.SubjectID == s.Grant.SubjectID && s.TenantID == s.Grant.TenantID &&
		facility != "" && zone != "" && security.Authorize(s.Principal, s.Grant,
		security.Resource{TenantID: s.TenantID, FacilityID: facility, ZoneID: zone}, a)
}
func metricOK(e Event) bool {
	if math.IsNaN(e.Amount) || math.IsInf(e.Amount, 0) {
		return false
	}
	switch e.Kind + "|" + e.Metric + "|" + e.Unit {
	case "NUTRIENT|NUTRIENT_EC|mS/cm":
		return e.Amount >= 0 && e.Amount <= 100
	case "NUTRIENT|NUTRIENT_PH|pH":
		return e.Amount >= 0 && e.Amount <= 14
	case "NUTRIENT|NUTRIENT_VOLUME|L", "IRRIGATION|IRRIGATION_VOLUME|L":
		return e.Amount >= 0 && e.Amount <= 100000
	case "ENVIRONMENT|ENV_TEMPERATURE|C":
		return e.Amount >= -50 && e.Amount <= 100
	case "ENVIRONMENT|ENV_HUMIDITY|%":
		return e.Amount >= 0 && e.Amount <= 100
	default:
		return false
	}
}
func (s Service) Append(ctx context.Context, scope Scope, e Event, now time.Time) error {
	if s.store == nil || e.TenantID != scope.TenantID || !authorized(scope, e.FacilityID, e.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if e.ID == "" || e.Source == "" || len(e.Source) > 128 || e.IdempotencyKey == "" || len(e.IdempotencyKey) > 128 ||
		e.Actor != scope.Principal.SubjectID || len(e.Notes) > 2000 || !metricOK(e) ||
		e.OccurredAt.IsZero() || e.OccurredAt.After(now.Add(5*time.Minute)) ||
		e.OccurredAt.Before(now.AddDate(-2, 0, 0)) {
		return ErrInvalid
	}
	return s.store.Append(ctx, e)
}
func (s Service) History(ctx context.Context, scope Scope, facility, zone, kind string, from, to time.Time, limit int) ([]Event, error) {
	if s.store == nil || !authorized(scope, facility, zone, security.View) {
		return nil, ErrDenied
	}
	if kind != "NUTRIENT" && kind != "IRRIGATION" && kind != "ENVIRONMENT" ||
		from.IsZero() || !from.Before(to) || to.Sub(from) > 366*24*time.Hour || limit < 1 || limit > 500 {
		return nil, ErrInvalid
	}
	rows, err := s.store.History(ctx, scope.TenantID, facility, zone, kind, from, to, limit)
	if err != nil {
		return nil, err
	}
	for _, e := range rows {
		if e.TenantID != scope.TenantID || e.FacilityID != facility || e.ZoneID != zone || e.Kind != kind ||
			e.OccurredAt.Before(from) || !e.OccurredAt.Before(to) {
			return nil, ErrDenied
		}
	}
	return rows, nil
}
