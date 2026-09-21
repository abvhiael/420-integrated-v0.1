package travelapp

import (
 "net/http"
 "strings"
)

// HandlerWithIntegratedJourneys retains the previous entrypoint. For an
// explicitly configured trip-sharing environment use HandlerWithQualifiedJourneys.
func HandlerWithIntegratedJourneys(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies)http.Handler {
 return HandlerWithQualifiedJourneys(reader,reviews,users,TripSharing{})
}

// HandlerWithQualifiedJourneys composes the public map, authenticated trip
// editing and saving, owner-facing share controls, business claims and trusted
// Reputation reads. Dependencies must be independently qualified by the caller.
func HandlerWithQualifiedJourneys(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies,shares TripSharing)http.Handler {
 private:=HandlerWithTripSharing(reader,users,shares)
 publicReviews:=HandlerWithReviewReader(reader,reviews)
 saveReady:=reader!=nil&&users.Identity!=nil
 if _,ok:=users.Trips.(EditableTripRepository);!ok {saveReady=false}
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path=="/travel/save" {serveSaveCatalog(w,r,reader,users);return}
  if strings.HasPrefix(r.URL.Path,"/travel/save/") {
   HandlerWithSaveToTrip(reader,reviews,users,shares).ServeHTTP(w,r);return
  }
  r=withSaveLinks(r,saveReady)
  if r.URL.Path=="/travel/map" {
   if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
   serveTravelNearbyMap(w,r,reader);return
  }
  if r.URL.Path=="/travel/trips" && r.Method==http.MethodGet && users.Identity!=nil {
   serveQualifiedTripList(w,r,users,shares);return
  }
  // Only a bare trip ID uses the saved-item cards. Share actions and the
  // explicit advanced editor continue through the existing private handler.
  const tripPrefix="/travel/trips/"
  if strings.HasPrefix(r.URL.Path,tripPrefix) && r.URL.Query().Get("mode")!="details" {
   id:=strings.TrimPrefix(r.URL.Path,tripPrefix)
   if validPlaceID(id) {
    HandlerWithSavedTripItems(reader,reviews,users,shares).ServeHTTP(w,r);return
   }
  }
  if reviews!=nil && strings.HasPrefix(r.URL.Path,"/travel/place/") {
   publicReviews.ServeHTTP(w,r);return
  }
  private.ServeHTTP(w,r)
 })
}
