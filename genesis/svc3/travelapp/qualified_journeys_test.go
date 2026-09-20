package travelapp

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"

 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestQualifiedJourneysPublicMapAndPrivateFailClosed(t *testing.T) {
 lat,lon:=50.45,-104.61
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{
  {ID:"public-pin",Name:"Public place",Kind:locationui.KindPin,Latitude:&lat,Longitude:&lon,City:"Regina"},
  {ID:"coarse-area",Name:"Coarse place",Kind:locationui.KindArea,City:"Regina"},
 }}}
 handler:=HandlerWithQualifiedJourneys(reader,nil,TravelUserDependencies{},TripSharing{})
 get:=func(path string)*httptest.ResponseRecorder {w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil));return w}
 mapPage:=get("/travel/map?destination=Regina")
 if mapPage.Code!=http.StatusOK||!strings.Contains(mapPage.Body.String(),"Public place")||!strings.Contains(mapPage.Body.String(),"Coarse place")||strings.Count(mapPage.Body.String(),"<circle ")!=1 {t.Fatalf("integrated map: %d %s",mapPage.Code,mapPage.Body.String())}
 if got:=get("/travel/trips");got.Code!=http.StatusServiceUnavailable {t.Fatalf("identity-free trips: %d",got.Code)}
 if got:=get("/travel/business/claim");got.Code!=http.StatusServiceUnavailable {t.Fatalf("unverified claims: %d",got.Code)}
 if got:=get("/travel/shared/"+strings.Repeat("a",64));got.Code!=http.StatusNotFound {t.Fatalf("unconfigured share: %d",got.Code)}
 if got:=get("/travel/place/public-pin/reviews");got.Code!=http.StatusNotFound {t.Fatalf("unconfigured review route: %d",got.Code)}
 if got:=get("/travel/place/coarse-area");got.Code!=http.StatusOK {t.Fatalf("public place link: %d",got.Code)}
}

func TestPublicTravelHandlerWithoutServiceIsFailClosed(t *testing.T){
 t.Setenv("TRAVEL_PUBLIC_SERVICE_URL","")
 handler:=PublicTravelHandler()
 for _,tc:=range []struct{path string;status int}{{"/travel/map",http.StatusServiceUnavailable},{"/travel/trips",http.StatusServiceUnavailable},{"/travel/business/claim",http.StatusServiceUnavailable}} {
  w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,tc.path,nil))
  if w.Code!=tc.status {t.Errorf("%s: %d want %d",tc.path,w.Code,tc.status)}
 }
}
