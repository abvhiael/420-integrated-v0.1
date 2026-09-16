package dashboard

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

const (
	MaxDashboardCards  = 24
	MaxDashboardSeries = 8
)

type PresentationProvider func() Presentation

type Presentation struct {
	Cards  []MetricCard
	Charts []SeriesChart
	Rows   []MetricRow
}

type MetricCard struct {
	ID          string
	Label       string
	Value       string
	Unit        string
	Window      string
	Source      string
	Methodology string
	Class       string
}

type MetricRow = MetricCard

type SeriesChart struct {
	MetricID    string
	Unit        string
	Window      string
	Source      string
	Methodology string
	Polyline    string
	Observed    int
	Gaps        int
}

func BuildPresentation(metrics []model.Metric, series []timeseries.Series) Presentation {
	validMetrics := make([]model.Metric, 0, len(metrics))
	for _, metric := range metrics {
		if model.ValidateMetric(metric) == nil {
			validMetrics = append(validMetrics, metric)
		}
	}
	sort.Slice(validMetrics, func(i, j int) bool {
		if validMetrics[i].Class == validMetrics[j].Class {
			return validMetrics[i].ID < validMetrics[j].ID
		}
		return validMetrics[i].Class < validMetrics[j].Class
	})
	if len(validMetrics) > MaxDashboardCards {
		validMetrics = validMetrics[:MaxDashboardCards]
	}

	out := Presentation{Cards: make([]MetricCard, 0, len(validMetrics)), Rows: make([]MetricRow, 0, len(validMetrics))}
	for _, metric := range validMetrics {
		card := MetricCard{
			ID:          metric.ID,
			Label:       metric.Label,
			Value:       metric.Value,
			Unit:        metric.Unit,
			Window:      formatMetricWindow(metric.Window),
			Source:      metric.Provenance.Source,
			Methodology: methodologyLabel(metric.Methodology),
			Class:       string(metric.Class),
		}
		out.Cards = append(out.Cards, card)
		out.Rows = append(out.Rows, card)
	}

	validSeries := make([]timeseries.Series, 0, len(series))
	for _, item := range series {
		if timeseries.Validate(item) == nil {
			validSeries = append(validSeries, item)
		}
	}
	sort.Slice(validSeries, func(i, j int) bool { return validSeries[i].MetricID < validSeries[j].MetricID })
	if len(validSeries) > MaxDashboardSeries {
		validSeries = validSeries[:MaxDashboardSeries]
	}
	out.Charts = make([]SeriesChart, 0, len(validSeries))
	for _, item := range validSeries {
		polyline, observed, gaps := chartPolyline(item.Points)
		out.Charts = append(out.Charts, SeriesChart{
			MetricID:    item.MetricID,
			Unit:        item.Unit,
			Window:      item.Start.UTC().Format(time.RFC3339) + " – " + item.End.UTC().Format(time.RFC3339),
			Source:      string(architecture.SourceIndexer),
			Methodology: methodologyLabel(item.Methodology),
			Polyline:    polyline,
			Observed:    observed,
			Gaps:        gaps,
		})
	}
	return out
}

func methodologyLabel(method model.Methodology) string {
	return strings.TrimSpace(method.ID) + "@" + strings.TrimSpace(method.Version)
}

func formatMetricWindow(window model.Window) string {
	switch window.Kind {
	case model.WindowPoint:
		return "point-in-time"
	case model.WindowBlock:
		return fmt.Sprintf("blocks %d–%d", window.StartHeight, window.EndHeight)
	case model.WindowTime:
		if window.StartTime == nil || window.EndTime == nil {
			return "invalid"
		}
		return window.StartTime.UTC().Format(time.RFC3339) + " – " + window.EndTime.UTC().Format(time.RFC3339)
	default:
		return "unknown"
	}
}

func chartPolyline(points []timeseries.Point) (string, int, int) {
	values := make([]float64, len(points))
	present := make([]bool, len(points))
	minValue, maxValue := math.Inf(1), math.Inf(-1)
	observed, gaps := 0, 0
	for i, point := range points {
		if point.Gap {
			gaps++
			continue
		}
		value, err := strconv.ParseFloat(point.Value, 64)
		if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
			gaps++
			continue
		}
		values[i], present[i] = value, true
		observed++
		if value < minValue { minValue = value }
		if value > maxValue { maxValue = value }
	}
	if observed == 0 {
		return "", observed, gaps
	}
	span := maxValue - minValue
	if span == 0 { span = 1 }
	denominator := len(points) - 1
	if denominator < 1 { denominator = 1 }
	coords := make([]string, 0, observed)
	for i := range points {
		if !present[i] { continue }
		x := float64(i) * 100 / float64(denominator)
		y := 100 - ((values[i]-minValue)*100/span)
		coords = append(coords, fmt.Sprintf("%.2f,%.2f", x, y))
	}
	return strings.Join(coords, " "), observed, gaps
}
