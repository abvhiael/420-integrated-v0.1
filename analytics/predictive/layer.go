package predictive

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

const (
	ForecastSchemaVersion = "420-analytics-forecast-v1"
	AnomalySchemaVersion  = "420-analytics-anomaly-v1"
	MaxForecastPoints     = 10000
	MaxAnomalies          = 10000
)

type ModelDescriptor struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Description string `json:"description"`
}

type ForecastPoint struct {
	At       time.Time `json:"at"`
	Value    string    `json:"value"`
	Lower    string    `json:"lower,omitempty"`
	Upper    string    `json:"upper,omitempty"`
	Confidence string  `json:"confidence,omitempty"`
}

type Forecast struct {
	SchemaVersion string            `json:"schemaVersion"`
	ID            string            `json:"id"`
	SourceSeriesID string           `json:"sourceSeriesId"`
	SnapshotKey   string            `json:"snapshotKey"`
	MetricID      string            `json:"metricId"`
	Unit          string            `json:"unit"`
	ChainID       uint64            `json:"chainId"`
	Model         ModelDescriptor   `json:"model"`
	GeneratedAt   time.Time         `json:"generatedAt"`
	HorizonSeconds int64            `json:"horizonSeconds"`
	Points        []ForecastPoint   `json:"points"`
	Canonical     bool              `json:"canonical"`
	Rebuildable   bool              `json:"rebuildable"`
	Predictive    bool              `json:"predictive"`
}

type Anomaly struct {
	At         time.Time `json:"at"`
	Observed   string    `json:"observed"`
	Score      string    `json:"score"`
	Severity   string    `json:"severity"`
	SnapshotID string    `json:"snapshotId"`
}

type AnomalySet struct {
	SchemaVersion string          `json:"schemaVersion"`
	ID            string          `json:"id"`
	SourceSeriesID string         `json:"sourceSeriesId"`
	SnapshotKey   string          `json:"snapshotKey"`
	MetricID      string          `json:"metricId"`
	Unit          string          `json:"unit"`
	ChainID       uint64          `json:"chainId"`
	Model         ModelDescriptor `json:"model"`
	GeneratedAt   time.Time       `json:"generatedAt"`
	Anomalies     []Anomaly       `json:"anomalies"`
	Canonical     bool            `json:"canonical"`
	Rebuildable   bool            `json:"rebuildable"`
	Predictive    bool            `json:"predictive"`
}

func BuildForecast(series timeseries.Series, modelDesc ModelDescriptor, generatedAt time.Time, horizon time.Duration, points []ForecastPoint) (Forecast, error) {
	if err := timeseries.Validate(series); err != nil {
		return Forecast{}, fmt.Errorf("source series: %w", err)
	}
	modelDesc = normalizeModel(modelDesc)
	if err := validateModel(modelDesc); err != nil {
		return Forecast{}, err
	}
	generatedAt = generatedAt.UTC()
	if generatedAt.IsZero() {
		return Forecast{}, errors.New("forecast generated time required")
	}
	if horizon <= 0 || horizon%time.Second != 0 {
		return Forecast{}, errors.New("forecast horizon must be a positive whole-second duration")
	}
	if len(points) == 0 || len(points) > MaxForecastPoints {
		return Forecast{}, fmt.Errorf("forecast point count must be between 1 and %d", MaxForecastPoints)
	}
	last := series.End
	out := make([]ForecastPoint, len(points))
	for i, p := range points {
		p.At = p.At.UTC()
		if p.At.IsZero() || !p.At.After(last) || p.At.After(series.End.Add(horizon)) {
			return Forecast{}, fmt.Errorf("forecast point %d is outside the predictive horizon or not strictly ordered", i)
		}
		if err := validateFinite("forecast value", p.Value); err != nil {
			return Forecast{}, fmt.Errorf("point %d: %w", i, err)
		}
		if p.Lower != "" || p.Upper != "" {
			if p.Lower == "" || p.Upper == "" {
				return Forecast{}, fmt.Errorf("point %d forecast interval requires lower and upper bounds", i)
			}
			lo, err := parseFinite(p.Lower)
			if err != nil {
				return Forecast{}, fmt.Errorf("point %d lower bound invalid", i)
			}
			hi, err := parseFinite(p.Upper)
			if err != nil || lo > hi {
				return Forecast{}, fmt.Errorf("point %d forecast interval invalid", i)
			}
			v, _ := parseFinite(p.Value)
			if v < lo || v > hi {
				return Forecast{}, fmt.Errorf("point %d forecast value falls outside interval", i)
			}
		}
		if p.Confidence != "" {
			c, err := parseFinite(p.Confidence)
			if err != nil || c < 0 || c > 1 {
				return Forecast{}, fmt.Errorf("point %d confidence must be between 0 and 1", i)
			}
		}
		out[i] = p
		last = p.At
	}
	f := Forecast{
		SchemaVersion: ForecastSchemaVersion,
		SourceSeriesID: series.ID,
		SnapshotKey: series.SnapshotKey,
		MetricID: series.MetricID,
		Unit: series.Unit,
		ChainID: series.ChainID,
		Model: modelDesc,
		GeneratedAt: generatedAt,
		HorizonSeconds: int64(horizon/time.Second),
		Points: out,
		Canonical: false,
		Rebuildable: true,
		Predictive: true,
	}
	f.ID = forecastID(f)
	return f, ValidateForecast(f)
}

func BuildAnomalies(series timeseries.Series, modelDesc ModelDescriptor, generatedAt time.Time, anomalies []Anomaly) (AnomalySet, error) {
	if err := timeseries.Validate(series); err != nil {
		return AnomalySet{}, fmt.Errorf("source series: %w", err)
	}
	modelDesc = normalizeModel(modelDesc)
	if err := validateModel(modelDesc); err != nil {
		return AnomalySet{}, err
	}
	generatedAt = generatedAt.UTC()
	if generatedAt.IsZero() {
		return AnomalySet{}, errors.New("anomaly generated time required")
	}
	if len(anomalies) > MaxAnomalies {
		return AnomalySet{}, fmt.Errorf("anomaly count exceeds %d", MaxAnomalies)
	}
	out := make([]Anomaly, len(anomalies))
	var last time.Time
	for i, a := range anomalies {
		a.At = a.At.UTC()
		if a.At.IsZero() || a.At.Before(series.Start) || !a.At.Before(series.End) || (!last.IsZero() && !a.At.After(last)) {
			return AnomalySet{}, fmt.Errorf("anomaly %d timestamp is outside source series or not strictly ordered", i)
		}
		if err := validateFinite("anomaly observed value", a.Observed); err != nil {
			return AnomalySet{}, fmt.Errorf("anomaly %d: %w", i, err)
		}
		score, err := parseFinite(a.Score)
		if err != nil || score < 0 {
			return AnomalySet{}, fmt.Errorf("anomaly %d score must be finite and non-negative", i)
		}
		if strings.TrimSpace(a.Severity) == "" || strings.TrimSpace(a.SnapshotID) == "" {
			return AnomalySet{}, fmt.Errorf("anomaly %d requires severity and source snapshot id", i)
		}
		if !seriesContainsObservation(series, a.At, a.SnapshotID, a.Observed) {
			return AnomalySet{}, fmt.Errorf("anomaly %d does not bind to an observed source-series point", i)
		}
		a.Severity = strings.ToLower(strings.TrimSpace(a.Severity))
		out[i] = a
		last = a.At
	}
	s := AnomalySet{
		SchemaVersion: AnomalySchemaVersion,
		SourceSeriesID: series.ID,
		SnapshotKey: series.SnapshotKey,
		MetricID: series.MetricID,
		Unit: series.Unit,
		ChainID: series.ChainID,
		Model: modelDesc,
		GeneratedAt: generatedAt,
		Anomalies: out,
		Canonical: false,
		Rebuildable: true,
		Predictive: true,
	}
	s.ID = anomalyID(s)
	return s, ValidateAnomalies(s)
}

func ValidateForecast(f Forecast) error {
	if f.SchemaVersion != ForecastSchemaVersion || f.ID == "" || f.SourceSeriesID == "" || f.SnapshotKey == "" || f.MetricID == "" || f.Unit == "" || f.ChainID == 0 {
		return errors.New("forecast identity is incomplete")
	}
	if f.Canonical || !f.Rebuildable || !f.Predictive || f.HorizonSeconds <= 0 || f.GeneratedAt.IsZero() || len(f.Points) == 0 {
		return errors.New("forecast must be predictive, non-canonical and rebuildable")
	}
	if err := validateModel(f.Model); err != nil {
		return err
	}
	if f.ID != forecastID(f) {
		return errors.New("forecast identity mismatch")
	}
	return nil
}

func ValidateAnomalies(s AnomalySet) error {
	if s.SchemaVersion != AnomalySchemaVersion || s.ID == "" || s.SourceSeriesID == "" || s.SnapshotKey == "" || s.MetricID == "" || s.Unit == "" || s.ChainID == 0 {
		return errors.New("anomaly set identity is incomplete")
	}
	if s.Canonical || !s.Rebuildable || !s.Predictive || s.GeneratedAt.IsZero() {
		return errors.New("anomaly set must be predictive, non-canonical and rebuildable")
	}
	if err := validateModel(s.Model); err != nil {
		return err
	}
	if s.ID != anomalyID(s) {
		return errors.New("anomaly set identity mismatch")
	}
	return nil
}

func SeriesClassAllowed(class architecture.MetricClass) bool {
	return class != architecture.MetricForecast && class != architecture.MetricAnomaly
}

func ProvenanceForObservedMetric(metric model.Metric) error {
	if metric.Class == architecture.MetricForecast || metric.Class == architecture.MetricAnomaly {
		return errors.New("predictive outputs cannot be reused as observed metric provenance")
	}
	return model.ValidateMetric(metric)
}

func normalizeModel(m ModelDescriptor) ModelDescriptor {
	m.ID = strings.TrimSpace(m.ID)
	m.Version = strings.TrimSpace(m.Version)
	m.Description = strings.TrimSpace(m.Description)
	return m
}

func validateModel(m ModelDescriptor) error {
	if m.ID == "" || m.Version == "" || m.Description == "" {
		return errors.New("predictive model id, version and description are required")
	}
	return nil
}

func validateFinite(label, value string) error {
	if _, err := parseFinite(value); err != nil {
		return fmt.Errorf("%s must be finite numeric text", label)
	}
	return nil
}

func parseFinite(value string) (float64, error) {
	v, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
		return 0, errors.New("not finite")
	}
	return v, nil
}

func seriesContainsObservation(series timeseries.Series, at time.Time, snapshotID, observed string) bool {
	for _, p := range series.Points {
		if p.Gap {
			continue
		}
		if p.GeneratedAt.Equal(at) && p.SnapshotID == snapshotID && p.Value == observed {
			return true
		}
	}
	return false
}

func forecastID(f Forecast) string {
	parts := []string{ForecastSchemaVersion, f.SourceSeriesID, f.SnapshotKey, f.MetricID, f.Unit, strconv.FormatUint(f.ChainID, 10), f.Model.ID, f.Model.Version, f.Model.Description, f.GeneratedAt.UTC().Format(time.RFC3339Nano), strconv.FormatInt(f.HorizonSeconds, 10)}
	for _, p := range f.Points {
		parts = append(parts, p.At.UTC().Format(time.RFC3339Nano), p.Value, p.Lower, p.Upper, p.Confidence)
	}
	return hash("forecast_", strings.Join(parts, "\n"))
}

func anomalyID(s AnomalySet) string {
	parts := []string{AnomalySchemaVersion, s.SourceSeriesID, s.SnapshotKey, s.MetricID, s.Unit, strconv.FormatUint(s.ChainID, 10), s.Model.ID, s.Model.Version, s.Model.Description, s.GeneratedAt.UTC().Format(time.RFC3339Nano)}
	for _, a := range s.Anomalies {
		parts = append(parts, a.At.UTC().Format(time.RFC3339Nano), a.Observed, a.Score, a.Severity, a.SnapshotID)
	}
	return hash("anomaly_", strings.Join(parts, "\n"))
}

func hash(prefix, value string) string {
	sum := sha256.Sum256([]byte(value))
	return prefix + hex.EncodeToString(sum[:])
}
