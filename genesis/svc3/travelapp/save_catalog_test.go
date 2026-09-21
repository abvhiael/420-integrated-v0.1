package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestQualifiedTravelSaveCatalogNavigation(t *testing.T){
 trips:=NewTripStore();if _,err:=trips.Create(context.Background(),"alice",Trip{ID:"trip-one",Title:"My route",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"venue",Name:"Published venue",Kind:locationui.KindArea,City:"Regina"}}},events:eventui.View{Items:[]eventui.Card{{ID:"event",Title:"Published event",PlaceID:"venue",StartAt:time.Now().UTC().Add(time.Hour)}}}}
 deps:=TravelUserDependencies{Identity:testIdentity{subject:"alice",token:strings.Repeat("a",40)},Trips:trips}
 h:=HandlerWithQualifiedJourneys(reader,nil,deps,TripSharing{})
 get:=func(path string)*httptest.ResponseRecorder{w:=httptest.NewRecorder();h.ServeHTTP(w,httptest.NewRequest(http.MethodGet,path,nil));return w}
 list:=get("/travel/trips");if list.Code!=http.StatusOK||!strings.Contains(list.Body.String(),"href=\"/travel/save\""){t.Fatalf("save navigation missing: %d %s",list.Code,list.Body.String())}
 catalog:=get("/travel/save");if catalog.Code!=http.StatusOK||!strings.Contains(catalog.Body.String(),"/travel/save/place/venue")||!strings.Contains(catalog.Body.String(),"/travel/save/event/event"){t.Fatalf("catalog links missing: %d %s",catalog.Code,catalog.Body.String())}
 choose:=get("/travel/save/place/venue");if choose.Code!=http.StatusOK||!strings.Contains(choose.Body.String(),"trip-one"){t.Fatalf("save chooser missing: %d %s",choose.Code,choose.Body.String())}
 reader.places=locationui.View{}
 catalog=get("/travel/save");if catalog.Code!=http.StatusOK||strings.Contains(catalog.Body.String(),"Published venue")||strings.Contains(catalog.Body.String(),"Published event"){t.Fatalf("withdrawn references remain in catalog: %d %s",catalog.Code,catalog.Body.String())}
 disabled:=HandlerWithQualifiedJourneys(reader,nil,TravelUserDependencies{},TripSharing{})
 w:=httptest.NewRecorder();disabled.ServeHTTP(w,httptest.NewRequest(http.MethodGet,"/travel/save",nil));if w.Code!=http.StatusServiceUnavailable{t.Fatalf("disabled save catalog %d",w.Code)}
}
