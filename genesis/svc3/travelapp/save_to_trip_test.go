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

func TestSavePublicReferencesToOwnedTrip(t *testing.T){
 store:=NewTripStore();ctx:=context.Background()
 if _,err:=store.Create(ctx,"alice",Trip{ID:"trip-alice",Title:"Alice trip",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 if _,err:=store.Create(ctx,"bob",Trip{ID:"trip-bob",Title:"Bob trip",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 source:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"published",Name:"Open venue",Kind:locationui.KindArea,City:"Regina"}}},events:eventui.View{Items:[]eventui.Card{{ID:"open-event",Title:"Open event",PlaceID:"published",StartAt:time.Now().Add(time.Hour)}}}}
 csrf:=strings.Repeat("a",40)
 handler:=HandlerWithSaveToTrip(source,nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:csrf},Trips:store},TripSharing{})
 post:=func(path,trip,token string)*httptest.ResponseRecorder{body:=url.Values{"trip_id":{trip},"csrf_token":{token}}.Encode();r:=httptest.NewRequest(http.MethodPost,path,strings.NewReader(body));r.Header.Set("Content-Type","application/x-www-form-urlencoded");w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w}
 page:=httptest.NewRecorder();handler.ServeHTTP(page,httptest.NewRequest(http.MethodGet,"/travel/save/place/published",nil))
 if page.Code!=http.StatusOK||!strings.Contains(page.Body.String(),"trip-alice")||strings.Contains(page.Body.String(),"trip-bob"){t.Fatalf("owner-scoped form: %d %s",page.Code,page.Body.String())}
 if result:=post("/travel/save/place/published","trip-bob",csrf);result.Code!=http.StatusNotFound{t.Fatalf("cross-owner write status %d",result.Code)}
 if result:=post("/travel/save/place/published","trip-alice","forged");result.Code!=http.StatusForbidden{t.Fatalf("csrf bypass status %d",result.Code)}
 if result:=post("/travel/save/place/published","trip-alice",csrf);result.Code!=http.StatusSeeOther{t.Fatalf("place save status %d %s",result.Code,result.Body.String())}
 if result:=post("/travel/save/event/open-event","trip-alice",csrf);result.Code!=http.StatusSeeOther{t.Fatalf("event save status %d %s",result.Code,result.Body.String())}
 trip,err:=store.GetOwned(ctx,"alice","trip-alice");if err!=nil||len(trip.PlaceIDs)!=1||trip.PlaceIDs[0]!="published"||len(trip.EventIDs)!=1||trip.EventIDs[0]!="open-event"{t.Fatalf("saved trip: %+v %v",trip,err)}
 if result:=post("/travel/save/place/published","trip-alice",csrf);result.Code!=http.StatusSeeOther{t.Fatalf("repeat save status %d",result.Code)}
 trip,_=store.GetOwned(ctx,"alice","trip-alice");if len(trip.PlaceIDs)!=1{t.Fatal("duplicate place saved")}
 source.places=locationui.View{}
 if result:=post("/travel/save/place/published","trip-alice",csrf);result.Code!=http.StatusNotFound{t.Fatalf("withdrawn place accepted: %d",result.Code)}
 if result:=post("/travel/save/event/open-event","trip-alice",csrf);result.Code!=http.StatusNotFound{t.Fatalf("withdrawn venue event accepted: %d",result.Code)}
}

func TestSaveRouteFailClosedWithoutDependencies(t *testing.T){
 handler:=HandlerWithSaveToTrip(nil,nil,TravelUserDependencies{},TripSharing{})
 for _,path:=range []string{"/travel/save/place/venue","/travel/save/event/event"}{w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil));if w.Code!=http.StatusServiceUnavailable{t.Fatalf("%s status %d",path,w.Code)}}
 w:=httptest.NewRecorder();handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/travel/save/place/invalid!",nil));if w.Code!=http.StatusNotFound{t.Fatalf("invalid route %d",w.Code)}
}
