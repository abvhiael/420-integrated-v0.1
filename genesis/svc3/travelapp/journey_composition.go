package travelapp

import (
 "net/http"
 "strings"
)

// HandlerWithIntegratedJourneys retains the previous entrypoint. For an
// explicitly configured, durable trip-sharing environment use
// HandlerWithQualifiedJourneys. Neither constructor provisions dependencies.
func HandlerWithIntegratedJourneys(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies)http.Handler {
 return HandlerWithQualifiedJourneys(reader,reviews,users,TripSharing{})
}

// HandlerWithQualifiedJourneys composes the public map, authenticated trip
// editing and business-claim submission, optional unlisted sharing, and
// trusted Reputation review reads. An absent adapter never creates an
// authenticated or verified fallback. The caller must inject separately
// qualified Identity, repositories, publication and Reputation services.
func HandlerWithQualifiedJourneys(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies,shares TripSharing)http.Handler {
 private:=HandlerWithTripSharing(reader,users,shares)
 publicReviews:=HandlerWithReviewReader(reader,reviews)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path=="/travel/map" {
   if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
   serveTravelNearbyMap(w,r,reader);return
  }
  if reviews!=nil && strings.HasPrefix(r.URL.Path,"/travel/place/") {
   publicReviews.ServeHTTP(w,r);return
  }
  private.ServeHTTP(w,r)
 })
}
