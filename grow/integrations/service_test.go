package integrations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type fakeStore struct {
	enabled bool
	queued  map[string]Event
	sent    bool
	failed  bool
}

func (f *fakeStore) OptIn(_ context.Context, _ Scope, _, _ string, enabled bool) error {
	f.enabled = enabled
	return nil
}
func (f *fakeStore) Queue(_ context.Context, e Event, _ string) error {
	if !f.enabled {
		return ErrDenied
	}
	if f.queued == nil {
		f.queued = map[string]Event{}
	}
	if _, ok := f.queued[e.ID]; ok {
		return ErrConflict
	}
	f.queued[e.ID] = e
	return nil
}
func (f *fakeStore) Claim(_ context.Context, tenant, _ string, _ time.Time) (Delivery, error) {
	if !f.enabled {
		return Delivery{}, ErrDenied
	}
	for _, e := range f.queued {
		if e.TenantID == tenant {
			return Delivery{TenantID: e.TenantID, FacilityID: e.FacilityID, ZoneID: e.ZoneID,
				EventID: e.ID, Kind: e.Kind, SourceID: e.SourceID}, nil
		}
	}
	return Delivery{}, ErrConflict
}
func (f *fakeStore) Complete(_ context.Context, _, _, worker string, success bool, _ time.Time) error {
	if worker == "" {
		return ErrDenied
	}
	f.sent = success
	f.failed = !success
	return nil
}

type fakeWorker struct{}

func (fakeWorker) VerifyWorker(_ context.Context, tenant, worker string) error {
	if tenant != "a" || worker != "worker" {
		return ErrDenied
	}
	return nil
}

type fakeNotifier struct {
	err error
}

func (n fakeNotifier) Send(_ context.Context, event Delivery) error {
	if event.EventID == "" {
		return ErrInvalid
	}
	return n.err
}
func owner(tenant string, role security.Role) Scope {
	return Scope{TenantID: tenant,
		Principal: security.Principal{SubjectID: "operator", Authenticated: true},
		Grant:     security.Grant{TenantID: tenant, SubjectID: "operator", State: security.Active, Role: role}}
}
func TestConsentReplayAndDelivery(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	db := &fakeStore{}
	svc := Service{Store: db, Notifier: fakeNotifier{}, Worker: fakeWorker{}}
	e := Event{TenantID: "a", FacilityID: "f", ZoneID: "z", ID: "id",
		Kind: "HARVEST_RECORDED", SourceID: "h", CreatedAt: now}
	if err := svc.Queue(ctx, owner("a", security.Owner), e, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("nonconsensual notification queued: %v", err)
	}
	if err := svc.SetOptIn(ctx, owner("a", security.Owner), "f", "z", true); err != nil {
		t.Fatal(err)
	}
	if err := svc.Queue(ctx, owner("a", security.Owner), e, now); err != nil {
		t.Fatal(err)
	}
	if err := svc.Queue(ctx, owner("a", security.Owner), e, now); !errors.Is(err, ErrConflict) {
		t.Fatalf("replayed notification: %v", err)
	}
	if err := svc.Dispatch(ctx, "a", "worker", now); err != nil || !db.sent {
		t.Fatalf("delivery failed: %v", err)
	}
	svc.Notifier = fakeNotifier{err: ErrConflict}
	if err := svc.Dispatch(ctx, "a", "worker", now); !errors.Is(err, ErrConflict) || !db.failed {
		t.Fatalf("failure not recorded: %v", err)
	}
	if err := svc.SetOptIn(ctx, owner("a", security.Owner), "f", "z", false); err != nil {
		t.Fatal(err)
	}
	if err := svc.Dispatch(ctx, "a", "worker", now); !errors.Is(err, ErrDenied) {
		t.Fatalf("revoked consent allowed dispatch: %v", err)
	}
}
func TestAuthorizationAndInvalidEvents(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	svc := Service{Store: &fakeStore{enabled: true}, Notifier: fakeNotifier{}, Worker: fakeWorker{}}
	e := Event{TenantID: "a", FacilityID: "f", ZoneID: "z", ID: "id",
		Kind: "AI_REVIEW_READY", SourceID: "review", CreatedAt: now}
	ctx := context.Background()
	if err := svc.Queue(ctx, owner("b", security.Owner), e, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("cross-tenant event: %v", err)
	}
	if err := svc.Queue(ctx, owner("a", security.Reviewer), e, now); !errors.Is(err, ErrDenied) {
		t.Fatalf("read-only user queued event: %v", err)
	}
	for _, kind := range []string{"", "EXECUTE_HVAC", "PUBLISH_PUBLIC", "PAY"} {
		e.Kind = kind
		if err := svc.Queue(ctx, owner("a", security.Owner), e, now); !errors.Is(err, ErrInvalid) {
			t.Fatalf("unsafe event kind %q: %v", kind, err)
		}
	}
	if err := (Service{Store: svc.Store}).Dispatch(ctx, "a", "worker", now); !errors.Is(err, ErrDenied) {
		t.Fatalf("missing provider succeeded: %v", err)
	}
	if err := svc.Dispatch(ctx, "b", "worker", now); !errors.Is(err, ErrDenied) {
		t.Fatalf("unauthorized worker tenant scope accepted: %v", err)
	}
	if err := svc.SetOptIn(ctx, owner("a", security.Reviewer), "f", "z", true); !errors.Is(err, ErrDenied) {
		t.Fatalf("reader toggled opt-in: %v", err)
	}
}
