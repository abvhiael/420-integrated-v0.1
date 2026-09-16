package dashboard

import (
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/predictive"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

func TestBuildTrustPresentationShowsProvenanceFreshnessAndGaps(t *testing.T) {
	metric := testMetric(t)
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	method, _ := methodology.Resolve(metric.ID)
	series := timeseries.Series{
		SchemaVersion: timeseries.SeriesSchemaVersion, ID: "series_trust", SnapshotKey: "snap_trust",
		MetricID: metric.ID, Unit: metric.Unit, Methodology: method, ChainID: 420,
		Start: start, End: start.Add(2*time.Hour), BucketSeconds: 3600, GapPolicy: timeseries.GapPolicyExplicit,
		Points: []timeseries.Point{{BucketStart:start,BucketEnd:start.Add(time.Hour),SnapshotID:"anl_1",GeneratedAt:start.Add(30*time.Minute),Value:"100"},{BucketStart:start.Add(time.Hour),BucketEnd:start.Add(2*time.Hour),Gap:true}},
		Canonical:false, Rebuildable:true,
	}
	if err := timeseries.Validate(series); err != nil { t.Fatal(err) }
	trust := BuildTrustPresentation([]model.Metric{metric}, []timeseries.Series{series}, nil, nil, true)
	if len(trust.Metrics) != 1 { t.Fatalf("metrics=%d", len(trust.Metrics)) }
	item := trust.Metrics[0]
	if item.Source == "" || item.ChainID != 420 || item.IndexedHeight != 100 || item.SafeHeight != 95 || item.Freshness != "stale" || item.Canonical || !item.Rebuildable {
		t.Fatalf("unexpected trust detail: %#v", item)
	}
	if len(trust.Missing) != 1 || !strings.Contains(trust.Missing[0], "1 explicit gap") { t.Fatalf("missing=%#v", trust.Missing) }
}

func TestBuildTrustPresentationLabelsPredictiveOutputs(t *testing.T) {
	metric := testMetric(t)
	start := time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC)
	method, _ := methodology.Resolve(metric.ID)
	series := timeseries.Series{SchemaVersion:timeseries.SeriesSchemaVersion,ID:"series_pred",SnapshotKey:"snap_pred",MetricID:metric.ID,Unit:metric.Unit,Methodology:method,ChainID:420,Start:start,End:start.Add(time.Hour),BucketSeconds:3600,GapPolicy:timeseries.GapPolicyExplicit,Points:[]timeseries.Point{{BucketStart:start,BucketEnd:start.Add(time.Hour),SnapshotID:"anl_1",GeneratedAt:start.Add(30*time.Minute),Value:"100"}},Canonical:false,Rebuildable:true}
	if err := timeseries.Validate(series); err != nil { t.Fatal(err) }
	forecast, err := predictive.BuildForecast(series, predictive.ModelDescriptor{ID:"linear",Version:"1",Description:"test"}, start.Add(2*time.Hour), 2*time.Hour, []predictive.ForecastPoint{{At:start.Add(2*time.Hour),Value:"101"}})
	if err != nil { t.Fatal(err) }
	anomalies, err := predictive.BuildAnomalies(series, predictive.ModelDescriptor{ID:"zscore",Version:"1",Description:"test"}, start.Add(2*time.Hour), []predictive.Anomaly{{At:start.Add(30*time.Minute),Observed:"100",Score:"2",Severity:"high",SnapshotID:"anl_1"}})
	if err != nil { t.Fatal(err) }
	trust := BuildTrustPresentation(nil, nil, []predictive.Forecast{forecast}, []predictive.AnomalySet{anomalies}, false)
	if len(trust.Predictive) != 2 { t.Fatalf("predictive=%d", len(trust.Predictive)) }
	for _, item := range trust.Predictive {
		if !item.Predictive || item.Canonical || !item.Rebuildable || item.Model == "" || item.SourceSeriesID == "" || item.SnapshotKey == "" { t.Fatalf("bad predictive item: %#v", item) }
	}
}

func TestBuildTrustPresentationRejectsInvalidPredictive(t *testing.T) {
	bad := predictive.Forecast{MetricID:"network.indexed_height", Predictive:true}
	trust := BuildTrustPresentation(nil, nil, []predictive.Forecast{bad}, nil, false)
	if len(trust.Predictive) != 0 { t.Fatalf("invalid predictive output rendered: %#v", trust.Predictive) }
}
