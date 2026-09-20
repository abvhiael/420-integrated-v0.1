package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestQualifiedTripListOwnerLinksAndShareGating(t *testing.T){
 store:=NewTripStore()
 if _,err:=store.Create(context.Background(),"alice",Trip{ID:"owned-trip",Title:"Alice itinerary",Visibility:TripUnlisted});err!=nil{t.Fatal(err)}
 if _,err:=store.Create(context.Background(),"bob",Trip{ID:"secret-trip",Title:"Bob private itinerary",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 deps:=TravelUserDependencies{Identity:testIdentity{subject:"alice",token:strings.Repeat("a",40)},Trips:store}
 h:=HandlerWithQualifiedJourneys(nil,nil,deps,TripSharing{})
 response:=httptest.NewRecorder();h.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/travel/trips",nil))
 if response.Code!=http.StatusOK||!strings.Contains(response.Body.String(),"/travel/trips/owned-trip")||!strings.Contains(response.Body.String(),"Alice itinerary") {t.Fatalf("owned trip edit link missing: %d %s",response.Code,response.Body.String())}
 for _,secret:=range []string{"secret-trip","Bob private itinerary","/travel/trips/owned-trip/share"}{if strings.Contains(response.Body.String(),secret){t.Fatalf("private entry or disabled share leaked: %s",secret)}}
 if response.Header().Get("Cache-Control")!="no-store" {t.Fatal("private trip page is cacheable")}
}
