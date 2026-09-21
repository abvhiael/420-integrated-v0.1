package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestSavedTripCardsCurrentTitlesMoveRemoveAndAccess(t *testing.T) {
 ctx:=context.Background();store:=NewTripStore();csrf:=strings.Repeat("a",40)
 initial,err:=store.Create(ctx,"alice",Trip{ID:"trip-saved",Title:"My itinerary",Visibility:TripPrivate,PlaceIDs:[]string{"place-a","place-b","old-place"},EventIDs:[]string{"event-a"}})
 if err!=nil {t.Fatal(err)}
 source:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"place-a",Name:"Published A",Kind:locationui.KindArea,City:"Regina"},{ID:"place-b",Name:"Published B",Kind:locationui.KindArea,City:"Regina"}}},events:eventui.View{Items:[]eventui.Card{{ID:"event-a",Title:"Current festival",StartAt:time.Now().Add(time.Hour)}}}}
 alice:=HandlerWithQualifiedJourneys(source,nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:csrf},Trips:store},TripSharing{})
 bob:=HandlerWithQualifiedJourneys(source,nil,TravelUserDependencies{Identity:testIdentity{subject:"bob",token:csrf},Trips:store},TripSharing{})
 path:="/travel/trips/trip-saved"
 get:=func(h http.Handler)*httptest.ResponseRecorder {w:=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil));return w}
 page:=get(alice)
 if page.Code!=http.StatusOK||!strings.Contains(page.Body.String(),"Published A")||!strings.Contains(page.Body.String(),"Published B")||!strings.Contains(page.Body.String(),"Current festival")||!strings.Contains(page.Body.String(),"may have been withdrawn") {t.Fatalf("saved title/withdrawal card: %d %s",page.Code,page.Body.String())}
 if strings.Contains(page.Body.String(),"<h3>old-place</h3>"){t.Fatal("stale ID rendered as public title")}
 if page.Header().Get("Cache-Control")!="no-store"{t.Fatal("private trip card cacheable")}
 if got:=get(bob);got.Code!=http.StatusNotFound{t.Fatalf("other owner read: %d",got.Code)}
 post:=func(h http.Handler,action,kind,id,version,token string)*httptest.ResponseRecorder {
  body:=url.Values{"action":{action},"kind":{kind},"ref_id":{id},"version":{version},"csrf_token":{token}}.Encode()
  r:=httptest.NewRequest(http.MethodPost,path,strings.NewReader(body));r.Header.Set("Content-Type","application/x-www-form-urlencoded")
  w:=httptest.NewRecorder();h.ServeHTTP(w,r);return w
 }
 version:=initial.UpdatedAt.UTC().Format(time.RFC3339Nano)
 if got:=post(bob,"remove","place","place-a",version,csrf);got.Code!=http.StatusNotFound{t.Fatalf("cross-owner mutation: %d",got.Code)}
 if got:=post(alice,"up","place","place-b",version,"forged");got.Code!=http.StatusForbidden{t.Fatalf("forged csrf: %d",got.Code)}
 if got:=post(alice,"up","place","place-b",version,csrf);got.Code!=http.StatusSeeOther{t.Fatalf("move up: %d %s",got.Code,got.Body.String())}
 trip,_:=store.GetOwned(ctx,"alice","trip-saved")
 if trip.PlaceIDs[0]!="place-b"||trip.PlaceIDs[1]!="place-a"{t.Fatalf("reorder not saved: %+v",trip.PlaceIDs)}
 if got:=post(alice,"remove","place","old-place",version,csrf);got.Code!=http.StatusConflict{t.Fatalf("stale edit: %d",got.Code)}
 fresh:=trip.UpdatedAt.UTC().Format(time.RFC3339Nano)
 if got:=post(alice,"remove","place","old-place",fresh,csrf);got.Code!=http.StatusSeeOther{t.Fatalf("remove withdrawn: %d",got.Code)}
 trip,_=store.GetOwned(ctx,"alice","trip-saved")
 if len(trip.PlaceIDs)!=2||len(trip.EventIDs)!=1{t.Fatalf("remove unexpectedly changed items: %+v",trip)}
 source.places=locationui.View{}
 withdrawn:=get(alice)
 if withdrawn.Code!=http.StatusOK||strings.Contains(withdrawn.Body.String(),"Published A")||!strings.Contains(withdrawn.Body.String(),"may have been withdrawn") {t.Fatalf("withdrawn public title leaked: %d %s",withdrawn.Code,withdrawn.Body.String())}
 if got:=post(alice,"remove","event","event-a",trip.UpdatedAt.UTC().Format(time.RFC3339Nano),csrf);got.Code!=http.StatusSeeOther{t.Fatalf("remove event: %d",got.Code)}
 trip,_=store.GetOwned(ctx,"alice","trip-saved");if len(trip.EventIDs)!=0{t.Fatal("event not removed")}
}

func TestSavedTripEmptyAndPublicOutageStates(t *testing.T) {
 store:=NewTripStore();_,err:=store.Create(context.Background(),"alice",Trip{ID:"empty-trip",Title:"Empty",Visibility:TripPrivate});if err!=nil{t.Fatal(err)}
 deps:=TravelUserDependencies{Identity:testIdentity{subject:"alice",token:strings.Repeat("x",40)},Trips:store}
 handler:=HandlerWithQualifiedJourneys(nil,nil,deps,TripSharing{})
 w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/travel/trips/empty-trip",nil))
 if w.Code!=http.StatusOK||!strings.Contains(w.Body.String(),"No places saved yet")||!strings.Contains(w.Body.String(),"No events saved yet"){t.Fatalf("empty trip: %d %s",w.Code,w.Body.String())}
}
