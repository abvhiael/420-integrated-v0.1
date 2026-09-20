package travelapp

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

// TestGenesisTravelRouteQualification encodes the actual Genesis UI boundary:
// read-only public discovery/events are usable; incomplete or transactional
// journeys are never presented as working or allowed to mutate state.
func TestGenesisTravelRouteQualification(t *testing.T) {
 reader := &stubPublicReader{
  places: locationui.View{Items: []locationui.Item{{ID: "venue-visible", Name: "Public venue", Kind: locationui.KindArea, City: "Regina"}}},
  events: eventui.View{Items: []eventui.Card{
   {ID: "event-visible", Title: "Public event", PlaceID: "venue-visible", StartAt: time.Now().UTC().Add(2*time.Hour)},
   {ID: "event-hidden", Title: "Confidential event", PlaceID: "venue-hidden", StartAt: time.Now().UTC().Add(2*time.Hour)},
  }},
 }
 handler := HandlerWithReader(reader)
 for _, tc := range []struct {
  path string
  status int
  required string
  forbidden string
 }{
  {"/travel", http.StatusOK, "Public venue", "Confidential event"},
  {"/travel/events", http.StatusOK, "Public event", "Confidential event"},
  {"/travel/map", http.StatusServiceUnavailable, "not available yet", "Public venue"},
  {"/travel/place/venue-visible", http.StatusServiceUnavailable, "not available yet", "Public venue"},
  {"/travel/trips", http.StatusServiceUnavailable, "not available yet", "Confidential event"},
  {"/travel/business/claim", http.StatusServiceUnavailable, "not available yet", "Public venue"},
  {"/travel/booking", http.StatusNotFound, "404", "Public venue"},
  {"/travel/doobr", http.StatusNotFound, "404", "Public venue"},
 } {
  t.Run(tc.path, func(t *testing.T) {
   response := httptest.NewRecorder()
   handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, tc.path, nil))
   if response.Code != tc.status { t.Fatalf("GET %s status %d, want %d", tc.path, response.Code, tc.status) }
   body := response.Body.String()
   if !strings.Contains(body, tc.required) { t.Errorf("GET %s missing %q", tc.path, tc.required) }
   if strings.Contains(body, tc.forbidden) { t.Errorf("GET %s exposed %q", tc.path, tc.forbidden) }
   if tc.status != http.StatusNotFound && response.Header().Get("Cache-Control") != "no-store" { t.Errorf("GET %s missing no-store", tc.path) }
  })
 }
}

func TestGenesisTravelMutationsCannotActivateReservedJourneys(t *testing.T) {
 handler := HandlerWithReader(nil)
 for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete} {
  for _, path := range []string{"/travel", "/travel/events", "/travel/map", "/travel/place/venue-visible", "/travel/trips", "/travel/business/claim"} {
   response := httptest.NewRecorder()
   handler.ServeHTTP(response, httptest.NewRequest(method, path, strings.NewReader("claimant=forged&reservation=1")))
   if response.Code != http.StatusMethodNotAllowed { t.Errorf("%s %s status %d, want 405", method, path, response.Code) }
  }
  for _, path := range []string{"/travel/booking", "/travel/doobr"} {
   response := httptest.NewRecorder()
   handler.ServeHTTP(response, httptest.NewRequest(method, path, strings.NewReader("reservation=1")))
   if response.Code != http.StatusNotFound { t.Errorf("%s %s status %d, want 404", method, path, response.Code) }
  }
 }
}
