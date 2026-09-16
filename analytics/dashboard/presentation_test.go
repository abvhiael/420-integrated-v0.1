package dashboard

import (
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

func testMetric(t *testing.T) model.Metric {
	t.Helper()
	method, err := methodology.Resolve("network.indexed_height")
	if err != nil { t.Fatal(err) }
	metric, err := model.NewMetric(
		"network.indexed_height",
		architecture.MetricNetwork,
		"Indexed height",
		"100",
		"blocks",
		method,
		model.Window{Kind: model.WindowPoint},
		model.Provenance{Source: string(architecture.SourceIndexer), ChainID: 420, IndexedHeight: 100, IndexedHeadHash: "0xabc", SafeHeight: 95, IndexedAt: time.Date(2026, 9, 15, 2, 0, 0, 0, time.UTC)},
	)
	if err != nil { t.Fatal(err) }
	return metric
}

func TestBuildPresentationCarriesContext(t *testing.T) {
	metric := testMetric(t)
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	method, _ := methodology.Resolve(metric.ID)
	series := timeseries.Series{
		SchemaVersion: timeseries.SeriesSchemaVersion,
		ID: "series_test",
		SnapshotKey: "snap_test",
		MetricID: metric.ID,
		Unit: metric.Unit,
		Methodology: method,
		ChainID: 420,
		Start: start,
		End: start.Add(2 * time.Hour),
		BucketSeconds: 3600,
		GapPolicy: timeseries.GapPolicyExplicit,
		Points: []timeseries.Point{
			{BucketStart: start, BucketEnd: start.Add(time.Hour), SnapshotID: "anl_1", GeneratedAt: start.Add(30 * time.Minute), Value: "100"},
			{BucketStart: start.Add(time.Hour), BucketEnd: start.Add(2 * time.Hour), Gap: true},
		},
		Canonical: false,
		Rebuildable: true,
	}
	if err := timeseries.Validate(series); err != nil { t.Fatal(err) }

	presentation := BuildPresentation([]model.Metric{metric}, []timeseries.Series{series})
	if len(presentation.Cards) != 1 || len(presentation.Rows) != 1 || len(presentation.Charts) != 1 {
		t.Fatalf("unexpected presentation sizes: %#v", presentation)
	}
	card := presentation.Cards[0]
	if card.Unit != "blocks" || card.Window != "point-in-time" || card.Source != string(architecture.SourceIndexer) {
		t.Fatalf("metric context missing: %#v", card)
	}
	if !strings.Contains(card.Methodology, "@") { t.Fatalf("methodology version missing: %q", card.Methodology) }
	chart := presentation.Charts[0]
	if chart.Unit != "blocks" || chart.Source != string(architecture.SourceIndexer) || chart.Observed != 1 || chart.Gaps != 1 || chart.Polyline == "" {
		t.Fatalf("chart context missing: %#v", chart)
	}
}

func TestBuildPresentationRejectsInvalidInputs(t *testing.T) {
	metric := testMetric(t)
	invalid := metric
	invalid.Canonical = true
	presentation := BuildPresentation([]model.Metric{invalid}, []timeseries.Series{{MetricID: metric.ID}})
	if len(presentation.Cards) != 0 || len(presentation.Rows) != 0 || len(presentation.Charts) != 0 {
		t.Fatalf("invalid analytics data must not render: %#v", presentation)
	}
}

func TestChartPolylineAccountsForGaps(t *testing.T) {
	points := []timeseries.Point{{Value: "1"}, {Gap: true}, {Value: "3"}}
	line, observed, gaps := chartPolyline(points)
	if observed != 2 || gaps != 1 { t.Fatalf("observed=%d gaps=%d", observed, gaps) }
	if line == "" || !strings.Contains(line, "0.00,100.00") || !strings.Contains(line, "100.00,0.00") {
		t.Fatalf("unexpected polyline: %q", line)
	}
}
