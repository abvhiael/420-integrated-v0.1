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
 locationuikit "github.com/420integrated/420-integrated/location/uikit"
)

func securityEvent() eventmodel.Event {
 start:=time.Date(2026,10,1,12,0,0,0,time.UTC)
 return eventmodel.Event{ID:"event-public-1",Organizer:locationmodel.SubjectRef{Type:"user",ID:"organizer"},Title:"Public community event",StartAt:start,EndAt:start.Add(time.Hour),Timezone:"UTC",Visibility:eventmodel.VisibilityPublic,Status:eventmodel.StatusScheduled,PlaceID:"venue-public",Version:1,CreatedAt:start.Add(-time.Hour),UpdatedAt:start.Add(-time.Hour)}
}

func securityPlace(id string,visibility locationmodel.Visibility,precision locationmodel.PlacePrecision,lat,lon *float64) locationmodel.Place {
 now:=time.Date(2026,9,20,12,0,0,0,time.UTC)
 return locationmodel.Place{ID:id,Name:id,Category:locationmodel.CategoryVenue,Visibility:visibility,Precision:precision,Source:"canonical",Owner:locationmodel.SubjectRef{Type:"user",ID:"owner"},City:"Regina",Region:"Saskatchewan",Country:"Canada",Latitude:lat,Longitude:lon,Version:1,CreatedAt:now,UpdatedAt:now}
}

func TestSecurityPublicPlacePrecisionNeverLeaksPrivateCoordinates(t *testing.T) {
 privateLatitude,privateLongitude:=50.123456,-104.654321
 approxLatitude,approxLongitude:=50.765432,-104.123456
 publicLatitude,publicLongitude:=50.45,-104.61
 places:=placeSource{
  securityPlace("private-venue",locationmodel.VisibilityPrivate,locationmodel.PrecisionPrivate,&privateLatitude,&privateLongitude),
  securityPlace("unlisted-venue",locationmodel.VisibilityUnlisted,locationmodel.PrecisionApproximate,&privateLatitude,&privateLongitude),
  securityPlace("approximate-venue",locationmodel.VisibilityPublic,locationmodel.PrecisionApproximate,&approxLatitude,&approxLongitude),
  securityPlace("public-venue",locationmodel.VisibilityPublic,locationmodel.PrecisionExactPublic,&publicLatitude,&publicLongitude),
 }
 response:=httptest.NewRecorder()
 Server{Places:places}.Handler().ServeHTTP(response,httptest.NewRequest(http.MethodGet,"/v1/places",nil))
 if response.Code!=http.StatusOK {t.Fatalf("response=%d body=%s",response.Code,response.Body.String())}
 body:=response.Body.String()
 for _,secret:=range []string{"private-venue","unlisted-venue","50.123456","-104.654321","50.765432","-104.123456","providerAliases","postalRegion","address"} {
  if strings.Contains(body,secret) {t.Fatalf("private or overly precise place detail leaked: %q",secret)}
 }
 var payload struct{Version string `json:"version"`;Data locationuikit.View `json:"data"`}
 if err:=json.Unmarshal(response.Body.Bytes(),&payload);err!=nil{t.Fatal(err)}
 if payload.Version!="v1"||len(payload.Data.Items)!=2 {t.Fatalf("unexpected public projection: %+v",payload)}
 for _,item:=range payload.Data.Items {
  switch item.ID {
  case "approximate-venue":if item.Kind!=locationuikit.KindArea||item.Latitude!=nil||item.Longitude!=nil {t.Fatalf("approximate location emitted pin: %+v",item)}
  case "public-venue":if item.Kind!=locationuikit.KindPin||item.Latitude==nil||item.Longitude==nil {t.Fatalf("public exact pin missing: %+v",item)}
  default:t.Fatalf("unexpected place: %q",item.ID)
  }
 }
}

func TestSecurityStaleDiscoveryDoesNotOverrideCanonicalEvent(t *testing.T) {
 event:=securityEvent();from:=event.StartAt.Add(-time.Hour);to:=event.StartAt.Add(24*time.Hour)
 index:=eventdiscovery.New()
 if err:=index.Rebuild(eventSource{event},from,to);err!=nil{t.Fatal(err)}
 path:="/v1/events?from=2026-10-01T11:00:00Z&to=2026-10-02T12:00:00Z"
 for _,tc:=range []struct{name string;events eventSource;visible bool}{
  {"currently public",eventSource{event},true},
  {"now private",eventSource{func()eventmodel.Event{x:=event;x.Visibility=eventmodel.VisibilityPrivate;return x}()},false},
  {"now cancelled",eventSource{func()eventmodel.Event{x:=event;x.Status=eventmodel.StatusCancelled;return x}()},false},
  {"version changed",eventSource{func()eventmodel.Event{x:=event;x.Version=2;return x}()},false},
  {"deleted",eventSource{},false},
 } {
  t.Run(tc.name,func(t *testing.T){
   response:=httptest.NewRecorder()
   Server{Events:tc.events,Discovery:index}.Handler().ServeHTTP(response,httptest.NewRequest(http.MethodGet,path,nil))
   if response.Code!=http.StatusOK {t.Fatalf("status=%d body=%s",response.Code,response.Body.String())}
   found:=strings.Contains(response.Body.String(),"Public community event")
   if found!=tc.visible {t.Fatalf("stale discovery exposure=%t, expected=%t: %s",found,tc.visible,response.Body.String())}
   if response.Header().Get("Cache-Control")!="no-store" {t.Fatal("stale public event response was cacheable")}
  })
 }
}

func TestSecurityPublicAPIRejectsMutationAndMalformedQueries(t *testing.T) {
 index:=eventdiscovery.New();from:=time.Date(2026,10,1,11,0,0,0,time.UTC);to:=from.Add(25*time.Hour)
 if err:=index.Rebuild(eventSource{},from,to);err!=nil{t.Fatal(err)}
 api:=Server{Places:placeSource{},Events:eventSource{},Discovery:index}.Handler()
 for _,method:=range []string{http.MethodPost,http.MethodPut,http.MethodPatch,http.MethodDelete} {
  for _,path:=range []string{"/v1/places","/v1/events"} {
   response:=httptest.NewRecorder();api.ServeHTTP(response,httptest.NewRequest(method,path,strings.NewReader(`{"visibility":"PUBLIC"}`)))
   if response.Code!=http.StatusMethodNotAllowed {t.Errorf("mutation %s %s unexpectedly returned %d",method,path,response.Code)}
  }
 }
 for _,path:=range []string{
  "/v1/places?includePrivate=1",
  "/v1/events?from=2026-10-01T11:00:00Z&from=2026-10-01T12:00:00Z&to=2026-10-02T12:00:00Z",
  "/v1/events?from=2026-10-01T11:00:00Z&to=2026-10-02T12:00:00Z&offset=-1",
  "/v1/events?from=2026-10-01T11:00:00Z&to=2026-10-02T12:00:00Z&limit=1000000000",
  "/v1/events?from=2026-10-02T12:00:00Z&to=2026-10-01T11:00:00Z",
 } {
  response:=httptest.NewRecorder();api.ServeHTTP(response,httptest.NewRequest(http.MethodGet,path,nil))
  if response.Code!=http.StatusBadRequest {t.Errorf("malformed query %s returned %d: %s",path,response.Code,response.Body.String())}
 }
}
