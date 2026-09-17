package web

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerServesGenesisNotificationCentreWithSecurityHeaders(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("status %d", w.Code) }
	body, _ := io.ReadAll(w.Result().Body)
	text := string(body)
	for _, want := range []string{"420Notifications", "unread-badge", "preferences-form", "420Wallet", "finalized", "retracted", "superseded"} {
		if !strings.Contains(text, want) { t.Fatalf("missing %q", want) }
	}
	if got := w.Header().Get("Content-Security-Policy"); !strings.Contains(got, "frame-ancestors 'none'") || !strings.Contains(got, "object-src 'none'") { t.Fatalf("weak CSP: %q", got) }
	if got := w.Header().Get("Permissions-Policy"); got == "" { t.Fatal("missing permissions policy") }
}

func TestHandlerRejectsMutationMethods(t *testing.T) {
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("x"))
	w := httptest.NewRecorder()
	Handler().ServeHTTP(w, r)
	if w.Code != http.StatusMethodNotAllowed { t.Fatalf("status %d", w.Code) }
}

func TestFrontendAssetsExposeGenesisNotificationFlows(t *testing.T) {
	for _, path := range []string{"/app.js", "/app.css"} {
		r := httptest.NewRequest(http.MethodGet, path, nil)
		w := httptest.NewRecorder()
		Handler().ServeHTTP(w, r)
		if w.Code != http.StatusOK { t.Fatalf("%s status %d", path, w.Code) }
		if w.Body.Len() == 0 { t.Fatalf("%s empty", path) }
	}
	r := httptest.NewRequest(http.MethodGet, "/app.js", nil)
	w := httptest.NewRecorder()
	Handler().ServeHTTP(w, r)
	js := w.Body.String()
	for _, want := range []string{"/v1/notifications", "/read", "/v1/notification-preferences", "view provenance", "open in 420Wallet", "canonical protocol state remains available", "finalized", "retracted", "superseded"} {
		if !strings.Contains(js, want) { t.Fatalf("frontend missing %q", want) }
	}
	if strings.Contains(js, "CanSign") || strings.Contains(js, "CanSpend") || strings.Contains(js, "CanGrant") || strings.Contains(js, "CanBypass") {
		t.Fatal("frontend must not expose execution authority")
	}
}
