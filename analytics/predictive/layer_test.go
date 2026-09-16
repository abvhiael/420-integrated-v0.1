package predictive

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

func TestBuildForecastAndAnomalies(t *testing.T) {
	series := fixtureSeries(t)
	modelDesc := ModelDescriptor{ID: "linear-v1", Version: "v1", Description: "deterministic qualification model"}

	forecast, err := BuildForecast(series, modelDesc, time.Date(2026, 9, 15, 18, 0, 0, 0, time.UTC), 2*time.Hour, []ForecastPoint{
		{At: series.End.Add(30 * time.Minute), Value: "12", Lower: "10", Upper: "14", Confidence: "0.8"},
		{At: series.End.Add(90 * time.Minute), Value: "13", Lower: "11", Upper: "15", Confidence: "0.7"},
	})
	if err != nil {
		t.Fatalf("BuildForecast: %v", err)
	}
	if forecast.Canonical || !forecast.Rebuildable || !forecast.Predictive {
		t.Fatal("forecast classification contract violated")
	}
	if forecast.SourceSeriesID != series.ID || forecast.SnapshotKey != series.SnapshotKey {
		t.Fatal("forecast lost source-series binding")
	}

	observed := firstObserved(t, series)
	anomalies, err := BuildAnomalies(series, modelDesc, time.Date(2026, 9, 15, 18, 0, 0, 0, time.UTC), []Anomaly{
		{At: observed.GeneratedAt, Observed: observed.Value, Score: "3.5", Severity: "high", SnapshotID: observed.SnapshotID},
	})
	if err != nil {
		t.Fatalf("BuildAnomalies: %v", err)
	}
	if len(anomalies.Anomalies) != 1 || anomalies.Anomalies[0].Severity != "high" {
		t.Fatal("unexpected anomaly result")
	}
}

func TestForecastRejectsObservedWindowAndInvalidConfidence(t *testing.T) {
	series := fixtureSeries(t)
	modelDesc := ModelDescriptor{ID: "m", Version: "v1", Description: "test"}
	_, err := BuildForecast(series, modelDesc, time.Now().UTC(), time.Hour, []ForecastPoint{{At: series.End, Value: "1"}})
	if err == nil {
		t.Fatal("expected forecast point at observed boundary to fail")
	}
	_, err = BuildForecast(series, modelDesc, time.Now().UTC(), time.Hour, []ForecastPoint{{At: series.End.Add(time.Minute), Value: "1", Confidence: "1.5"}})
	if err == nil {
		t.Fatal("expected invalid confidence to fail")
	}
}

func TestAnomalyMustBindObservedPoint(t *testing.T) {
	series := fixtureSeries(t)
	modelDesc := ModelDescriptor{ID: "m", Version: "v1", Description: "test"}
	observed := firstObserved(t, series)
	_, err := BuildAnomalies(series, modelDesc, time.Now().UTC(), []Anomaly{{At: observed.GeneratedAt, Observed: "999", Score: "2", Severity: "medium", SnapshotID: observed.SnapshotID}})
	if err == nil {
		t.Fatal("expected anomaly not matching observed value to fail")
	}
}

func TestPredictiveMetricCannotBecomeObservedProvenance(t *testing.T) {
	method, err := methodology.Resolve("network.indexed_height")
	if err != nil {
		t.Fatal(err)
	}
	metric := model.Metric{
		SchemaVersion: model.MetricSchemaVersion,
		ID: "network.indexed_height",
		Class: architecture.MetricForecast,
		Label: "forecast",
		Value: "10",
		Unit: "blocks",
		Methodology: method,
		Window: model.Window{Kind: model.WindowPoint},
		Provenance: fixtureProvenance(),
	}
	if err := ProvenanceForObservedMetric(metric); err == nil {
		t.Fatal("expected predictive class to be rejected as observed provenance")
	}
}

func fixtureSeries(t *testing.T) timeseries.Series {
	t.Helper()
	prov := fixtureProvenance()
	method, err := methodology.Resolve("network.indexed_height")
	if err != nil {
		t.Fatal(err)
	}
	base := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	makeSnapshot := func(idTime time.Time, value string, height uint64) model.Snapshot {
		p := prov
		p.IndexedHeight = height
		p.SafeHeight = height - 1
		p.IndexedHeadHash = "0x" + value
		p.IndexedAt = idTime
		metric, err := model.NewMetric("network.indexed_height", architecture.MetricNetwork, "Indexed height", value, "blocks", method, model.Window{Kind: model.WindowPoint}, p)
		if err != nil {
			t.Fatal(err)
		}
		s, err := model.NewSnapshot(idTime, p, []model.Metric{metric})
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	s1 := makeSnapshot(base.Add(10*time.Minute), "10", 10)
	s2 := makeSnapshot(base.Add(70*time.Minute), "11", 11)
	series, err := timeseries.Build("network.indexed_height", base, base.Add(2*time.Hour), time.Hour, []model.Snapshot{s1, s2})
	if err != nil {
		t.Fatalf("timeseries.Build: %v", err)
	}
	return series
}

func firstObserved(t *testing.T, series timeseries.Series) timeseries.Point {
	t.Helper()
	for _, p := range series.Points {
		if !p.Gap {
			return p
		}
	}
	t.Fatal("fixture series has no observed point")
	return timeseries.Point{}
}

func fixtureProvenance() model.Provenance {
	return model.Provenance{
		Source: string(architecture.SourceIndexer),
		ChainID: 420,
		IndexedHeight: 10,
		IndexedHeadHash: "0x10",
		SafeHeight: 9,
		IndexedAt: time.Date(2026, 9, 15, 12, 10, 0, 0, time.UTC),
	}
}
