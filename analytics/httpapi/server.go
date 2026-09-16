package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/analytics/methodology"
	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/predictive"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

const (
	APIVersion     = "v1"
	DefaultLimit   = 100
	MaxLimit       = 500
	MaxWindowHours = 24 * 365
)

type Catalog interface {
	Metrics() []model.Metric
	Snapshots() []model.Snapshot
	Series() []timeseries.Series
	Forecasts() []predictive.Forecast
	Anomalies() []predictive.AnomalySet
	Ready() bool
	Status() Status
}

type Status struct {
	ChainID       uint64    `json:"chainId"`
	IndexedHeight uint64    `json:"indexedHeight"`
	SafeHeight    uint64    `json:"safeHeight"`
	IndexedAt     time.Time `json:"indexedAt"`
	Stale         bool      `json:"stale"`
	Canonical     bool      `json:"canonical"`
}

type Server struct {
	catalog Catalog
	limiter RateLimiter
}

func New(catalog Catalog) (*Server, error) {
	return NewWithRateLimiter(catalog, nil)
}

func NewWithRateLimiter(catalog Catalog, limiter RateLimiter) (*Server, error) {
	if catalog == nil {
		return nil, errors.New("analytics HTTP API catalog required")
	}
	if limiter == nil {
		limiter = allowAllLimiter{}
	}
	return &Server{catalog: catalog, limiter: limiter}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /ready", s.ready)
	mux.HandleFunc("GET /v1/status", s.status)
	mux.HandleFunc("GET /v1/capabilities", s.capabilities)
	mux.HandleFunc("GET /v1/methodologies", s.methodologies)
	mux.HandleFunc("GET /v1/metrics", s.metrics)
	mux.HandleFunc("GET /v1/snapshots", s.snapshots)
	mux.HandleFunc("GET /v1/series", s.series)
	mux.HandleFunc("GET /v1/forecasts", s.forecasts)
	mux.HandleFunc("GET /v1/anomalies", s.anomalies)
	return s.resourceGuard(mux)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok", "apiVersion": APIVersion, "service": "420Analytics"})
}

func (s *Server) ready(w http.ResponseWriter, _ *http.Request) {
	if !s.catalog.Ready() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ready": false, "apiVersion": APIVersion})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ready": true, "apiVersion": APIVersion})
}

func (s *Server) status(w http.ResponseWriter, _ *http.Request) {
	st := s.catalog.Status()
	st.Canonical = false
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) capabilities(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"apiVersion": APIVersion,
		"canonical": false,
		"rebuildable": true,
		"resources": []string{"metrics", "snapshots", "series", "methodologies", "forecasts", "anomalies"},
		"maxLimit": MaxLimit,
		"maxWindowHours": MaxWindowHours,
		"maxQueryBytes": MaxQueryBytes,
		"maxCatalogItems": MaxCatalogItems,
		"maxResponseBytes": MaxResponseBytes,
		"requestTimeoutMs": MaxRequestDuration.Milliseconds(),
		"rateLimitHook": true,
	})
}

func (s *Server) methodologies(w http.ResponseWriter, r *http.Request) {
	if err := validateQuery(r, "limit"); err != nil { badRequest(w, err); return }
	limit, err := boundedLimit(r)
	if err != nil { badRequest(w, err); return }
	entries := methodology.Entries()
	if err := ensureCatalogBound(len(entries)); err != nil { resourceUnavailable(w, err); return }
	if len(entries) > limit { entries = entries[:limit] }
	writeJSON(w, http.StatusOK, map[string]any{"items": entries, "count": len(entries)})
}

func (s *Server) metrics(w http.ResponseWriter, r *http.Request) {
	if err := validateQuery(r, "limit", "metricId"); err != nil { badRequest(w, err); return }
	limit, err := boundedLimit(r)
	if err != nil { badRequest(w, err); return }
	metricID, err := boundedMetricID(r)
	if err != nil { badRequest(w, err); return }
	items := append([]model.Metric(nil), s.catalog.Metrics()...)
	if err := ensureCatalogBound(len(items)); err != nil { resourceUnavailable(w, err); return }
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	out := make([]model.Metric, 0, min(limit, len(items)))
	for _, item := range items {
		if metricID != "" && item.ID != metricID { continue }
		if err := model.ValidateMetric(item); err != nil { continue }
		out = append(out, item)
		if len(out) == limit { break }
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "count": len(out)})
}

func (s *Server) snapshots(w http.ResponseWriter, r *http.Request) {
	if err := validateQuery(r, "limit"); err != nil { badRequest(w, err); return }
	limit, err := boundedLimit(r)
	if err != nil { badRequest(w, err); return }
	items := append([]model.Snapshot(nil), s.catalog.Snapshots()...)
	if err := ensureCatalogBound(len(items)); err != nil { resourceUnavailable(w, err); return }
	sort.Slice(items, func(i, j int) bool {
		if items[i].GeneratedAt.Equal(items[j].GeneratedAt) { return items[i].ID < items[j].ID }
		return items[i].GeneratedAt.After(items[j].GeneratedAt)
	})
	out := make([]model.Snapshot, 0, min(limit, len(items)))
	for _, item := range items {
		if err := model.ValidateSnapshot(item); err != nil { continue }
		out = append(out, item)
		if len(out) == limit { break }
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "count": len(out)})
}

func (s *Server) series(w http.ResponseWriter, r *http.Request) {
	if err := validateQuery(r, "limit", "metricId", "start", "end"); err != nil { badRequest(w, err); return }
	limit, err := boundedLimit(r)
	if err != nil { badRequest(w, err); return }
	metricID, err := boundedMetricID(r)
	if err != nil { badRequest(w, err); return }
	start, end, err := boundedWindow(r)
	if err != nil { badRequest(w, err); return }
	items := append([]timeseries.Series(nil), s.catalog.Series()...)
	if err := ensureCatalogBound(len(items)); err != nil { resourceUnavailable(w, err); return }
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	out := make([]timeseries.Series, 0, min(limit, len(items)))
	for _, item := range items {
		if metricID != "" && item.MetricID != metricID { continue }
		if !start.IsZero() && item.End.Before(start) { continue }
		if !end.IsZero() && item.Start.After(end) { continue }
		if err := timeseries.Validate(item); err != nil { continue }
		out = append(out, item)
		if len(out) == limit { break }
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "count": len(out)})
}

func (s *Server) forecasts(w http.ResponseWriter, r *http.Request) {
	if err := validateQuery(r, "limit", "metricId"); err != nil { badRequest(w, err); return }
	limit, err := boundedLimit(r)
	if err != nil { badRequest(w, err); return }
	metricID, err := boundedMetricID(r)
	if err != nil { badRequest(w, err); return }
	items := append([]predictive.Forecast(nil), s.catalog.Forecasts()...)
	if err := ensureCatalogBound(len(items)); err != nil { resourceUnavailable(w, err); return }
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	out := make([]predictive.Forecast, 0, min(limit, len(items)))
	for _, item := range items {
		if metricID != "" && item.MetricID != metricID { continue }
		if err := predictive.ValidateForecast(item); err != nil { continue }
		out = append(out, item)
		if len(out) == limit { break }
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "count": len(out), "predictive": true, "canonical": false})
}

func (s *Server) anomalies(w http.ResponseWriter, r *http.Request) {
	if err := validateQuery(r, "limit", "metricId"); err != nil { badRequest(w, err); return }
	limit, err := boundedLimit(r)
	if err != nil { badRequest(w, err); return }
	metricID, err := boundedMetricID(r)
	if err != nil { badRequest(w, err); return }
	items := append([]predictive.AnomalySet(nil), s.catalog.Anomalies()...)
	if err := ensureCatalogBound(len(items)); err != nil { resourceUnavailable(w, err); return }
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	out := make([]predictive.AnomalySet, 0, min(limit, len(items)))
	for _, item := range items {
		if metricID != "" && item.MetricID != metricID { continue }
		if err := predictive.ValidateAnomalies(item); err != nil { continue }
		out = append(out, item)
		if len(out) == limit { break }
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "count": len(out), "predictive": true, "canonical": false})
}

func boundedLimit(r *http.Request) (int, error) {
	raw := strings.TrimSpace(r.URL.Query().Get("limit"))
	if raw == "" { return DefaultLimit, nil }
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > MaxLimit { return 0, errors.New("limit must be between 1 and 500") }
	return limit, nil
}

func boundedWindow(r *http.Request) (time.Time, time.Time, error) {
	parse := func(key string) (time.Time, error) {
		raw := strings.TrimSpace(r.URL.Query().Get(key))
		if raw == "" { return time.Time{}, nil }
		t, err := time.Parse(time.RFC3339, raw)
		if err != nil { return time.Time{}, errors.New(key + " must be RFC3339") }
		return t.UTC(), nil
	}
	start, err := parse("start"); if err != nil { return time.Time{}, time.Time{}, err }
	end, err := parse("end"); if err != nil { return time.Time{}, time.Time{}, err }
	if start.IsZero() != end.IsZero() { return time.Time{}, time.Time{}, errors.New("start and end must be provided together") }
	if !start.IsZero() {
		if !start.Before(end) { return time.Time{}, time.Time{}, errors.New("start must be before end") }
		if end.Sub(start) > MaxWindowHours*time.Hour { return time.Time{}, time.Time{}, errors.New("requested window exceeds maximum") }
	}
	return start, end, nil
}

func badRequest(w http.ResponseWriter, err error) { writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()}) }
func resourceUnavailable(w http.ResponseWriter, err error) { writeJSON(w, http.StatusServiceUnavailable, map[string]any{"error": err.Error()}) }

func writeJSON(w http.ResponseWriter, status int, value any) {
	payload, err := json.Marshal(value)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error":"analytics response encoding failed"}`))
		return
	}
	if len(payload) > MaxResponseBytes {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(`{"error":"analytics response exceeds maximum size"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(append(payload, '\n'))
}
