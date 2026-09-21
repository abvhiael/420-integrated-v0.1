package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"

 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestSaveLinksOnlyOnQualifiedMap(t *testing.T) {
 lat, lon := 50.45, -104.61
 reader := &stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"public-place",Name:"Public place",Kind:locationui.KindPin,Latitude:&lat,Longitude:&lon}}}}
 get := func(h http.Handler) *httptest.ResponseRecorder {
  w:=httptest.NewRecorder()
  h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/travel/map",nil))
  return w
 }
 unqualified:=get(HandlerWithQualifiedJourneys(reader,nil,TravelUserDependencies{},TripSharing{}))
 if unqualified.Code!=http.StatusOK||strings.Contains(unqualified.Body.String(),"/travel/save/place/"){t.Fatalf("unqualified save link: %d %s",unqualified.Code,unqualified.Body.String())}
 store:=NewTripStore()
 if _,err:=store.Create(context.Background(),"owner",Trip{ID:"owner-trip",Title:"Owner's trip",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 qualified:=get(HandlerWithQualifiedJourneys(reader,nil,TravelUserDependencies{Identity:testIdentity{subject:"owner",token:strings.Repeat("a",40)},Trips:store},TripSharing{}))
 if qualified.Code!=http.StatusOK||!strings.Contains(qualified.Body.String(),"/travel/save/place/public-place"){t.Fatalf("qualified save link missing: %d %s",qualified.Code,qualified.Body.String())}
 publicOnly:=get(HandlerWithNearbyMap(reader))
 if strings.Contains(publicOnly.Body.String(),"/travel/save/place/"){t.Fatalf("public-only handler exposed save action: %s",publicOnly.Body.String())}
}
