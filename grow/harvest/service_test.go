package harvest

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type fakeStore struct{ rows []Record }

func (f *fakeStore) Append(_ context.Context, r Record) error {
	for _, x := range f.rows {
		if x.TenantID == r.TenantID && x.IdempotencyKey == r.IdempotencyKey {
			return ErrConflict
		}
	}
	f.rows = append(f.rows, r)
	return nil
}
func (f *fakeStore) List(_ context.Context, tenant, facility, zone string, from, to time.Time, limit int) ([]Record, error) {
	out := []Record{}
	for _, r := range f.rows {
		if r.TenantID == tenant && r.FacilityID == facility && r.ZoneID == zone &&
			!r.HarvestedAt.Before(from) && r.HarvestedAt.Before(to) && len(out) < limit {
			out = append(out, r)
		}
	}
	return out, nil
}
func owner(tenant string, role security.Role) Scope {
	return Scope{TenantID: tenant, Principal: security.Principal{SubjectID: "u", Authenticated: true},
		Grant: security.Grant{SubjectID: "u", TenantID: tenant, State: security.Active, Role: role}}
}
func TestRecordedVsEstimated(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	db := &fakeStore{}
	svc := New(db)
	scope := owner("a", security.Owner)
	ctx := context.Background()
	from := now.Add(-24 * time.Hour)
	for i, w := range []float64{10, 20, 30} {
		r := Record{TenantID: "a", FacilityID: "f", ZoneID: "z", PlantID: string(rune('p' + i)), ID: string(rune('a' + i)),
			Actor: "u", IdempotencyKey: string(rune('a' + i)), Source: "manual", WeightGrams: w, HarvestedAt: now.Add(-time.Hour)}
		if err := svc.Record(ctx, scope, r, now); err != nil {
			t.Fatal(err)
		}
		if err := svc.Record(ctx, scope, r, now); !errors.Is(err, ErrConflict) {
			t.Fatal("replay accepted", err)
		}
	}
	sum, forecast, err := svc.Analytics(ctx, scope, "f", "z", from, now, 50)
	if err != nil || sum.Kind != "OBSERVED" || sum.Count != 3 || sum.TotalGrams != 60 ||
		forecast.Kind != "ESTIMATE" || !forecast.Available || forecast.Status != "AVAILABLE" || forecast.SampleCount != 3 || forecast.EstimateGrams != 20 ||
		forecast.LowerGrams >= forecast.EstimateGrams || forecast.UpperGrams <= forecast.EstimateGrams {
		t.Fatalf("summary=%+v forecast=%+v err=%v", sum, forecast, err)
	}
	_, empty, err := svc.Analytics(ctx, scope, "f", "z", now.Add(-time.Minute), now, 50)
	if err != nil || empty.SampleCount != 0 || empty.EstimateGrams != 0 || empty.Available || empty.Status != "INSUFFICIENT_DATA" {
		t.Fatal("missing data must not synthesize forecast")
	}
}
func TestAuthorizationAdversarialAndBounds(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	db := &fakeStore{}
	svc := New(db)
	o := owner("a", security.Owner)
	good := Record{TenantID: "a", FacilityID: "f", ZoneID: "z", PlantID: "p", ID: "id", Actor: "u", IdempotencyKey: "k", Source: "manual", WeightGrams: 100, HarvestedAt: now}
	for _, mutate := range []func(*Record){
		func(r *Record) { r.WeightGrams = math.NaN() },
		func(r *Record) { r.WeightGrams = math.Inf(1) },
		func(r *Record) { r.WeightGrams = -1 },
		func(r *Record) { r.WeightGrams = 0 },
		func(r *Record) { r.HarvestedAt = now.Add(6 * time.Minute) },
		func(r *Record) { r.IdempotencyKey = "" },
		func(r *Record) { r.Actor = "spoof" },
	} {
		r := good
		mutate(&r)
		if err := svc.Record(ctx, o, r, now); !errors.Is(err, ErrInvalid) {
			t.Fatal("invalid accepted", err)
		}
	}
	if err := svc.Record(ctx, owner("b", security.Owner), good, now); !errors.Is(err, ErrDenied) {
		t.Fatal("cross tenant")
	}
	if err := svc.Record(ctx, owner("a", security.Reviewer), good, now); !errors.Is(err, ErrDenied) {
		t.Fatal("reviewer write")
	}
	o.Principal.Authenticated = false
	if err := svc.Record(ctx, o, good, now); !errors.Is(err, ErrDenied) {
		t.Fatal("unauthenticated write")
	}
	if _, _, err := svc.Analytics(ctx, o, "f", "z", now.Add(-time.Hour), now, 10); !errors.Is(err, ErrDenied) {
		t.Fatal("unauthenticated read")
	}
	if _, _, err := svc.Analytics(ctx, owner("a", security.Owner), "f", "z", now, now, 10); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid window")
	}
	db.rows = []Record{{TenantID: "b", FacilityID: "f", ZoneID: "z", WeightGrams: 10, HarvestedAt: now.Add(-time.Minute)}}
	// A compromised/misconfigured repository returning B's data must fail closed.
	dbBad := &leakyStore{fakeStore: fakeStore{rows: db.rows}}
	if _, _, err := New(dbBad).Analytics(ctx, owner("a", security.Owner), "f", "z", now.Add(-time.Hour), now, 10); !errors.Is(err, ErrDenied) {
		t.Fatal("repository leak")
	}
}

type leakyStore struct{ fakeStore }

func (l *leakyStore) List(_ context.Context, _ string, _ string, _ string, _ time.Time, _ time.Time, _ int) ([]Record, error) {
	return l.rows, nil
}

func TestHighVarianceDoesNotProduceAnAuthoritativeForecast(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	db := &fakeStore{}
	for i, weight := range []float64{1, 2, 10000} {
		db.rows = append(db.rows, Record{TenantID: "a", FacilityID: "f", ZoneID: "z",
			PlantID: string(rune('p' + i)), ID: string(rune('a' + i)),
			WeightGrams: weight, HarvestedAt: now.Add(-time.Hour)})
	}
	observed, estimated, err := New(db).Analytics(context.Background(), owner("a", security.Owner),
		"f", "z", now.Add(-24*time.Hour), now, 50)
	if err != nil || observed.Count != 3 || observed.TotalGrams != 10003 ||
		estimated.Available || estimated.Status != "HIGH_VARIANCE" || estimated.EstimateGrams != 0 {
		t.Fatalf("high variance incorrectly published forecast: %+v %+v %v", observed, estimated, err)
	}
}
