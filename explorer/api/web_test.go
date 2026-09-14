package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestServerServesExplorerShellAtRoot(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	if !strings.Contains(rr.Body.String(), "420Explorer") { t.Fatalf("unexpected body: %s", rr.Body.String()) }
}

func TestAPIRoutesTakePrecedenceOverWebFallback(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks/not-a-number", nil))
	if rr.Code != http.StatusBadRequest { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	if strings.Contains(rr.Body.String(), "<!doctype html>") { t.Fatal("API error was incorrectly served by web shell") }
}
