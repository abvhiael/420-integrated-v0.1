package timeseries

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
)

const (
	SeriesSchemaVersion = "420-analytics-series-v1"
	GapPolicyExplicit   = "explicit"
	MaxPageSize         = 500
)

type Point struct {
	BucketStart time.Time `json:"bucketStart"`
	BucketEnd   time.Time `json:"bucketEnd"`
	SnapshotID  string    `json:"snapshotId,omitempty"`
	GeneratedAt time.Time `json:"generatedAt,omitempty"`
	Value       string    `json:"value,omitempty"`
	Gap         bool      `json:"gap"`
}

type Series struct {
	SchemaVersion string            `json:"schemaVersion"`
	ID            string            `json:"id"`
	SnapshotKey   string            `json:"snapshotKey"`
	MetricID      string            `json:"metricId"`
	Unit          string            `json:"unit"`
	Methodology   model.Methodology `json:"methodology"`
	ChainID       uint64            `json:"chainId"`
	Start         time.Time         `json:"start"`
	End           time.Time         `json:"end"`
	BucketSeconds int64             `json:"bucketSeconds"`
	GapPolicy     string            `json:"gapPolicy"`
	Points        []Point           `json:"points"`
	Canonical     bool              `json:"canonical"`
	Rebuildable   bool              `json:"rebuildable"`
}

type Page struct {
	SnapshotKey string  `json:"snapshotKey"`
	Points      []Point `json:"points"`
	NextCursor  string  `json:"nextCursor,omitempty"`
}

type observation struct {
	snapshot model.Snapshot
	metric   model.Metric
}

func Build(metricID string, start, end time.Time, bucket time.Duration, snapshots []model.Snapshot) (Series, error) {
	metricID = strings.TrimSpace(metricID)
	start = start.UTC()
	end = end.UTC()
	if metricID == "" {
		return Series{}, errors.New("time series metric id required")
	}
	registered, err := methodology.Resolve(metricID)
	if err != nil {
		return Series{}, err
	}
	if start.IsZero() || end.IsZero() || !start.Before(end) {
		return Series{}, errors.New("time series requires a valid half-open time window")
	}
	if bucket <= 0 || bucket%time.Second != 0 {
		return Series{}, errors.New("time series bucket must be a positive whole-second duration")
	}
	if len(snapshots) == 0 {
		return Series{}, errors.New("time series requires analytics snapshots")
	}

	observations := make([]observation, 0, len(snapshots))
	seenSnapshots := make(map[string]struct{}, len(snapshots))
	var chainID uint64
	unit := ""

	for i, snapshot := range snapshots {
		if err := model.ValidateSnapshot(snapshot); err != nil {
			return Series{}, fmt.Errorf("snapshot %d: %w", i, err)
		}
		if _, exists := seenSnapshots[snapshot.ID]; exists {
			return Series{}, fmt.Errorf("duplicate analytics snapshot: %s", snapshot.ID)
		}
		seenSnapshots[snapshot.ID] = struct{}{}
		if snapshot.GeneratedAt.Before(start) || !snapshot.GeneratedAt.Before(end) {
			continue
		}
		if chainID == 0 {
			chainID = snapshot.Provenance.ChainID
		} else if snapshot.Provenance.ChainID != chainID {
			return Series{}, errors.New("time series snapshots span multiple chains")
		}

		var selected *model.Metric
		for j := range snapshot.Metrics {
			if snapshot.Metrics[j].ID != metricID {
				continue
			}
			if selected != nil {
				return Series{}, fmt.Errorf("snapshot %s contains duplicate metric %s", snapshot.ID, metricID)
			}
			metric := snapshot.Metrics[j]
			selected = &metric
		}
		if selected == nil {
			continue
		}
		if err := methodology.Validate(metricID, selected.Methodology); err != nil {
			return Series{}, fmt.Errorf("snapshot %s methodology: %w", snapshot.ID, err)
		}
		if selected.Methodology != registered {
			return Series{}, errors.New("time series methodology registry mismatch")
		}
		if unit == "" {
			unit = selected.Unit
		} else if selected.Unit != unit {
			return Series{}, errors.New("time series metric unit changed within snapshot set")
		}
		observations = append(observations, observation{snapshot: snapshot, metric: *selected})
	}
	if len(observations) == 0 {
		return Series{}, errors.New("time series window contains no matching metric observations")
	}

	sort.Slice(observations, func(i, j int) bool {
		if observations[i].snapshot.GeneratedAt.Equal(observations[j].snapshot.GeneratedAt) {
			return observations[i].snapshot.ID < observations[j].snapshot.ID
		}
		return observations[i].snapshot.GeneratedAt.Before(observations[j].snapshot.GeneratedAt)
	})

	bucketCount := int((end.Sub(start) + bucket - 1) / bucket)
	points := make([]Point, bucketCount)
	for i := range points {
		bucketStart := start.Add(time.Duration(i) * bucket)
		bucketEnd := bucketStart.Add(bucket)
		if bucketEnd.After(end) {
			bucketEnd = end
		}
		points[i] = Point{BucketStart: bucketStart, BucketEnd: bucketEnd, Gap: true}
	}

	for _, observation := range observations {
		index := int(observation.snapshot.GeneratedAt.Sub(start) / bucket)
		if index < 0 || index >= len(points) {
			continue
		}
		current := points[index]
		if !current.Gap && (current.GeneratedAt.After(observation.snapshot.GeneratedAt) ||
			(current.GeneratedAt.Equal(observation.snapshot.GeneratedAt) && current.SnapshotID > observation.snapshot.ID)) {
			continue
		}
		points[index].SnapshotID = observation.snapshot.ID
		points[index].GeneratedAt = observation.snapshot.GeneratedAt.UTC()
		points[index].Value = observation.metric.Value
		points[index].Gap = false
	}

	snapshotKey := buildSnapshotKey(metricID, start, end, bucket, observations)
	seriesID := hashID("series_", strings.Join([]string{
		SeriesSchemaVersion,
		metricID,
		strconv.FormatUint(chainID, 10),
		start.Format(time.RFC3339Nano),
		end.Format(time.RFC3339Nano),
		strconv.FormatInt(int64(bucket/time.Second), 10),
		snapshotKey,
	}, "|"))

	return Series{
		SchemaVersion: SeriesSchemaVersion,
		ID:            seriesID,
		SnapshotKey:   snapshotKey,
		MetricID:      metricID,
		Unit:          unit,
		Methodology:   registered,
		ChainID:       chainID,
		Start:         start,
		End:           end,
		BucketSeconds: int64(bucket / time.Second),
		GapPolicy:     GapPolicyExplicit,
		Points:        points,
		Canonical:     false,
		Rebuildable:   true,
	}, nil
}

func Paginate(series Series, cursor string, limit int) (Page, error) {
	if err := Validate(series); err != nil {
		return Page{}, err
	}
	if limit <= 0 || limit > MaxPageSize {
		return Page{}, fmt.Errorf("time series page limit must be between 1 and %d", MaxPageSize)
	}
	offset := 0
	if strings.TrimSpace(cursor) != "" {
		parsedKey, parsedOffset, err := parseCursor(cursor)
		if err != nil {
			return Page{}, err
		}
		if parsedKey != series.SnapshotKey {
			return Page{}, errors.New("time series cursor snapshot key mismatch")
		}
		offset = parsedOffset
	}
	if offset < 0 || offset > len(series.Points) {
		return Page{}, errors.New("time series cursor offset out of range")
	}
	end := offset + limit
	if end > len(series.Points) {
		end = len(series.Points)
	}
	page := Page{SnapshotKey: series.SnapshotKey, Points: append([]Point(nil), series.Points[offset:end]...)}
	if end < len(series.Points) {
		page.NextCursor = formatCursor(series.SnapshotKey, end)
	}
	return page, nil
}

func Validate(series Series) error {
	if series.SchemaVersion != SeriesSchemaVersion {
		return errors.New("unsupported analytics time series schema")
	}
	if series.Canonical || !series.Rebuildable {
		return errors.New("analytics time series must be non-canonical and rebuildable")
	}
	if strings.TrimSpace(series.ID) == "" || strings.TrimSpace(series.SnapshotKey) == "" || strings.TrimSpace(series.MetricID) == "" {
		return errors.New("analytics time series identity is incomplete")
	}
	if series.ChainID == 0 || series.Start.IsZero() || series.End.IsZero() || !series.Start.Before(series.End) || series.BucketSeconds <= 0 {
		return errors.New("analytics time series bounds are invalid")
	}
	if series.GapPolicy != GapPolicyExplicit || len(series.Points) == 0 {
		return errors.New("analytics time series requires explicit gap points")
	}
	if err := methodology.Validate(series.MetricID, series.Methodology); err != nil {
		return err
	}
	for i, point := range series.Points {
		expectedStart := series.Start.Add(time.Duration(i) * time.Duration(series.BucketSeconds) * time.Second)
		expectedEnd := expectedStart.Add(time.Duration(series.BucketSeconds) * time.Second)
		if expectedEnd.After(series.End) {
			expectedEnd = series.End
		}
		if !point.BucketStart.Equal(expectedStart) || !point.BucketEnd.Equal(expectedEnd) {
			return fmt.Errorf("time series point %d bucket mismatch", i)
		}
		if point.Gap {
			if point.SnapshotID != "" || !point.GeneratedAt.IsZero() || point.Value != "" {
				return fmt.Errorf("time series point %d invalid explicit gap", i)
			}
		} else if point.SnapshotID == "" || point.GeneratedAt.IsZero() || point.Value == "" || point.GeneratedAt.Before(point.BucketStart) || !point.GeneratedAt.Before(point.BucketEnd) {
			return fmt.Errorf("time series point %d observation invalid", i)
		}
	}
	return nil
}

func buildSnapshotKey(metricID string, start, end time.Time, bucket time.Duration, observations []observation) string {
	parts := []string{
		"420-analytics-series-snapshot-v1",
		metricID,
		start.Format(time.RFC3339Nano),
		end.Format(time.RFC3339Nano),
		strconv.FormatInt(int64(bucket/time.Second), 10),
	}
	for _, observation := range observations {
		p := observation.snapshot.Provenance
		m := observation.metric
		parts = append(parts, strings.Join([]string{
			observation.snapshot.ID,
			observation.snapshot.GeneratedAt.UTC().Format(time.RFC3339Nano),
			m.ID,
			m.Value,
			m.Unit,
			m.Methodology.ID,
			m.Methodology.Version,
			strconv.FormatUint(p.ChainID, 10),
			strconv.FormatUint(p.IndexedHeight, 10),
			p.IndexedHeadHash,
			strconv.FormatUint(p.SafeHeight, 10),
			p.IndexedAt.UTC().Format(time.RFC3339Nano),
		}, "|"))
	}
	return hashID("snap_", strings.Join(parts, "\n"))
}

func hashID(prefix, value string) string {
	sum := sha256.Sum256([]byte(value))
	return prefix + hex.EncodeToString(sum[:])
}

func formatCursor(snapshotKey string, offset int) string {
	return snapshotKey + ":" + strconv.Itoa(offset)
}

func parseCursor(cursor string) (string, int, error) {
	index := strings.LastIndex(cursor, ":")
	if index <= 0 || index == len(cursor)-1 {
		return "", 0, errors.New("invalid time series cursor")
	}
	offset, err := strconv.Atoi(cursor[index+1:])
	if err != nil || offset < 0 {
		return "", 0, errors.New("invalid time series cursor")
	}
	return cursor[:index], offset, nil
}
