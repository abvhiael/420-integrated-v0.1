package telemetry

import (
	"context"
	"errors"
	"math"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

var ErrDenied = errors.New("telemetry unavailable")
var ErrInvalid = errors.New("invalid telemetry")
var ErrConflict = errors.New("duplicate telemetry")

type Reading struct {
	TenantID      string
	FacilityID    string
	ZoneID        string
	ObservationID string
	SensorID      string
	Kind          string
	Unit          string
	Source        string
	Value         float64
	MeasuredAt    time.Time
	RecordedAt    time.Time
}
type Scope struct {
	Principal  security.Principal
	Membership security.Grant
	TenantID   string
}
type Store interface {
	Insert(context.Context, Reading) error
	History(context.Context, string, string, string, string, time.Time, time.Time, int) ([]Reading, error)
}
type Service struct{ Store Store }

func New(store Store) Service { return Service{Store: store} }

var allowedUnits = map[string]string{
	"temperature":  "C",
	"humidity":     "%",
	"light":        "lux",
	"ph":           "pH",
	"conductivity": "mS/cm",
	"water_level":  "cm",
}

func authorized(s Scope, facility, zone string, action security.Action) bool {
	return s.Principal.Authenticated && s.Principal.SubjectID != "" &&
		s.Principal.SubjectID == s.Membership.SubjectID && s.TenantID != "" &&
		s.TenantID == s.Membership.TenantID && facility != "" && zone != "" &&
		security.Authorize(s.Principal, s.Membership, security.Resource{
			TenantID: s.TenantID, FacilityID: facility, ZoneID: zone,
		}, action)
}
func validate(r Reading, now time.Time) bool {
	unit, ok := allowedUnits[r.Kind]
	if !ok || unit != r.Unit || r.ObservationID == "" || r.SensorID == "" ||
		r.FacilityID == "" || r.ZoneID == "" || r.TenantID == "" ||
		r.Source == "" || len(r.Source) > 128 ||
		math.IsNaN(r.Value) || math.IsInf(r.Value, 0) ||
		r.MeasuredAt.IsZero() || r.MeasuredAt.After(now.Add(5*time.Minute)) ||
		r.MeasuredAt.Before(now.AddDate(-2, 0, 0)) {
		return false
	}
	switch r.Kind {
	case "humidity":
		return r.Value >= 0 && r.Value <= 100
	case "ph":
		return r.Value >= 0 && r.Value <= 14
	case "temperature":
		return r.Value >= -50 && r.Value <= 100
	case "conductivity":
		return r.Value >= 0 && r.Value <= 100
	case "light":
		return r.Value >= 0 && r.Value <= 300000
	case "water_level":
		return r.Value >= 0 && r.Value <= 100000
	}
	return false
}
func (svc Service) Ingest(ctx context.Context, scope Scope, r Reading, now time.Time) error {
	if svc.Store == nil || scope.TenantID != r.TenantID ||
		!authorized(scope, r.FacilityID, r.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if !validate(r, now) {
		return ErrInvalid
	}
	return svc.Store.Insert(ctx, r)
}
func (svc Service) History(ctx context.Context, scope Scope, facility, zone, kind string, from, to time.Time, limit int) ([]Reading, error) {
	if svc.Store == nil || !authorized(scope, facility, zone, security.View) {
		return nil, ErrDenied
	}
	if _, ok := allowedUnits[kind]; !ok || from.IsZero() || !from.Before(to) ||
		to.Sub(from) > 366*24*time.Hour || limit < 1 || limit > 500 {
		return nil, ErrInvalid
	}
	records, err := svc.Store.History(ctx, scope.TenantID, facility, zone, kind, from, to, limit)
	if err != nil {
		return nil, err
	}
	for _, r := range records {
		if r.TenantID != scope.TenantID || r.FacilityID != facility || r.ZoneID != zone ||
			r.Kind != kind || r.MeasuredAt.Before(from) || !r.MeasuredAt.Before(to) {
			return nil, ErrDenied
		}
	}
	return records, nil
}
