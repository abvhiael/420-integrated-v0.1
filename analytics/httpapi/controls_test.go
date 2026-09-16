package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/predictive"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

type denyLimiter struct{ retry time.Duration }
func (d denyLimiter) Allow(*http.Request) (bool, time.Duration) { return false, d.retry }

type hugeCatalog struct{}
func (hugeCatalog) Metrics() []model.Metric { return make([]model.Metric, MaxCatalogItems+1) }
func (hugeCatalog) Snapshots() []model.Snapshot { return nil }
func (hugeCatalog) Series() []timeseries.Series { return nil }
func (hugeCatalog) Forecasts() []predictive.Forecast { return nil }
func (hugeCatalog) Anomalies() []predictive.AnomalySet { return nil }
func (hugeCatalog) Ready() bool { return true }
func (hugeCatalog) Status() Status { return Status{ChainID: 420} }

func TestRateLimitHookFailsClosed(t *testing.T) {
	s, err := NewWithRateLimiter(fakeCatalog{ready: true}, denyLimiter{retry: 1500 * time.Millisecond})
	if err != nil { t.Fatal(err) }
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/metrics", nil))
	if rr.Code != http.StatusTooManyRequests { t.Fatalf("status=%d", rr.Code) }
	if rr.Header().Get("Retry-After") != "2" { t.Fatalf("retry-after=%q", rr.Header().Get("Retry-After")) }
}

func TestQueryShapeFailsClosed(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	paths := []string{
		"/v1/metrics?unknown=1",
		"/v1/metrics?limit=1&limit=2",
		"/v1/metrics?metricId=" + strings.Repeat("x", MaxMetricIDBytes+1),
		"/v1/metrics?metricId=" + strings.Repeat("x", MaxQueryValueBytes+1),
	}
	for _, path := range paths {
		rr := httptest.NewRecorder()
		s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusBadRequest { t.Fatalf("%s status=%d", path, rr.Code) }
	}
}

func TestEncodedQuerySizeBound(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	path := "/v1/metrics?metricId=" + strings.Repeat("x", MaxQueryBytes+1)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
	if rr.Code != http.StatusBadRequest { t.Fatalf("status=%d", rr.Code) }
}

func TestCatalogScanBound(t *testing.T) {
	s, _ := New(hugeCatalog{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/metrics?limit=1", nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d", rr.Code) }
}

func TestResponseByteBound(t *testing.T) {
	rr := httptest.NewRecorder()
	writeJSON(rr, http.StatusOK, map[string]string{"data": strings.Repeat("x", MaxResponseBytes)})
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d", rr.Code) }
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil { t.Fatalf("invalid JSON: %v", err) }
	if body["error"] != "analytics response exceeds maximum size" { t.Fatalf("unexpected body: %#v", body) }
}

func TestResourceGuardInstallsDeadline(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	guarded := s.resourceGuard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		deadline, ok := r.Context().Deadline()
		if !ok { t.Fatal("request deadline missing") }
		remaining := time.Until(deadline)
		if remaining <= 0 || remaining > MaxRequestDuration { t.Fatalf("remaining=%s", remaining) }
		w.WriteHeader(http.StatusNoContent)
	}))
	rr := httptest.NewRecorder()
	guarded.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusNoContent { t.Fatalf("status=%d", rr.Code) }
}

func TestCapabilitiesAdvertiseResourcePolicy(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d", rr.Code) }
	var body map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil { t.Fatal(err) }
	if body["rateLimitHook"] != true { t.Fatalf("missing rate-limit capability: %#v", body) }
	if int(body["maxResponseBytes"].(float64)) != MaxResponseBytes { t.Fatalf("missing response bound: %#v", body) }
}
