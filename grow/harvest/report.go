package harvest

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

// Plan is a human-entered harvest window, never a recorded harvest.
type Plan struct {
	TenantID, FacilityID, ZoneID, PlantID, Actor, Source string
	Start, End                                           time.Time
}
type PlanStore interface {
	SavePlan(context.Context, Plan) error
	Plans(context.Context, string, string, string, time.Time, time.Time, int) ([]Plan, error)
}

func (s Service) Plan(ctx context.Context, scope Scope, p Plan, now time.Time) error {
	if !allowed(scope, p.FacilityID, p.ZoneID, security.PlantWrite) || p.TenantID != scope.TenantID {
		return ErrDenied
	}
	if p.PlantID == "" || p.Actor != scope.Principal.SubjectID || p.Source == "" || len(p.Source) > 128 ||
		p.Start.IsZero() || !p.Start.Before(p.End) || p.End.Sub(p.Start) > 180*24*time.Hour ||
		p.Start.Before(now.Add(-366*24*time.Hour)) || p.End.After(now.AddDate(3, 0, 0)) {
		return ErrInvalid
	}
	store, ok := s.store.(PlanStore)
	if !ok {
		return ErrDenied
	}
	return store.SavePlan(ctx, p)
}
func (s Service) Calendar(ctx context.Context, scope Scope, facility, zone string, from, to time.Time, limit int) ([]Plan, error) {
	if !allowed(scope, facility, zone, security.View) {
		return nil, ErrDenied
	}
	if from.IsZero() || !from.Before(to) || to.Sub(from) > 366*24*time.Hour || limit < 1 || limit > 500 {
		return nil, ErrInvalid
	}
	store, ok := s.store.(PlanStore)
	if !ok {
		return nil, ErrDenied
	}
	rows, err := store.Plans(ctx, scope.TenantID, facility, zone, from, to, limit+1)
	if err != nil {
		return nil, err
	}
	if len(rows) > limit {
		return nil, ErrInvalid
	}
	for _, p := range rows {
		if p.TenantID != scope.TenantID || p.FacilityID != facility || p.ZoneID != zone || p.PlantID == "" ||
			!p.Start.Before(to) || !p.End.After(from) || !p.Start.Before(p.End) {
			return nil, ErrDenied
		}
	}
	return rows, nil
}

// csvCell neutralizes spreadsheet formula execution in otherwise valid CSV fields.
func csvCell(v string) string {
	if strings.HasPrefix(v, "=") || strings.HasPrefix(v, "+") || strings.HasPrefix(v, "-") || strings.HasPrefix(v, "@") ||
		strings.HasPrefix(v, "\t") || strings.HasPrefix(v, "\r") {
		return "'" + v
	}
	return v
}

// Report provides bounded production-by-period and provenance-bearing CSV export.
// Forecasts are deliberately excluded from the observed production ledger.
type Period struct {
	Month string
	Count int
	Grams float64
}
type Dimension struct {
	ID    string
	Count int
	Grams float64
}
type Report struct {
	Kind       string
	FacilityID string
	ZoneID     string
	Count      int
	TotalGrams float64
	Periods    []Period
	ByPlant    []Dimension
	ByCultivar []Dimension
	CSV        []byte
}

func (s Service) Production(ctx context.Context, scope Scope, facility, zone string, from, to time.Time, limit int) (Report, error) {
	if s.store == nil || !allowed(scope, facility, zone, security.View) {
		return Report{}, ErrDenied
	}
	if from.IsZero() || !from.Before(to) || to.Sub(from) > 366*24*time.Hour || limit < 1 || limit > 500 {
		return Report{}, ErrInvalid
	}
	rows, err := s.store.List(ctx, scope.TenantID, facility, zone, from, to, limit+1)
	if err != nil {
		return Report{}, err
	}
	if len(rows) > limit {
		return Report{}, ErrInvalid
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].HarvestedAt.Equal(rows[j].HarvestedAt) {
			return rows[i].ID < rows[j].ID
		}
		return rows[i].HarvestedAt.Before(rows[j].HarvestedAt)
	})
	report := Report{Kind: "OBSERVED", FacilityID: facility, ZoneID: zone}
	periods := map[string]*Period{}
	plants := map[string]*Dimension{}
	cultivars := map[string]*Dimension{}
	seen := map[string]bool{}
	var out bytes.Buffer
	writer := csv.NewWriter(&out)
	if err = writer.Write([]string{"record_type", "harvest_id", "plant_id", "facility_id", "zone_id", "harvested_at_utc", "weight_grams", "source", "actor", "cultivar_id"}); err != nil {
		return Report{}, err
	}
	for _, r := range rows {
		if r.TenantID != scope.TenantID || r.FacilityID != facility || r.ZoneID != zone ||
			r.ID == "" || r.PlantID == "" || seen[r.ID] || r.HarvestedAt.Before(from) || !r.HarvestedAt.Before(to) ||
			math.IsNaN(r.WeightGrams) || math.IsInf(r.WeightGrams, 0) || r.WeightGrams <= 0 || r.WeightGrams > 1000000 {
			return Report{}, ErrDenied
		}
		seen[r.ID] = true
		month := r.HarvestedAt.UTC().Format("2006-01")
		if plants[r.PlantID] == nil {
			plants[r.PlantID] = &Dimension{ID: r.PlantID}
		}
		plant := plants[r.PlantID]
		plant.Count++
		plant.Grams += r.WeightGrams
		cultivarID := r.CultivarID
		if cultivarID == "" {
			cultivarID = "UNSPECIFIED"
		}
		if cultivars[cultivarID] == nil {
			cultivars[cultivarID] = &Dimension{ID: cultivarID}
		}
		cultivar := cultivars[cultivarID]
		cultivar.Count++
		cultivar.Grams += r.WeightGrams
		if periods[month] == nil {
			periods[month] = &Period{Month: month}
		}
		periods[month].Count++
		periods[month].Grams += r.WeightGrams
		report.Count++
		report.TotalGrams += r.WeightGrams
		if err = writer.Write([]string{"OBSERVED", r.ID, r.PlantID, r.FacilityID, r.ZoneID, r.HarvestedAt.UTC().Format(time.RFC3339Nano), strconv.FormatFloat(r.WeightGrams, 'f', -1, 64), csvCell(r.Source), csvCell(r.Actor), csvCell(r.CultivarID)}); err != nil {
			return Report{}, err
		}
	}
	for _, p := range periods {
		report.Periods = append(report.Periods, *p)
	}
	for _, p := range plants {
		report.ByPlant = append(report.ByPlant, *p)
	}
	for _, p := range cultivars {
		report.ByCultivar = append(report.ByCultivar, *p)
	}
	sort.Slice(report.Periods, func(i, j int) bool { return report.Periods[i].Month < report.Periods[j].Month })
	sort.Slice(report.ByPlant, func(i, j int) bool { return report.ByPlant[i].ID < report.ByPlant[j].ID })
	sort.Slice(report.ByCultivar, func(i, j int) bool { return report.ByCultivar[i].ID < report.ByCultivar[j].ID })
	writer.Flush()
	if err = writer.Error(); err != nil {
		return Report{}, errors.New("harvest export failed")
	}
	report.CSV = out.Bytes()
	return report, nil
}
