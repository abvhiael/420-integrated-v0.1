package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerServesExplorerShell(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	body := rr.Body.String()
	if !strings.Contains(body, "420Explorer") || !strings.Contains(body, "global-search") {
		t.Fatalf("unexpected shell body: %s", body)
	}
	if got := rr.Header().Get("Content-Security-Policy"); !strings.Contains(got, "connect-src 'self'") {
		t.Fatalf("missing CSP: %q", got)
	}
	if got := rr.Header().Get("X-Content-Type-Options"); got != "nosniff" { t.Fatalf("nosniff=%q", got) }
}

func TestHandlerServesStaticAssets(t *testing.T) {
	for _, path := range []string{"/app.css", "/app.js"} {
		rr := httptest.NewRecorder()
		Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusOK { t.Fatalf("%s status=%d", path, rr.Code) }
		if rr.Body.Len() == 0 { t.Fatalf("%s empty body", path) }
	}
}

func TestHandlerRejectsMutationMethods(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/", strings.NewReader("x")))
	if rr.Code != http.StatusMethodNotAllowed { t.Fatalf("status=%d", rr.Code) }
}
