package dashboard

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/predictive"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

const MaxPredictiveItems = 16

type TrustDetail struct {
	MetricID      string
	Source        string
	ChainID       uint64
	IndexedHeight uint64
	SafeHeight    uint64
	IndexedAt     string
	Finality      string
	Freshness     string
	Canonical     bool
	Rebuildable   bool
}

type PredictiveItem struct {
	Kind           string
	MetricID       string
	Unit           string
	Model          string
	GeneratedAt    string
	SourceSeriesID string
	SnapshotKey    string
	Count          int
	Predictive     bool
	Canonical      bool
	Rebuildable    bool
}

type TrustPresentation struct {
	Metrics    []TrustDetail
	Predictive []PredictiveItem
	Missing    []string
}

func BuildTrustPresentation(metrics []model.Metric, series []timeseries.Series, forecasts []predictive.Forecast, anomalies []predictive.AnomalySet, stale bool) TrustPresentation {
	out := TrustPresentation{}
	seen := map[string]struct{}{}
	for _, metric := range metrics {
		if model.ValidateMetric(metric) != nil { continue }
		if _, ok := seen[metric.ID]; ok { continue }
		seen[metric.ID] = struct{}{}
		p := metric.Provenance
		finality := "nonfinalized"
		if p.SafeHeight >= p.IndexedHeight { finality = "safe/finalized-context" }
		freshness := "fresh"
		if stale { freshness = "stale" }
		out.Metrics = append(out.Metrics, TrustDetail{
			MetricID: metric.ID, Source: p.Source, ChainID: p.ChainID,
			IndexedHeight: p.IndexedHeight, SafeHeight: p.SafeHeight,
			IndexedAt: p.IndexedAt.UTC().Format(time.RFC3339), Finality: finality,
			Freshness: freshness, Canonical: false, Rebuildable: true,
		})
	}
	sort.Slice(out.Metrics, func(i, j int) bool { return out.Metrics[i].MetricID < out.Metrics[j].MetricID })

	for _, item := range series {
		if timeseries.Validate(item) != nil { continue }
		if itemGaps(item) > 0 { out.Missing = append(out.Missing, fmt.Sprintf("%s: %d explicit gap(s)", item.MetricID, itemGaps(item))) }
	}
	sort.Strings(out.Missing)

	for _, f := range forecasts {
		if predictive.ValidateForecast(f) != nil { continue }
		out.Predictive = append(out.Predictive, PredictiveItem{
			Kind: "forecast", MetricID: f.MetricID, Unit: f.Unit,
			Model: strings.TrimSpace(f.Model.ID) + "@" + strings.TrimSpace(f.Model.Version),
			GeneratedAt: f.GeneratedAt.UTC().Format(time.RFC3339), SourceSeriesID: f.SourceSeriesID,
			SnapshotKey: f.SnapshotKey, Count: len(f.Points), Predictive: true,
			Canonical: false, Rebuildable: true,
		})
	}
	for _, a := range anomalies {
		if predictive.ValidateAnomalies(a) != nil { continue }
		out.Predictive = append(out.Predictive, PredictiveItem{
			Kind: "anomaly", MetricID: a.MetricID, Unit: a.Unit,
			Model: strings.TrimSpace(a.Model.ID) + "@" + strings.TrimSpace(a.Model.Version),
			GeneratedAt: a.GeneratedAt.UTC().Format(time.RFC3339), SourceSeriesID: a.SourceSeriesID,
			SnapshotKey: a.SnapshotKey, Count: len(a.Anomalies), Predictive: true,
			Canonical: false, Rebuildable: true,
		})
	}
	sort.Slice(out.Predictive, func(i, j int) bool {
		if out.Predictive[i].Kind == out.Predictive[j].Kind { return out.Predictive[i].MetricID < out.Predictive[j].MetricID }
		return out.Predictive[i].Kind < out.Predictive[j].Kind
	})
	if len(out.Predictive) > MaxPredictiveItems { out.Predictive = out.Predictive[:MaxPredictiveItems] }
	return out
}

func itemGaps(series timeseries.Series) int {
	gaps := 0
	for _, p := range series.Points { if p.Gap { gaps++ } }
	return gaps
}
