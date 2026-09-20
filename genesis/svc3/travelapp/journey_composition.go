package travelapp

import (
 "net/http"
 "strings"
)

// HandlerWithIntegratedJourneys composes all five journey adapters for an
// integration environment. Handler() deliberately remains public-only until
// trusted Identity, durable stores, Reputation and claim-provenance adapters
// are configured and deployment-qualified. Nil optional adapters fail closed.
func HandlerWithIntegratedJourneys(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies)http.Handler {
 private:=HandlerWithUserDependencies(reader,users)
 publicReviews:=HandlerWithReviewReader(reader,reviews)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if reviews!=nil && strings.HasPrefix(r.URL.Path,"/travel/place/") {
   publicReviews.ServeHTTP(w,r);return
  }
  private.ServeHTTP(w,r)
 })
}
