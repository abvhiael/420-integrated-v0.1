package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
)

func TestTripEditingOwnerCSRFAndSavedReferences(t *testing.T){
 token:=strings.Repeat("c",40);store:=NewTripStore();ctx:=context.Background()
 initial,err:=store.Create(ctx,"alice",Trip{ID:"trip-one",Title:"original",Visibility:TripPrivate});if err!=nil{t.Fatal(err)}
 handler:=HandlerWithTripEditing(nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:token},Trips:store})
 request:=func(method,path string,values url.Values)*httptest.ResponseRecorder{
  var body string;if values!=nil{body=values.Encode()}
  r:=httptest.NewRequest(method,path,strings.NewReader(body));if values!=nil{r.Header.Set("Content-Type","application/x-www-form-urlencoded")}
  w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w
 }
 path:="/travel/trips/trip-one"
 if got:=request(http.MethodGet,path,nil);got.Code!=http.StatusOK||!strings.Contains(got.Body.String(),"original"){t.Fatalf("edit form: %d %s",got.Code,got.Body.String())}
 values:=url.Values{"csrf_token":{token},"version":{initial.UpdatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00")},"action":{"save"},"title":{"revised"},"visibility":{"PRIVATE"},"place_ids":{"place-one\nplace-two"},"event_ids":{"event-one"}}
 if got:=request(http.MethodPost,path,values);got.Code!=http.StatusSeeOther{t.Fatalf("save: %d %s",got.Code,got.Body.String())}
 updated,err:=store.GetOwned(ctx,"alice","trip-one");if err!=nil||updated.Title!="revised"||len(updated.PlaceIDs)!=2||len(updated.EventIDs)!=1{t.Fatalf("saved references: %+v %v",updated,err)}
 if got:=request(http.MethodPost,path,values);got.Code!=http.StatusConflict{t.Fatalf("stale edit: %d",got.Code)}
 values.Set("version",updated.UpdatedAt.UTC().Format("2006-01-02T15:04:05.999999999Z07:00"));values.Set("csrf_token","forged")
 if got:=request(http.MethodPost,path,values);got.Code!=http.StatusForbidden{t.Fatalf("forged CSRF: %d",got.Code)}
 values.Set("csrf_token",token);values.Set("place_ids","place-one\nplace-one")
 if got:=request(http.MethodPost,path,values);got.Code!=http.StatusBadRequest{t.Fatalf("duplicate references: %d",got.Code)}
 bobHandler:=HandlerWithTripEditing(nil,TravelUserDependencies{Identity:testIdentity{subject:"bob",token:token},Trips:store})
 bob:=httptest.NewRecorder();bobHandler.ServeHTTP(bob,httptest.NewRequest(http.MethodGet,path,nil));if bob.Code!=http.StatusNotFound{t.Fatalf("cross-owner edit disclosed: %d",bob.Code)}
 values.Set("place_ids","place-one");values.Set("action","delete")
 if got:=request(http.MethodPost,path,values);got.Code!=http.StatusSeeOther{t.Fatalf("delete: %d %s",got.Code,got.Body.String())}
 if got:=request(http.MethodGet,path,nil);got.Code!=http.StatusNotFound{t.Fatalf("deleted trip reachable: %d",got.Code)}
 public:=HandlerWithTripEditing(nil,TravelUserDependencies{})
 disabled:=httptest.NewRecorder();public.ServeHTTP(disabled,httptest.NewRequest(http.MethodGet,path,nil));if disabled.Code!=http.StatusServiceUnavailable{t.Fatalf("unauthenticated editing enabled: %d",disabled.Code)}
}
