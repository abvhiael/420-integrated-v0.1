package web

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerServesGenesisFrontendWithSecurityHeaders(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("status %d", w.Code) }
	body, _ := io.ReadAll(w.Result().Body)
	text := string(body)
	for _, want := range []string{"420Status", "Operational evidence only", "Components", "Active incidents", "Planned maintenance", "History & provenance"} {
		if !strings.Contains(text, want) { t.Fatalf("missing %q", want) }
	}
	csp := w.Header().Get("Content-Security-Policy")
	if !strings.Contains(csp, "frame-ancestors 'none'") || !strings.Contains(csp, "object-src 'none'") || !strings.Contains(csp, "form-action 'none'") { t.Fatalf("weak CSP: %q", csp) }
	if got := w.Header().Get("Permissions-Policy"); got == "" { t.Fatal("missing permissions policy") }
}

func TestHandlerIsReadOnly(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("x"))
	w := httptest.NewRecorder()
	Handler().ServeHTTP(w, r)
	if w.Code != http.StatusMethodNotAllowed { t.Fatalf("status %d", w.Code) }
}

func TestFrontendConsumesOnlyReadOnlyStatusFeeds(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/app.js", nil)
	w := httptest.NewRecorder()
	Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("status %d", w.Code) }
	js := w.Body.String()
	for _, want := range []string{"/v1/status", "/v1/incidents", "/v1/maintenance", "/v1/history", "canonical!==false", "freshness:", "conflicting observations"} {
		if !strings.Contains(js, want) { t.Fatalf("frontend missing %q", want) }
	}
	for _, forbidden := range []string{"method:'POST'", "method:\"POST\"", "/operator", "/admin"} {
		if strings.Contains(js, forbidden) { t.Fatalf("frontend contains mutation surface %q", forbidden) }
	}
}

func TestFrontendAssetsAreEmbedded(t *testing.T) {
	for _, path := range []string{"/app.js", "/app.css"} {
		r := httptest.NewRequest(http.MethodGet, path, nil)
		w := httptest.NewRecorder()
		Handler().ServeHTTP(w, r)
		if w.Code != http.StatusOK { t.Fatalf("%s status %d", path, w.Code) }
		if w.Body.Len() == 0 { t.Fatalf("%s empty", path) }
	}
}
