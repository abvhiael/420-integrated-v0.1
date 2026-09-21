package travelapp

import (
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestDestinationToPublicPlaceAndNearbyEvent(t *testing.T) {
 now:=time.Now().UTC().Add(time.Hour)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{
  {ID:"public-place",Name:"Public <Venue>",Kind:locationui.KindArea,City:"Regina",Region:"SK"},
  {ID:"other-place",Name:"Other city",Kind:locationui.KindArea,City:"Toronto"},
 }},events:eventui.View{Items:[]eventui.Card{
  {ID:"public-event",Title:"Public & event",PlaceID:"public-place",StartAt:now},
  {ID:"hidden-event",Title:"Do not disclose",PlaceID:"private-place",StartAt:now},
 }}}
 handler:=HandlerWithReader(reader)
 for _,tc:=range []struct{path,want string;forbid string}{
  {"/travel?destination=Regina","href=\"/travel/place/public-place\"","Other city"},
  {"/travel/map?destination=Regina","Public &amp; event","Other city"},
  {"/travel/place/public-place","Public &lt;Venue&gt;","Do not disclose"},
 }{
  response:=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,tc.path,nil))
  if response.Code!=http.StatusOK {t.Fatalf("GET %s: %d %s",tc.path,response.Code,response.Body.String())}
  if !strings.Contains(response.Body.String(),tc.want)||strings.Contains(response.Body.String(),tc.forbid)||strings.Contains(response.Body.String(),"Do not disclose") {t.Errorf("GET %s public journey/privacy failed: %s",tc.path,response.Body.String())}
 }
 if !strings.Contains(getPublicJourney(handler,"/travel/place/public-place"),"Approximate area") {t.Fatal("precision warning missing")}
 for _,path:=range []string{"/travel/place/private-place","/travel/place/other-place!","/travel/place/"+strings.Repeat("x",129)} {
  res:=httptest.NewRecorder();handler.ServeHTTP(res,httptest.NewRequest(http.MethodGet,path,nil))
  if res.Code!=http.StatusNotFound {t.Errorf("%s status %d want 404",path,res.Code)}
 }
}

func getPublicJourney(handler http.Handler,path string)string {
 r:=httptest.NewRecorder();handler.ServeHTTP(r,httptest.NewRequest(http.MethodGet,path,nil));return r.Body.String()
}

func TestPublicJourneysRejectUnsafeFiltersAndUpstreamErrors(t *testing.T){
 handler:=HandlerWithReader(&stubPublicReader{placesErr:errors.New("private upstream failure")})
 for _,path:=range []string{"/travel/map","/travel/place/example"} {
  response:=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,path,nil))
  if response.Code!=http.StatusBadGateway||strings.Contains(response.Body.String(),"private upstream failure") {t.Fatalf("GET %s unsafe error: %d %s",path,response.Code,response.Body.String())}
 }
 for _,path:=range []string{"/travel?destination="+strings.Repeat("a",81),"/travel/map?destination="+strings.Repeat("a",81)}{
  response:=httptest.NewRecorder();handler.ServeHTTP(response,httptest.NewRequest(http.MethodGet,path,nil))
  if response.Code!=http.StatusBadRequest {t.Errorf("GET %s status %d want 400",path,response.Code)}
 }
 if validPublicPinCoordinates("NaN","0")||validPublicPinCoordinates("91","0")||validPublicPinCoordinates("0","181")||!validPublicPinCoordinates("50","-104") {t.Fatal("public exact-pin coordinate validation failed")}
}
