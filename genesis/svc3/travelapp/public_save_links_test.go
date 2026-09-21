package travelapp

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestPublicSaveLinksRequireQualifiedComposition(t *testing.T) {
 reader:=&stubPublicReader{
  places:locationui.View{Items:[]locationui.Item{{ID:"public-place",Name:"Public place",Kind:locationui.KindArea,City:"Regina"}}},
  events:eventui.View{Items:[]eventui.Card{{ID:"public-event",Title:"Public event",PlaceID:"public-place",StartAt:time.Now().Add(time.Hour)}}},
 }
 qualified:=HandlerWithQualifiedJourneys(reader,nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:strings.Repeat("a",40)},Trips:NewTripStore()},TripSharing{})
 publicOnly:=HandlerWithReader(reader)
 for _,tc:=range []struct{path,link string}{
  {"/travel","/travel/save/place/public-place"},
  {"/travel/events","/travel/save/event/public-event"},
  {"/travel/place/public-place","/travel/save/place/public-place"},
 } {
  for _,test:=range []struct{name string;handler http.Handler;want bool}{{"qualified",qualified,true},{"public-only",publicOnly,false}} {
   t.Run(test.name+tc.path,func(t *testing.T){
    w:=httptest.NewRecorder();test.handler.ServeHTTP(w,httptest.NewRequest(http.MethodGet,tc.path,nil))
    if w.Code!=http.StatusOK {t.Fatalf("%s status %d: %s",tc.path,w.Code,w.Body.String())}
    got:=strings.Contains(w.Body.String(),tc.link)
    if got!=test.want {t.Fatalf("save picker link presence %t, want %t at %s",got,test.want,tc.path)}
   })
  }
 }
 picker:=httptest.NewRecorder();qualified.ServeHTTP(picker,httptest.NewRequest(http.MethodGet,"/travel/save/place/public-place",nil))
 if picker.Code!=http.StatusOK || !strings.Contains(picker.Body.String(),"Save to a trip") {t.Fatalf("picker GET: %d %s",picker.Code,picker.Body.String())}
}
