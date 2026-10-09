package harvest

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type planFake struct {
	fakeStore
	planned []Plan
}

func (f *planFake) SavePlan(_ context.Context, p Plan) error {
	f.planned = append(f.planned, p)
	return nil
}
func (f *planFake) Plans(_ context.Context, tenant, facility, zone string, from, to time.Time, limit int) ([]Plan, error) {
	out := []Plan{}
	for _, p := range f.planned {
		if p.TenantID == tenant && p.FacilityID == facility && p.ZoneID == zone &&
			p.Start.Before(to) && p.End.After(from) && len(out) < limit {
			out = append(out, p)
		}
	}
	return out, nil
}
func TestPlanningCalendarAndProductionExport(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	db := &planFake{}
	s := New(db)
	scope := owner("t", security.Owner)
	p := Plan{TenantID: "t", FacilityID: "f", ZoneID: "z", PlantID: "p",
		Actor: "u", Source: "manual", Start: now.Add(24 * time.Hour), End: now.Add(48 * time.Hour)}
	if err := s.Plan(context.Background(), scope, p, now); err != nil {
		t.Fatal(err)
	}
	calendar, err := s.Calendar(context.Background(), scope, "f", "z", now, now.Add(72*time.Hour), 10)
	if err != nil || len(calendar) != 1 {
		t.Fatalf("calendar=%+v err=%v", calendar, err)
	}
	if err := s.Plan(context.Background(), owner("t", security.Reviewer), p, now); err != ErrDenied {
		t.Fatalf("readonly reviewer changed schedule: %v", err)
	}
	db.rows = []Record{
		{TenantID: "t", FacilityID: "f", ZoneID: "z", PlantID: "p1", ID: "h1", CultivarID: "cultivar-a",
			WeightGrams: 12, HarvestedAt: now.Add(-time.Hour), Actor: "u", Source: "=HYPERLINK(1)"},
	}
	report, err := s.Production(context.Background(), scope, "f", "z", now.Add(-24*time.Hour), now, 10)
	if err != nil || report.Count != 1 || report.TotalGrams != 12 || len(report.Periods) != 1 ||
		len(report.ByPlant) != 1 || report.ByPlant[0].ID != "p1" ||
		len(report.ByCultivar) != 1 || report.ByCultivar[0].ID != "cultivar-a" ||
		!strings.Contains(string(report.CSV), "OBSERVED,h1,p1,f,z") || !strings.Contains(string(report.CSV), "'=HYPERLINK(1)") {
		t.Fatalf("report=%+v err=%v", report, err)
	}
	_, err = s.Production(context.Background(), scope, "f", "z", now.Add(-24*time.Hour), now, 0)
	if err != ErrInvalid {
		t.Fatalf("unbounded request accepted: %v", err)
	}
}
func TestCompleteAggregateFailClosed(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	db := &fakeStore{rows: []Record{
		{TenantID: "t", FacilityID: "f", ZoneID: "z", PlantID: "p1", ID: "h1", WeightGrams: 10, HarvestedAt: now.Add(-time.Hour)},
		{TenantID: "t", FacilityID: "f", ZoneID: "z", PlantID: "p2", ID: "h2", WeightGrams: 20, HarvestedAt: now.Add(-time.Hour)},
	}}
	s := New(db)
	ctx := context.Background()
	scope := owner("t", security.Owner)
	if _, _, err := s.Analytics(ctx, scope, "f", "z", now.Add(-24*time.Hour), now, 1); err != ErrInvalid {
		t.Fatalf("truncated analytics accepted: %v", err)
	}
	if _, err := s.Production(ctx, scope, "f", "z", now.Add(-24*time.Hour), now, 1); err != ErrInvalid {
		t.Fatalf("truncated production accepted: %v", err)
	}
}
