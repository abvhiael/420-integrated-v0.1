package dashboard

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestShellRendersNetworkOverviewNavigationFiltersAndMethodologyAccess(t *testing.T) {
	s, err := New(func() StatusView {
		return StatusView{ChainID: 420, IndexedHeight: 120, SafeHeight: 110, IndexedAt: time.Date(2026, 9, 15, 20, 0, 0, 0, time.UTC)}
	})
	if err != nil { t.Fatal(err) }

	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, Route, nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d", rr.Code) }
	body, _ := io.ReadAll(rr.Result().Body)
	text := string(body)
	for _, want := range []string{
		"Network overview",
		"Validators",
		"Protocols",
		"Economics",
		"Predictive",
		"name=\"window\"",
		"name=\"metricId\"",
		"/v1/methodologies",
		"non-canonical analytics",
		">420<",
		">120<",
		">110<",
		">10<",
	} {
		if !strings.Contains(text, want) { t.Fatalf("dashboard missing %q", want) }
	}
	if got := rr.Header().Get("Cache-Control"); got != "no-store" { t.Fatalf("cache-control=%q", got) }
	if got := rr.Header().Get("Content-Type"); !strings.Contains(got, "text/html") { t.Fatalf("content-type=%q", got) }
}

func TestShellMarksStaleStatusExplicitly(t *testing.T) {
	s, _ := New(func() StatusView { return StatusView{Stale: true} })
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, Route, nil))
	if !strings.Contains(rr.Body.String(), ">stale<") { t.Fatal("stale status not visible") }
	if !strings.Contains(rr.Body.String(), "unavailable") { t.Fatal("missing status should be explicit") }
}

func TestShellHasBoundedWindowPresets(t *testing.T) {
	s, _ := New(nil)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, Route, nil))
	body := rr.Body.String()
	for _, window := range []string{"1h", "24h", "7d", "30d", "90d"} {
		if !strings.Contains(body, "value=\""+window+"\"") { t.Fatalf("missing preset %s", window) }
	}
	if strings.Contains(body, "365d") { t.Fatal("dashboard should not offer unbounded/default year-scale preset") }
}
