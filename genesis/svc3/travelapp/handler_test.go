package travelapp

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestTravelShell(t *testing.T) {
 response := httptest.NewRecorder()
 HandlerWithReader(nil).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/travel", nil))
 if response.Code != http.StatusOK { t.Fatalf("GET /travel: status = %d", response.Code) }
 if got := response.Header().Get("Content-Type"); got != "text/html; charset=utf-8" { t.Fatalf("content type = %q", got) }
 if got := response.Header().Get("Cache-Control"); got != "no-store" { t.Fatalf("cache control = %q", got) }
 body := response.Body.String()
 for _, text := range []string{"420Travel", "Discovery is not connected yet", "420BnB booking and DOOBR transactions are unavailable", "href=\"/travel/map\"", "href=\"/travel/events\"", "href=\"/travel/trips\"", "href=\"/travel/business/claim\"", "href=\"#main\"", "aria-current=\"page\"", "Find places"} {
  if !strings.Contains(body, text) { t.Errorf("shell missing %q", text) }
 }
}

func TestProtectedRoutesUnavailableWithoutIdentityIntegration(t *testing.T) {
 for _, tc := range []struct{path, heading string}{
  {"/travel/trips", "Your trips"},
  {"/travel/business/claim", "Claim a business"},
 } {
  t.Run(tc.path, func(t *testing.T) {
   response := httptest.NewRecorder()
   HandlerWithReader(nil).ServeHTTP(response, httptest.NewRequest(http.MethodGet, tc.path, nil))
   if response.Code != http.StatusServiceUnavailable { t.Fatalf("%s: got %d, want 503", tc.path, response.Code) }
   body := response.Body.String()
   for _, text := range []string{tc.heading, "not available yet", "navigation shell only", "href=\"/travel\"", "420BnB booking and DOOBR transactions are unavailable"} {
    if !strings.Contains(body, text) { t.Errorf("%s missing %q", tc.path, text) }
   }
   if strings.Contains(body, "Discovery is not connected yet") { t.Fatal("placeholder incorrectly rendered discovery data") }
   if !strings.Contains(body, "aria-current=\"page\"") {t.Fatal("active navigation state missing")}
   if response.Header().Get("Cache-Control") != "no-store" { t.Fatal("missing no-store") }
  })
 }
}

func TestUnexpectedAndDisabledRoutesFailClosed(t *testing.T) {
 for _, path := range []string{"/travel/booking", "/travel/doobr", "/travel/other", "/travel/place/", "/travel/place/invalid!", "/travel/place/123/extra", "/travel/place/"+strings.Repeat("a", 129), "/"} {
  t.Run(path, func(t *testing.T) {
   response := httptest.NewRecorder()
   HandlerWithReader(nil).ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
   if response.Code != http.StatusNotFound { t.Fatalf("%s: status = %d, want 404", path, response.Code) }
  })
 }
 for _, path := range []string{"/travel", "/travel/map", "/travel/events", "/travel/trips", "/travel/business/claim", "/travel/place/example"} {
  response := httptest.NewRecorder()
  HandlerWithReader(nil).ServeHTTP(response, httptest.NewRequest(http.MethodPost, path, nil))
  if response.Code != http.StatusMethodNotAllowed { t.Fatalf("POST %s: status = %d, want 405", path, response.Code) }
 }
}
