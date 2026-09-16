package model

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
	"github.com/420integrated/420-integrated/analytics/indexerclient"
	"github.com/420integrated/420-integrated/analytics/privacy"
)

const (
	MetricSchemaVersion   = "420-analytics-metric-v1"
	SnapshotSchemaVersion = "420-analytics-snapshot-v1"
)

type WindowKind string

const (
	WindowPoint WindowKind = "point"
	WindowBlock WindowKind = "block_range"
	WindowTime  WindowKind = "time_range"
)

type Methodology struct {
	ID          string `json:"id"`
	Version     string `json:"version"`
	Description string `json:"description"`
}

type Window struct {
	Kind        WindowKind `json:"kind"`
	StartHeight uint64     `json:"startHeight,omitempty"`
	EndHeight   uint64     `json:"endHeight,omitempty"`
	StartTime   *time.Time `json:"startTime,omitempty"`
	EndTime     *time.Time `json:"endTime,omitempty"`
}

type Provenance struct {
	Source          string    `json:"source"`
	ChainID         uint64    `json:"chainId"`
	IndexedHeight   uint64    `json:"indexedHeight"`
	IndexedHeadHash string    `json:"indexedHeadHash"`
	SafeHeight      uint64    `json:"safeHeight"`
	IndexedAt       time.Time `json:"indexedAt"`
}

type Metric struct {
	SchemaVersion string                   `json:"schemaVersion"`
	ID            string                   `json:"id"`
	Class         architecture.MetricClass `json:"class"`
	Label         string                   `json:"label"`
	Value         string                   `json:"value"`
	Unit          string                   `json:"unit"`
	PrivacyClass  string                   `json:"privacyClass"`
	Methodology   Methodology              `json:"methodology"`
	Window        Window                   `json:"window"`
	Provenance    Provenance               `json:"provenance"`
	Canonical     bool                     `json:"canonical"`
}

type Snapshot struct {
	SchemaVersion string     `json:"schemaVersion"`
	ID            string     `json:"id"`
	GeneratedAt   time.Time  `json:"generatedAt"`
	Provenance    Provenance `json:"provenance"`
	Metrics       []Metric   `json:"metrics"`
	Canonical     bool       `json:"canonical"`
	Rebuildable   bool       `json:"rebuildable"`
}

func ProvenanceFromIndexer(p indexerclient.SnapshotProvenance) Provenance {
	return Provenance{
		Source:          string(architecture.SourceIndexer),
		ChainID:         p.ChainID,
		IndexedHeight:   p.IndexedHeight,
		IndexedHeadHash: p.IndexedHeadHash,
		SafeHeight:      p.SafeHeight,
		IndexedAt:       p.IndexedAt.UTC(),
	}
}

func NewMetric(id string, class architecture.MetricClass, label, value, unit string, methodology Methodology, window Window, provenance Provenance) (Metric, error) {
	m := Metric{
		SchemaVersion: MetricSchemaVersion,
		ID:            strings.TrimSpace(id),
		Class:         class,
		Label:         strings.TrimSpace(label),
		Value:         strings.TrimSpace(value),
		Unit:          strings.TrimSpace(unit),
		PrivacyClass:  string(privacy.Public),
		Methodology:   methodology,
		Window:        window,
		Provenance:    provenance,
		Canonical:     false,
	}
	if err := ValidateMetric(m); err != nil {
		return Metric{}, err
	}
	return m, nil
}

func ValidateMetric(m Metric) error {
	if m.SchemaVersion != MetricSchemaVersion {
		return errors.New("unsupported analytics metric schema")
	}
	if m.Canonical {
		return errors.New("analytics metric cannot be canonical")
	}
	if m.ID == "" || m.Label == "" || m.Value == "" || m.Unit == "" {
		return errors.New("metric identity, label, value and unit are required")
	}
	if !validMetricClass(m.Class) {
		return errors.New("unsupported metric class")
	}
	if err := privacy.Admit(m.PrivacyClass); err != nil {
		return err
	}
	parsed, err := strconv.ParseFloat(m.Value, 64)
	if err != nil || math.IsNaN(parsed) || math.IsInf(parsed, 0) {
		return errors.New("metric value must be finite numeric text")
	}
	if err := validateMethodology(m.Methodology); err != nil {
		return err
	}
	if err := validateWindow(m.Window, m.Provenance); err != nil {
		return err
	}
	return validateProvenance(m.Provenance)
}

func NewSnapshot(generatedAt time.Time, provenance Provenance, metrics []Metric) (Snapshot, error) {
	generatedAt = generatedAt.UTC()
	if generatedAt.IsZero() {
		return Snapshot{}, errors.New("snapshot generated time required")
	}
	if err := validateProvenance(provenance); err != nil {
		return Snapshot{}, err
	}
	if len(metrics) == 0 {
		return Snapshot{}, errors.New("snapshot requires at least one metric")
	}
	for i, metric := range metrics {
		if err := ValidateMetric(metric); err != nil {
			return Snapshot{}, fmt.Errorf("metric %d: %w", i, err)
		}
		if metric.Provenance != provenance {
			return Snapshot{}, fmt.Errorf("metric %d provenance does not match snapshot", i)
		}
	}
	id := snapshotID(generatedAt, provenance)
	return Snapshot{
		SchemaVersion: SnapshotSchemaVersion,
		ID:            id,
		GeneratedAt:   generatedAt,
		Provenance:    provenance,
		Metrics:       append([]Metric(nil), metrics...),
		Canonical:     false,
		Rebuildable:   true,
	}, nil
}

func ValidateSnapshot(s Snapshot) error {
	if s.SchemaVersion != SnapshotSchemaVersion {
		return errors.New("unsupported analytics snapshot schema")
	}
	if s.Canonical || !s.Rebuildable {
		return errors.New("analytics snapshot must be non-canonical and rebuildable")
	}
	if s.ID == "" || s.GeneratedAt.IsZero() {
		return errors.New("snapshot identity and generated time required")
	}
	if s.ID != snapshotID(s.GeneratedAt.UTC(), s.Provenance) {
		return errors.New("snapshot identity mismatch")
	}
	_, err := NewSnapshot(s.GeneratedAt, s.Provenance, s.Metrics)
	return err
}

func validateMethodology(m Methodology) error {
	if strings.TrimSpace(m.ID) == "" || strings.TrimSpace(m.Version) == "" || strings.TrimSpace(m.Description) == "" {
		return errors.New("metric methodology id, version and description are required")
	}
	return nil
}

func validateWindow(w Window, p Provenance) error {
	switch w.Kind {
	case WindowPoint:
		if w.StartHeight != 0 || w.EndHeight != 0 || w.StartTime != nil || w.EndTime != nil {
			return errors.New("point window cannot carry a range")
		}
	case WindowBlock:
		if w.StartHeight == 0 || w.EndHeight == 0 || w.StartHeight > w.EndHeight {
			return errors.New("invalid block window")
		}
		if w.EndHeight > p.IndexedHeight {
			return errors.New("block window exceeds indexed snapshot")
		}
		if w.StartTime != nil || w.EndTime != nil {
			return errors.New("block window cannot carry time bounds")
		}
	case WindowTime:
		if w.StartTime == nil || w.EndTime == nil || w.StartTime.IsZero() || w.EndTime.IsZero() || w.StartTime.After(*w.EndTime) {
			return errors.New("invalid time window")
		}
		if w.StartHeight != 0 || w.EndHeight != 0 {
			return errors.New("time window cannot carry block bounds")
		}
		if w.EndTime.After(p.IndexedAt) {
			return errors.New("time window exceeds indexed snapshot")
		}
	default:
		return errors.New("unsupported metric window kind")
	}
	return nil
}

func validateProvenance(p Provenance) error {
	if p.Source != string(architecture.SourceIndexer) {
		return errors.New("analytics provenance must originate from qualified 420Indexer")
	}
	if p.ChainID == 0 || p.IndexedHeight == 0 || strings.TrimSpace(p.IndexedHeadHash) == "" || p.IndexedAt.IsZero() {
		return errors.New("analytics provenance is incomplete")
	}
	if p.SafeHeight > p.IndexedHeight {
		return errors.New("safe height exceeds indexed height")
	}
	return nil
}

func validMetricClass(class architecture.MetricClass) bool {
	for _, allowed := range architecture.GenesisProfile().MetricClasses {
		if class == allowed {
			return true
		}
	}
	return false
}

func snapshotID(generatedAt time.Time, p Provenance) string {
	seed := fmt.Sprintf("%s|%d|%d|%s|%d|%d", SnapshotSchemaVersion, p.ChainID, p.IndexedHeight, p.IndexedHeadHash, p.SafeHeight, generatedAt.UTC().UnixNano())
	sum := sha256.Sum256([]byte(seed))
	return "anl_" + hex.EncodeToString(sum[:])
}
