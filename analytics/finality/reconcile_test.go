package finality

import (
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
)

func TestFreshnessExplicitlyMarksStale(t *testing.T) {
	now := time.Date(2026, 9, 16, 1, 0, 0, 0, time.UTC)
	fresh, err := AssessFreshness(now.Add(-3*time.Minute), now, 2*time.Minute)
	if err != nil { t.Fatal(err) }
	if !fresh.Stale || fresh.AgeSeconds != 180 { t.Fatalf("unexpected freshness: %+v", fresh) }
}

func TestFinalizedSnapshotCannotRewrite(t *testing.T) {
	at := time.Date(2026, 9, 16, 1, 0, 0, 0, time.UTC)
	old := snapshot(t, at, 100, 100, "0xaaa", "1")
	incoming := snapshot(t, at, 101, 101, "0xbbb", "2")
	_, _, err := Reconcile([]model.Snapshot{old}, incoming)
	if !errors.Is(err, ErrFinalizedRewrite) { t.Fatalf("expected finalized rewrite rejection, got %v", err) }
}

func TestNonfinalizedSnapshotReconcilesDeterministically(t *testing.T) {
	at := time.Date(2026, 9, 16, 1, 0, 0, 0, time.UTC)
	old := snapshot(t, at, 110, 100, "0xaaa", "1")
	incoming := snapshot(t, at, 112, 102, "0xbbb", "2")
	out, action, err := Reconcile([]model.Snapshot{old}, incoming)
	if err != nil { t.Fatal(err) }
	if action != ActionReplace || len(out) != 1 || out[0].ID != incoming.ID { t.Fatalf("unexpected reconcile result: %s %+v", action, out) }
	out2, action2, err := Reconcile(out, incoming)
	if err != nil || action2 != ActionNoop || out2[0].ID != incoming.ID { t.Fatalf("reconcile not idempotent: %s %v", action2, err) }
}

func TestSafeHeightRegressionRejected(t *testing.T) {
	at1 := time.Date(2026, 9, 16, 1, 0, 0, 0, time.UTC)
	at2 := at1.Add(time.Minute)
	old := snapshot(t, at1, 110, 105, "0xaaa", "1")
	incoming := snapshot(t, at2, 111, 104, "0xbbb", "2")
	_, _, err := Reconcile([]model.Snapshot{old}, incoming)
	if !errors.Is(err, ErrSafeRegression) { t.Fatalf("expected safe-height regression rejection, got %v", err) }
}

func snapshot(t *testing.T, generated time.Time, indexed, safe uint64, hash, value string) model.Snapshot {
	t.Helper()
	p := model.Provenance{Source: string(architecture.SourceIndexer), ChainID: 420, IndexedHeight: indexed, IndexedHeadHash: hash, SafeHeight: safe, IndexedAt: generated}
	m, err := model.NewMetric("network.indexed_height", architecture.MetricNetwork, "Indexed height", value, "blocks", model.Methodology{ID:"network.indexed_height", Version:"1", Description:"test"}, model.Window{Kind:model.WindowPoint}, p)
	if err != nil { t.Fatal(err) }
	s, err := model.NewSnapshot(generated, p, []model.Metric{m})
	if err != nil { t.Fatal(err) }
	return s
}
