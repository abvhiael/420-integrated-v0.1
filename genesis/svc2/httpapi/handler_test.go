package httpapi

import (
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventdiscovery "github.com/420integrated/420-integrated/events/discovery"
 eventmodel "github.com/420integrated/420-integrated/events/model"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

type placeSource []locationmodel.Place
func(s placeSource)ListAll()[]locationmodel.Place{return s}
type eventSource []eventmodel.Event
func(s eventSource)ListAll()[]eventmodel.Event{return s}

func TestVersionedPublicRoutesAndValidation(t *testing.T){
 index:=eventdiscovery.New()
 from:=time.Date(2026,9,20,0,0,0,0,time.UTC);to:=from.Add(24*time.Hour)
 if err:=index.Rebuild(eventSource{},from,to);err!=nil{t.Fatal(err)}
 api:=Server{Places:placeSource{},Events:eventSource{},Discovery:index}.Handler()
 for _,tc:=range []struct{path string; status int; token string}{
  {"/v1/places",200,"\"version\":\"v1\""},
  {"/v1/places?private=true",400,"unsupported"},
  {"/v1/events?from=2026-09-20T00:00:00Z&to=2026-09-21T00:00:00Z",200,"\"version\":\"v1\""},
  {"/v1/events?from=bad&to=2026-09-21T00:00:00Z",400,"invalid from"},
  {"/v1/events?from=2026-09-20T00:00:00Z&to=2026-09-21T00:00:00Z&limit=101",400,"invalid pagination"},
  {"/v1/events?from=2026-09-20T00:00:00Z&to=2026-09-21T00:00:00Z&unknown=1",400,"unsupported"},
 } {
  r:=httptest.NewRecorder();api.ServeHTTP(r,httptest.NewRequest(http.MethodGet,tc.path,nil))
  if r.Code!=tc.status||!strings.Contains(r.Body.String(),tc.token){t.Fatalf("%s: status=%d body=%s",tc.path,r.Code,r.Body.String())}
  if r.Header().Get("Cache-Control")!="no-store"{t.Fatal("public API response must not be cached")}
 }
 request:=httptest.NewRecorder();api.ServeHTTP(request,httptest.NewRequest(http.MethodPost,"/v1/places",nil))
 if request.Code!=http.StatusMethodNotAllowed{t.Fatalf("mutation route returned %d",request.Code)}
}

func TestPrivatePlaceNeverSerialized(t *testing.T){
 secret:=37.12345;longitude:=-110.12345
 private:=locationmodel.Place{ID:"secret",Name:"hidden",Visibility:locationmodel.VisibilityPrivate,Latitude:&secret,Longitude:&longitude}
 api:=Server{Places:placeSource{private}}.Handler()
 response:=httptest.NewRecorder();api.ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/v1/places",nil))
 if response.Code!=200{t.Fatal(response.Body.String())}
 if strings.Contains(response.Body.String(),"secret")||strings.Contains(response.Body.String(),"37.12345")||strings.Contains(response.Body.String(),"hidden"){t.Fatal("private place leaked")}
 var data map[string]any
 if err:=json.Unmarshal(response.Body.Bytes(),&data);err!=nil{t.Fatal(err)}
}
