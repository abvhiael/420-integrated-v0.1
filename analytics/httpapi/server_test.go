package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
	"github.com/420integrated/420-integrated/analytics/predictive"
	"github.com/420integrated/420-integrated/analytics/timeseries"
)

type fakeCatalog struct{ ready bool }
func (f fakeCatalog) Metrics() []model.Metric { return nil }
func (f fakeCatalog) Snapshots() []model.Snapshot { return nil }
func (f fakeCatalog) Series() []timeseries.Series { return nil }
func (f fakeCatalog) Forecasts() []predictive.Forecast { return nil }
func (f fakeCatalog) Anomalies() []predictive.AnomalySet { return nil }
func (f fakeCatalog) Ready() bool { return f.ready }
func (f fakeCatalog) Status() Status { return Status{ChainID: 420, IndexedHeight: 100, SafeHeight: 90, IndexedAt: time.Date(2026, 9, 15, 0, 0, 0, 0, time.UTC), Canonical: true} }

func TestHealthAndCapabilities(t *testing.T) {
	s, err := New(fakeCatalog{ready: true})
	if err != nil { t.Fatal(err) }

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/health", nil))
	if rr.Code != http.StatusOK { t.Fatalf("health status=%d", rr.Code) }
	var health map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &health); err != nil { t.Fatal(err) }
	if health["status"] != "ok" || health["apiVersion"] != APIVersion { t.Fatalf("unexpected health: %#v", health) }

	rr = httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil))
	if rr.Code != http.StatusOK { t.Fatalf("capabilities status=%d", rr.Code) }
	var caps map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &caps); err != nil { t.Fatal(err) }
	if caps["canonical"] != false || caps["rebuildable"] != true { t.Fatalf("authority flags wrong: %#v", caps) }
	if int(caps["maxLimit"].(float64)) != MaxLimit { t.Fatalf("max limit missing: %#v", caps) }
}

func TestReadinessFailsClosed(t *testing.T) {
	s, _ := New(fakeCatalog{ready: false})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/ready", nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d", rr.Code) }
}

func TestStatusCannotClaimCanonicalAuthority(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/status", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d", rr.Code) }
	var st Status
	if err := json.Unmarshal(rr.Body.Bytes(), &st); err != nil { t.Fatal(err) }
	if st.Canonical { t.Fatal("analytics status must never advertise canonical authority") }
	if st.ChainID != 420 || st.IndexedHeight != 100 || st.SafeHeight != 90 { t.Fatalf("unexpected status: %#v", st) }
}

func TestBoundedLimit(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	for _, path := range []string{"/v1/metrics?limit=0", "/v1/metrics?limit=501", "/v1/methodologies?limit=abc"} {
		rr := httptest.NewRecorder()
		s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusBadRequest { t.Fatalf("%s status=%d", path, rr.Code) }
	}
}

func TestSeriesWindowBounded(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	tooWide := "/v1/series?start=2025-01-01T00:00:00Z&end=2026-09-15T00:00:00Z"
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, tooWide, nil))
	if rr.Code != http.StatusBadRequest { t.Fatalf("too-wide status=%d", rr.Code) }

	oneSided := "/v1/series?start=2026-09-01T00:00:00Z"
	rr = httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, oneSided, nil))
	if rr.Code != http.StatusBadRequest { t.Fatalf("one-sided status=%d", rr.Code) }
}

func TestPredictiveEndpointsAreExplicit(t *testing.T) {
	s, _ := New(fakeCatalog{ready: true})
	for _, path := range []string{"/v1/forecasts", "/v1/anomalies"} {
		rr := httptest.NewRecorder()
		s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusOK { t.Fatalf("%s status=%d", path, rr.Code) }
		var body map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil { t.Fatal(err) }
		if body["predictive"] != true || body["canonical"] != false { t.Fatalf("%s trust labels missing: %#v", path, body) }
	}
}

func TestNewRejectsNilCatalog(t *testing.T) {
	if _, err := New(nil); err == nil { t.Fatal("expected nil catalog error") }
}
