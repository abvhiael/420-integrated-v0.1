package telemetry

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type fakeStore struct{ items []Reading }

func (f *fakeStore) Insert(_ context.Context, r Reading) error {
	for _, v := range f.items {
		if v.TenantID == r.TenantID && v.ObservationID == r.ObservationID {
			return ErrConflict
		}
	}
	f.items = append(f.items, r)
	return nil
}
func (f *fakeStore) History(_ context.Context, tenant, facility, zone, kind string, from, to time.Time, limit int) ([]Reading, error) {
	out := []Reading{}
	for _, v := range f.items {
		if v.TenantID == tenant && v.FacilityID == facility && v.ZoneID == zone && v.Kind == kind &&
			!v.MeasuredAt.Before(from) && v.MeasuredAt.Before(to) && len(out) < limit {
			out = append(out, v)
		}
	}
	return out, nil
}
func goodScope(t string, role security.Role) Scope {
	return Scope{Principal: security.Principal{SubjectID: "u", Authenticated: true},
		Membership: security.Grant{SubjectID: "u", TenantID: t, Role: role, State: security.Active}, TenantID: t}
}
func TestIngestValidateAndHistoricalCharts(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 10, 8, 14, 0, 0, 0, time.UTC)
	f := &fakeStore{}
	s := New(f)
	r := Reading{TenantID: "t", FacilityID: "f", ZoneID: "z", ObservationID: "o1", SensorID: "s1",
		Kind: "temperature", Unit: "C", Source: "manual", Value: 21.2, MeasuredAt: now.Add(-time.Minute)}
	if err := s.Ingest(ctx, goodScope("t", security.Owner), r, now); err != nil {
		t.Fatal(err)
	}
	if err := s.Ingest(ctx, goodScope("t", security.Owner), r, now); !errors.Is(err, ErrConflict) {
		t.Fatal("duplicate accepted", err)
	}
	out, err := s.History(ctx, goodScope("t", security.Reviewer), "f", "z", "temperature", now.Add(-time.Hour), now, 50)
	if err != nil || len(out) != 1 {
		t.Fatalf("unexpected history: %+v %v", out, err)
	}
	if _, err := s.History(ctx, goodScope("other", security.Owner), "f", "z", "temperature", now.Add(-time.Hour), now, 50); err != nil {
		t.Fatal(err)
	}
	if _, err := s.History(ctx, goodScope("t", security.Owner), "f", "z", "temperature", now, now, 50); !errors.Is(err, ErrInvalid) {
		t.Fatal("bad window")
	}
	for _, invalid := range []Reading{
		func() Reading { x := r; x.ObservationID = "o2"; x.Value = math.NaN(); return x }(),
		func() Reading { x := r; x.ObservationID = "o2"; x.Value = math.Inf(1); return x }(),
		func() Reading { x := r; x.ObservationID = "o2"; x.Unit = "F"; return x }(),
		func() Reading { x := r; x.ObservationID = "o2"; x.Kind = "unknown"; return x }(),
		func() Reading { x := r; x.ObservationID = "o2"; x.MeasuredAt = now.Add(6 * time.Minute); return x }(),
	} {
		if err := s.Ingest(ctx, goodScope("t", security.Owner), invalid, now); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted invalid reading: %v", err)
		}
	}
	if err := s.Ingest(ctx, goodScope("t", security.Reviewer), r, now); !errors.Is(err, ErrDenied) {
		t.Fatal("reviewer wrote")
	}
	if err := s.Ingest(ctx, goodScope("other", security.Owner), r, now); !errors.Is(err, ErrDenied) {
		t.Fatal("other tenant wrote")
	}
}

type panicStore struct{}

func (panicStore) Insert(context.Context, Reading) error {
	panic("unauthorized insert reached storage")
}
func (panicStore) History(context.Context, string, string, string, string, time.Time, time.Time, int) ([]Reading, error) {
	panic("unauthorized read reached storage")
}
func TestUnauthenticatedNeverReadsStorage(t *testing.T) {
	s := New(panicStore{})
	scope := goodScope("t", security.Owner)
	scope.Principal.Authenticated = false
	if _, err := s.History(context.Background(), scope, "f", "z", "temperature", time.Now().Add(-time.Hour), time.Now(), 50); !errors.Is(err, ErrDenied) {
		t.Fatal(err)
	}
}
