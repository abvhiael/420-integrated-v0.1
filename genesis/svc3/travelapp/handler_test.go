package travelapp

import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
)

func TestTravelShell(t *testing.T) {
    request := httptest.NewRequest(http.MethodGet, "/travel", nil)
    response := httptest.NewRecorder()
    Handler().ServeHTTP(response, request)
    if response.Code != http.StatusOK { t.Fatalf("GET /travel: status = %d", response.Code) }
    if got := response.Header().Get("Content-Type"); got != "text/html; charset=utf-8" { t.Fatalf("content type = %q", got) }
    if got := response.Header().Get("Cache-Control"); got != "no-store" { t.Fatalf("cache control = %q", got) }
    body := response.Body.String()
    for _, text := range []string{"420Travel", "Discovery is not connected yet", "420BnB booking and DOOBR transactions are unavailable", "href=\"/travel/map\"", "href=\"/travel/events\"", "href=\"/travel/trips\""} {
        if !strings.Contains(body, text) { t.Errorf("shell missing %q", text) }
    }
}

func TestUnimplementedRoutesFailClosed(t *testing.T) {
    for _, path := range []string{"/travel/map", "/travel/events", "/travel/trips", "/travel/place/example", "/travel/business/claim", "/travel/booking", "/travel/doobr", "/travel/other", "/"} {
        t.Run(path, func(t *testing.T) {
            response := httptest.NewRecorder()
            Handler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
            if response.Code != http.StatusNotFound { t.Fatalf("%s: status = %d, want 404", path, response.Code) }
        })
    }
    response := httptest.NewRecorder()
    Handler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/travel", nil))
    if response.Code != http.StatusMethodNotAllowed { t.Fatalf("POST /travel: status = %d, want 405", response.Code) }
}
