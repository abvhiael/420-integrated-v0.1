package travelapp

import (
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"

 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestNearbyMapOnlyPublishesExactPinsAndFilters(t *testing.T){
 lat,lon:=50.45,-104.61
 place:=locationui.Item{ID:"public-pin",Name:"Public pin",Kind:locationui.KindPin,Latitude:&lat,Longitude:&lon,City:"Regina",Category:"venue"}
 coarse:=locationui.Item{ID:"approx-area",Name:"Coarse area",Kind:locationui.KindArea,City:"Regina",Category:"venue",Latitude:&lat,Longitude:&lon}
 source:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{place,coarse}}}
 handler:=HandlerWithNearbyMap(source)
 request:=func(url string)*httptest.ResponseRecorder{w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,url,nil));return w}
 got:=request("/travel/map?destination=Regina&category=venue")
 if got.Code!=http.StatusOK {t.Fatalf("map response: %d %s",got.Code,got.Body.String())}
 body:=got.Body.String()
 if !strings.Contains(body,"Public pin")||!strings.Contains(body,"Coarse area")||strings.Count(body,"<circle ")!=1 {t.Fatalf("exact/public or approximate treatment: %s",body)}
 if strings.Contains(body,"50.45")||strings.Contains(body,"-104.61") {t.Fatalf("precise coordinates leaked in list/body: %s",body)}
 if got:=request("/travel/map?category=not-present");got.Code!=http.StatusOK||strings.Contains(got.Body.String(),"<circle "){t.Fatalf("category filter bypass: %d %s",got.Code,got.Body.String())}
 if got:=request("/travel/map?destination="+strings.Repeat("a",81));got.Code!=http.StatusBadRequest {t.Fatalf("invalid filter status %d",got.Code)}
 source.places=locationui.View{}
 if got:=request("/travel/map");got.Code!=http.StatusOK||strings.Contains(got.Body.String(),"Public pin") {t.Fatalf("withdrawn listing still visible: %d %s",got.Code,got.Body.String())}
}

func TestNearbyMapFailsClosedWithoutPublicReader(t *testing.T){
 handler:=HandlerWithNearbyMap(nil)
 w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/travel/map",nil))
 if w.Code!=http.StatusServiceUnavailable {t.Fatalf("reader absent: %d",w.Code)}
 w=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodPost,"/travel/map",nil))
 if w.Code!=http.StatusMethodNotAllowed {t.Fatalf("mutation enabled: %d",w.Code)}
 source:=&stubPublicReader{placesErr:errors.New("backend private details")}
 w=httptest.NewRecorder();HandlerWithNearbyMap(source).ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/travel/map",nil))
 if w.Code!=http.StatusBadGateway||strings.Contains(w.Body.String(),"backend private details") {t.Fatalf("backend failure disclosed: %d %s",w.Code,w.Body.String())}
}
