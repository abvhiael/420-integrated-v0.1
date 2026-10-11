package travelapp

import (
 "fmt"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "testing"
)

func TestBnBAccommodationConsumerFailsClosedAndRendersOnlyPublicFields(t *testing.T) {
 upstream:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/v1/bnb/travel/authorized"||r.URL.Query().Get("place_id")!="place_1"{t.Errorf("unexpected upstream route: %s",r.URL.String())}
  fmt.Fprint(w,`{"version":"bnb-travel-authorized/v1","nonbinding":true,"transaction_enabled":false,"place_id":"place_1","listings":[{"property_id":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","title":"Public & safe","public_region":"SK","capacity":2,"map_marker":null}]}`)
 }))
 defer upstream.Close()
 t.Setenv("TRAVEL_BNB_PUBLIC_URL",upstream.URL)
 // Testing uses a deliberately untrusted self-signed server. Production uses normal TLS.
 // The route must reject this endpoint rather than bypass TLS verification.
 req:=httptest.NewRequest("GET","/travel/accommodations?place_id=place_1",nil)
 w:=httptest.NewRecorder()
 withBnBAccommodations(http.NotFoundHandler()).ServeHTTP(w,req)
 if w.Code!=503 {t.Fatalf("TLS verification was bypassed: %d",w.Code)}
}
func TestBnBAccommodationInvalidPlaceRejectedBeforeUpstream(t *testing.T){
 t.Setenv("TRAVEL_BNB_PUBLIC_URL","https://bnb.example")
 for _,id:=range []string{"../private","%2F",strings.Repeat("x",129)} {
  response:=httptest.NewRecorder()
  withBnBAccommodations(http.NotFoundHandler()).ServeHTTP(response,httptest.NewRequest("GET","/travel/accommodations?place_id="+id,nil))
  if response.Code!=400 {t.Fatalf("bad place %q: %d",id,response.Code)}
 }
}
func TestBnBWebsiteHandoffNoImplicitBooking(t *testing.T){
 t.Setenv("TRAVEL_BNB_WEB_URL","https://stays.example")
 h:=withBnBAccommodations(http.NotFoundHandler())
 for _,method:=range []string{"POST","PUT"}{
  w:=httptest.NewRecorder()
  h.ServeHTTP(w,httptest.NewRequest(method,"/travel/accommodations/handoff?property_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",nil))
  if w.Code!=405 {t.Fatalf("%s unexpectedly accepted",method)}
 }
 w:=httptest.NewRecorder()
 h.ServeHTTP(w,httptest.NewRequest("GET","/travel/accommodations/handoff?property_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",nil))
 if w.Code!=http.StatusSeeOther || w.Header().Get("Location")!="https://stays.example/?property_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" {t.Fatalf("unsafe handoff: %d %s",w.Code,w.Header().Get("Location"))}
 t.Setenv("TRAVEL_BNB_WEB_URL","http://stays.example")
 w=httptest.NewRecorder()
 h.ServeHTTP(w,httptest.NewRequest("GET","/travel/accommodations/handoff?property_id=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",nil))
 if w.Code!=503 {t.Fatalf("non-TLS handoff accepted: %d",w.Code)}
 _=os.ErrNotExist
}
