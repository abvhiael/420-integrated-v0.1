package integrations

import (
	"context"
	"errors"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

var (
	ErrDenied   = errors.New("integration permission denied")
	ErrInvalid  = errors.New("invalid integration request")
	ErrConflict = errors.New("integration replay or state conflict")
)

type Scope struct {
	TenantID  string
	Principal security.Principal
	Grant     security.Grant
}

type Event struct {
	TenantID   string
	FacilityID string
	ZoneID     string
	ID         string
	Kind       string
	SourceID   string
	CreatedAt  time.Time
}

type Delivery struct {
	TenantID   string
	FacilityID string
	ZoneID     string
	EventID    string
	Kind       string
	SourceID   string
}

type Store interface {
	Queue(context.Context, Event, string) error
	Claim(context.Context, string, string, time.Time) (Delivery, error)
	Complete(context.Context, string, string, string, bool, time.Time) error
}

type Notifier interface {
	Send(context.Context, Delivery) error
}

type OptInStore interface {
	OptIn(context.Context, Scope, string, string, bool) error
}

type WorkerVerifier interface {
	VerifyWorker(context.Context, string, string) error
}

type Service struct {
	Store    Store
	Notifier Notifier
	Worker   WorkerVerifier
}

func permitted(s Scope, facility, zone string, action security.Action) bool {
	return s.TenantID != "" && facility != "" && zone != "" &&
		s.Principal.Authenticated && s.Principal.SubjectID != "" &&
		s.Principal.SubjectID == s.Grant.SubjectID && s.TenantID == s.Grant.TenantID &&
		security.Authorize(s.Principal, s.Grant, security.Resource{
			TenantID: s.TenantID, FacilityID: facility, ZoneID: zone,
		}, action)
}

// Queue accepts an allowlisted source reference, never a sensitive payload.
func (s Service) Queue(ctx context.Context, scope Scope, event Event, now time.Time) error {
	if s.Store == nil || event.TenantID != scope.TenantID ||
		!permitted(scope, event.FacilityID, event.ZoneID, security.PlantWrite) {
		return ErrDenied
	}
	if event.ID == "" || event.SourceID == "" ||
		event.CreatedAt.IsZero() || event.CreatedAt.After(now.Add(5*time.Minute)) ||
		event.CreatedAt.Before(now.Add(-24*time.Hour)) {
		return ErrInvalid
	}
	switch event.Kind {
	case "HARVEST_RECORDED", "EQUIPMENT_ALERT", "AI_REVIEW_READY":
	default:
		return ErrInvalid
	}
	return s.Store.Queue(ctx, event, scope.Principal.SubjectID)
}

// Dispatch is a trusted worker operation, not exposed through user scopes.
// A failed or absent adapter cannot turn a queued item into successful delivery.
func (s Service) Dispatch(ctx context.Context, tenant, worker string, now time.Time) error {
	if s.Store == nil || s.Notifier == nil || s.Worker == nil || tenant == "" || worker == "" {
		return ErrDenied
	}
	if err := s.Worker.VerifyWorker(ctx, tenant, worker); err != nil {
		return ErrDenied
	}
	delivery, err := s.Store.Claim(ctx, tenant, worker, now)
	if err != nil {
		return err
	}
	if delivery.TenantID != tenant || delivery.EventID == "" || delivery.FacilityID == "" ||
		delivery.ZoneID == "" || delivery.SourceID == "" {
		return ErrDenied
	}
	err = s.Notifier.Send(ctx, delivery)
	if doneErr := s.Store.Complete(ctx, tenant, delivery.EventID, worker, err == nil, now); doneErr != nil {
		return doneErr
	}
	return err
}

func (s Service) SetOptIn(ctx context.Context, scope Scope, facility, zone string, enabled bool) error {
	if s.Store == nil || !permitted(scope, facility, zone, security.PlantWrite) {
		return ErrDenied
	}
	opt, ok := s.Store.(OptInStore)
	if !ok {
		return ErrDenied
	}
	return opt.OptIn(ctx, scope, facility, zone, enabled)
}
