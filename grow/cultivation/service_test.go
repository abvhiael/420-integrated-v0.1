package cultivation

import (
	"context"
	"errors"
	"github.com/420integrated/420-integrated/grow/security"
	"math"
	"testing"
	"time"
)

type fakeStore struct{ events []Event }

func (f *fakeStore) Append(_ context.Context, e Event) error {
	for _, x := range f.events {
		if x.TenantID == e.TenantID && x.IdempotencyKey == e.IdempotencyKey {
			return ErrConflict
		}
	}
	f.events = append(f.events, e)
	return nil
}
func (f *fakeStore) History(_ context.Context, tenant, facility, zone, kind string, from, to time.Time, limit int) ([]Event, error) {
	out := []Event{}
	for _, x := range f.events {
		if x.TenantID == tenant && x.FacilityID == facility && x.ZoneID == zone && x.Kind == kind &&
			!x.OccurredAt.Before(from) && x.OccurredAt.Before(to) && len(out) < limit {
			out = append(out, x)
		}
	}
	return out, nil
}
func scope(t string, role security.Role) Scope {
	return Scope{Principal: security.Principal{SubjectID: "u", Authenticated: true},
		Grant: security.Grant{SubjectID: "u", TenantID: t, Role: role, State: security.Active}, TenantID: t}
}
func TestNutrientsIrrigationEnvironmentAndReplay(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 9, 1, 0, 0, 0, time.UTC)
	db := &fakeStore{}
	s := New(db)
	owner := scope("t", security.Owner)
	cases := []Event{
		{Kind: "NUTRIENT", Metric: "NUTRIENT_EC", Unit: "mS/cm", Amount: 1.8},
		{Kind: "NUTRIENT", Metric: "NUTRIENT_PH", Unit: "pH", Amount: 6.0},
		{Kind: "IRRIGATION", Metric: "IRRIGATION_VOLUME", Unit: "L", Amount: 8},
		{Kind: "ENVIRONMENT", Metric: "ENV_TEMPERATURE", Unit: "C", Amount: 23},
		{Kind: "ENVIRONMENT", Metric: "ENV_HUMIDITY", Unit: "%", Amount: 70},
	}
	for i, e := range cases {
		e.TenantID = "t"
		e.FacilityID = "f"
		e.ZoneID = "z"
		e.ID = string(rune('a' + i))
		e.Actor = "u"
		e.Source = "manual"
		e.IdempotencyKey = e.ID
		e.OccurredAt = now.Add(-time.Minute)
		if err := s.Append(ctx, owner, e, now); err != nil {
			t.Fatal(err)
		}
		if err := s.Append(ctx, owner, e, now); !errors.Is(err, ErrConflict) {
			t.Fatal("replay accepted")
		}
	}
	records, err := s.History(ctx, scope("t", security.Reviewer), "f", "z", "NUTRIENT", now.Add(-time.Hour), now, 25)
	if err != nil || len(records) != 2 {
		t.Fatalf("history %+v %v", records, err)
	}
	if err := s.Append(ctx, scope("t", security.Reviewer), db.events[0], now); !errors.Is(err, ErrDenied) {
		t.Fatal("reviewer mutated journal")
	}
	if err := s.Append(ctx, scope("other", security.Owner), db.events[0], now); !errors.Is(err, ErrDenied) {
		t.Fatal("cross tenant mutation")
	}
	if _, err := s.History(ctx, scope("other", security.Owner), "f", "z", "NUTRIENT", now.Add(-time.Hour), now, 10); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*Event){
		func(e *Event) { e.Amount = math.NaN() },
		func(e *Event) { e.Amount = math.Inf(1) },
		func(e *Event) { e.Unit = "g" },
		func(e *Event) { e.Amount = 1e9 },
		func(e *Event) { e.OccurredAt = now.Add(6 * time.Minute) },
		func(e *Event) { e.Actor = "spoofed" },
		func(e *Event) { e.IdempotencyKey = "" },
	} {
		e := db.events[0]
		e.ID = "new"
		e.IdempotencyKey = "new"
		mutate(&e)
		if err := s.Append(ctx, owner, e, now); !errors.Is(err, ErrInvalid) {
			t.Fatalf("invalid accepted: %v", err)
		}
	}
	if _, err := s.History(ctx, owner, "f", "z", "NUTRIENT", now, now, 10); !errors.Is(err, ErrInvalid) {
		t.Fatal("bad time window")
	}
}

type panicStore struct{}

func (panicStore) Append(context.Context, Event) error { panic("unauthenticated write reached store") }
func (panicStore) History(context.Context, string, string, string, string, time.Time, time.Time, int) ([]Event, error) {
	panic("unauthenticated read reached store")
}
func TestDenyBeforeStore(t *testing.T) {
	s := New(panicStore{})
	a := scope("t", security.Owner)
	a.Principal.Authenticated = false
	if _, err := s.History(context.Background(), a, "f", "z", "NUTRIENT", time.Now().Add(-time.Hour), time.Now(), 10); !errors.Is(err, ErrDenied) {
		t.Fatal(err)
	}
}
