package travelapp

import (
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/reputation/model"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestCombinedTravelJourneys(t *testing.T){
 token:=strings.Repeat("z",40)
 places:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"public-place",Name:"Public place",Kind:locationui.KindArea,City:"Regina"}}}}
 review:=sampleVerifiedTravelReview()
 source:=&testReviewReader{reviews:[]model.Review{review},allow:true}
 claims:=NewClaimStore(&claimVerifier{allow:true})
 trips:=NewTripStore()
 handler:=HandlerWithIntegratedJourneys(places,source,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:token},Trips:trips,Claims:claims})
 place:=getPrivate(handler,"/travel/place/public-place")
 if place.Code!=http.StatusOK||!strings.Contains(place.Body.String(),"href=\"/travel/place/public-place/reviews\""){t.Fatalf("place to reviews link missing: %d %s",place.Code,place.Body.String())}
 verified:=getPrivate(handler,"/travel/place/public-place/reviews")
 if verified.Code!=http.StatusOK||!strings.Contains(verified.Body.String(),"Verified interaction") {t.Fatalf("verified review navigation failed: %d %s",verified.Code,verified.Body.String())}
 form:=url.Values{"title":{"private getaway"},"visibility":{"PRIVATE"},"csrf_token":{token}}
 if r:=postPrivate(handler,"/travel/trips",form,"");r.Code!=http.StatusSeeOther {t.Fatalf("trip submission %d",r.Code)}
 if r:=getPrivate(handler,"/travel/trips");r.Code!=http.StatusOK||!strings.Contains(r.Body.String(),"private getaway"){t.Fatalf("owned trip invisible: %d %s",r.Code,r.Body.String())}
 claim:=url.Values{"place_id":{"public-place"},"registry_record_id":{"registry-1"},"evidence_ref":{"evidence-1"},"csrf_token":{token}}
 if r:=postPrivate(handler,"/travel/business/claim",claim,"");r.Code!=http.StatusAccepted {t.Fatalf("claim submission %d %s",r.Code,r.Body.String())}
 if r:=getPrivate(handler,"/travel");r.Code!=http.StatusOK||strings.Contains(r.Body.String(),"private getaway") {t.Fatalf("private trip publicly exposed: %d",r.Code)}
 if r:=getPrivate(handler,"/travel/place/withdrawn/reviews");r.Code!=http.StatusNotFound {t.Fatalf("withdrawn place review exposed: %d",r.Code)}
 // Neither the combined handler nor its adapters adds booking authority.
 for _,path:=range []string{"/travel/booking","/travel/doobr"}{r:=httptest.NewRecorder();handler.ServeHTTP(r,httptest.NewRequest(http.MethodPost,path,nil));if r.Code!=http.StatusNotFound {t.Errorf("%s returned %d",path,r.Code)}}
 if !review.VerifiedOccurredAt.Before(time.Now().Add(time.Second)){t.Fatal("invalid review fixture")}
}
