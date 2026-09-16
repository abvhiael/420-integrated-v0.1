package timeseries

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
)

func TestBuildUsesLatestObservationPerBucketAndExplicitGaps(t *testing.T) {
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	snapshots := []model.Snapshot{
		mustSnapshot(t, start.Add(10*time.Minute), 100, "100", "0x100"),
		mustSnapshot(t, start.Add(50*time.Minute), 101, "101", "0x101"),
		mustSnapshot(t, start.Add(2*time.Hour+10*time.Minute), 102, "102", "0x102"),
	}

	series, err := Build("network.indexed_height", start, start.Add(3*time.Hour), time.Hour, snapshots)
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if err := Validate(series); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
	if len(series.Points) != 3 {
		t.Fatalf("len(points) = %d, want 3", len(series.Points))
	}
	if series.Points[0].Gap || series.Points[0].Value != "101" {
		t.Fatalf("first bucket = %+v, want latest observation value 101", series.Points[0])
	}
	if !series.Points[1].Gap {
		t.Fatalf("second bucket = %+v, want explicit gap", series.Points[1])
	}
	if series.Points[1].SnapshotID != "" || series.Points[1].Value != "" || !series.Points[1].GeneratedAt.IsZero() {
		t.Fatalf("gap bucket carries observation data: %+v", series.Points[1])
	}
	if series.Points[2].Gap || series.Points[2].Value != "102" {
		t.Fatalf("third bucket = %+v, want observation value 102", series.Points[2])
	}
	if series.Canonical || !series.Rebuildable || series.GapPolicy != GapPolicyExplicit {
		t.Fatalf("series authority flags invalid: %+v", series)
	}
}

func TestBuildIsDeterministicAcrossInputOrder(t *testing.T) {
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	a := mustSnapshot(t, start.Add(10*time.Minute), 100, "100", "0x100")
	b := mustSnapshot(t, start.Add(70*time.Minute), 101, "101", "0x101")

	forward, err := Build("network.indexed_height", start, start.Add(2*time.Hour), time.Hour, []model.Snapshot{a, b})
	if err != nil {
		t.Fatalf("forward Build() error = %v", err)
	}
	reverse, err := Build("network.indexed_height", start, start.Add(2*time.Hour), time.Hour, []model.Snapshot{b, a})
	if err != nil {
		t.Fatalf("reverse Build() error = %v", err)
	}
	if forward.ID != reverse.ID || forward.SnapshotKey != reverse.SnapshotKey {
		t.Fatalf("determinism mismatch: forward=(%s,%s) reverse=(%s,%s)", forward.ID, forward.SnapshotKey, reverse.ID, reverse.SnapshotKey)
	}
	if len(forward.Points) != len(reverse.Points) {
		t.Fatalf("point count mismatch")
	}
	for i := range forward.Points {
		if forward.Points[i] != reverse.Points[i] {
			t.Fatalf("point %d differs: forward=%+v reverse=%+v", i, forward.Points[i], reverse.Points[i])
		}
	}
}

func TestPaginateBindsCursorToSnapshotKey(t *testing.T) {
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	first, err := Build(
		"network.indexed_height",
		start,
		start.Add(3*time.Hour),
		time.Hour,
		[]model.Snapshot{
			mustSnapshot(t, start.Add(10*time.Minute), 100, "100", "0x100"),
			mustSnapshot(t, start.Add(70*time.Minute), 101, "101", "0x101"),
			mustSnapshot(t, start.Add(130*time.Minute), 102, "102", "0x102"),
		},
	)
	if err != nil {
		t.Fatalf("first Build() error = %v", err)
	}

	page, err := Paginate(first, "", 2)
	if err != nil {
		t.Fatalf("Paginate() error = %v", err)
	}
	if len(page.Points) != 2 || page.NextCursor == "" {
		t.Fatalf("first page = %+v, want 2 points and cursor", page)
	}
	secondPage, err := Paginate(first, page.NextCursor, 2)
	if err != nil {
		t.Fatalf("second Paginate() error = %v", err)
	}
	if len(secondPage.Points) != 1 || secondPage.NextCursor != "" {
		t.Fatalf("second page = %+v, want final single point", secondPage)
	}

	changed, err := Build(
		"network.indexed_height",
		start,
		start.Add(3*time.Hour),
		time.Hour,
		[]model.Snapshot{
			mustSnapshot(t, start.Add(10*time.Minute), 100, "100", "0x100"),
			mustSnapshot(t, start.Add(70*time.Minute), 101, "999", "0x101"),
			mustSnapshot(t, start.Add(130*time.Minute), 102, "102", "0x102"),
		},
	)
	if err != nil {
		t.Fatalf("changed Build() error = %v", err)
	}
	if changed.SnapshotKey == first.SnapshotKey {
		t.Fatal("snapshot key did not change when metric content changed")
	}
	if _, err := Paginate(changed, page.NextCursor, 2); err == nil {
		t.Fatal("Paginate() accepted cursor from different fixed snapshot set")
	}
}

func TestBuildRejectsMethodologyDrift(t *testing.T) {
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	snapshot := mustSnapshot(t, start.Add(10*time.Minute), 100, "100", "0x100")
	snapshot.Metrics[0].Methodology.Version = "v2"
	if _, err := Build("network.indexed_height", start, start.Add(time.Hour), time.Hour, []model.Snapshot{snapshot}); err == nil {
		t.Fatal("Build() accepted methodology drift")
	}
}

func mustSnapshot(t *testing.T, generatedAt time.Time, height uint64, value, hash string) model.Snapshot {
	t.Helper()
	method, err := methodology.Resolve("network.indexed_height")
	if err != nil {
		t.Fatalf("Resolve() error = %v", err)
	}
	provenance := model.Provenance{
		Source:          string(architecture.SourceIndexer),
		ChainID:         420,
		IndexedHeight:   height,
		IndexedHeadHash: hash,
		SafeHeight:      height - 1,
		IndexedAt:       generatedAt.Add(-time.Minute),
	}
	metric, err := model.NewMetric(
		"network.indexed_height",
		architecture.MetricNetwork,
		"Indexed height",
		value,
		"blocks",
		method,
		model.Window{Kind: model.WindowPoint},
		provenance,
	)
	if err != nil {
		t.Fatalf("NewMetric() error = %v", err)
	}
	snapshot, err := model.NewSnapshot(generatedAt, provenance, []model.Metric{metric})
	if err != nil {
		t.Fatalf("NewSnapshot() error = %v", err)
	}
	return snapshot
}
