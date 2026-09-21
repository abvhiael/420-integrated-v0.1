package travelapp

import (
 "encoding/json"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func publicJSONRequest(reader PublicReader, method, path string)*httptest.ResponseRecorder {
 rec:=httptest.NewRecorder()
 WithPublicJSON(HandlerWithReader(reader),reader).ServeHTTP(rec,httptest.NewRequest(method,path,nil))
 return rec
}
func TestPublicJSONProjectionFiltersAndAllowlist(t *testing.T) {
 now:=time.Now().UTC().Add(2*time.Hour)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{
  {ID:"public-1",Name:"Public & Green",Kind:locationui.KindArea,City:"Regina",Region:"Saskatchewan"},
  {ID:"public-2",Name:"Other place",Kind:locationui.KindArea,City:"Calgary",Region:"Alberta"},
 }}, events:eventui.View{Items:[]eventui.Card{
  {ID:"event-1",Title:"Public festival",PlaceID:"public-1",StartAt:now},
  {ID:"event-2",Title:"WITHDRAWN SECRET",PlaceID:"withdrawn",StartAt:now},
 }}}
 rec:=publicJSONRequest(reader,"GET","/travel/api/v1/places?destination=Regina")
 if rec.Code!=200 {t.Fatalf("places status %d: %s",rec.Code,rec.Body.String())}
 var places publicJSONResponse
 if err:=json.Unmarshal(rec.Body.Bytes(),&places);err!=nil {t.Fatal(err)}
 if places.State!="ready"||len(places.Places)!=1||places.Places[0].ID!="public-1"||!places.Places[0].Approximate {t.Fatalf("places: %+v",places)}
 if strings.Contains(rec.Body.String(),"latitude")||strings.Contains(rec.Body.String(),"owner")||strings.Contains(rec.Body.String(),"public-2") {t.Fatalf("unexpected public JSON field: %s",rec.Body.String())}
 rec=publicJSONRequest(reader,"GET","/travel/api/v1/events?destination=Regina")
 if rec.Code!=200 {t.Fatalf("events status %d: %s",rec.Code,rec.Body.String())}
 var events publicJSONResponse
 if err:=json.Unmarshal(rec.Body.Bytes(),&events);err!=nil {t.Fatal(err)}
 if events.State!="ready"||len(events.Events)!=1||events.Events[0].ID!="event-1" {t.Fatalf("events: %+v",events)}
 if strings.Contains(rec.Body.String(),"WITHDRAWN SECRET")||strings.Contains(rec.Body.String(),"withdrawn") {t.Fatalf("withdrawn venue event leaked: %s",rec.Body.String())}
 if reader.query.Limit!=100||reader.query.From.IsZero() {t.Fatalf("unbounded query: %+v",reader.query)}
}
func TestPublicJSONDisconnectedEmptyInvalidAndUnavailable(t *testing.T) {
 for _,tc:=range []struct{reader PublicReader;path string;method string;status int;state string}{
  {nil,"/travel/api/v1/places","GET",503,"disconnected"},
  {&stubPublicReader{},"/travel/api/v1/places","GET",200,"empty"},
  {&stubPublicReader{},"/travel/api/v1/events?date=1900-01-01","GET",400,"invalid"},
  {&stubPublicReader{},"/travel/api/v1/places?destination="+strings.Repeat("x",81),"GET",400,"invalid"},
  {&stubPublicReader{placesErr:errors.New("sensitive upstream failure")},"/travel/api/v1/places","GET",502,"unavailable"},
  {&stubPublicReader{eventsErr:errors.New("sensitive upstream failure")},"/travel/api/v1/events","GET",502,"unavailable"},
  {&stubPublicReader{},"/travel/api/v1/places","POST",405,"method_not_allowed"},
 } {
  rec:=publicJSONRequest(tc.reader,tc.method,tc.path)
  if rec.Code!=tc.status||!strings.Contains(rec.Body.String(),`"state":"`+tc.state+`"`) {t.Errorf("%s %s: status=%d body=%s",tc.method,tc.path,rec.Code,rec.Body.String())}
  if strings.Contains(rec.Body.String(),"sensitive upstream failure") {t.Fatal("upstream error leaked")}
  if rec.Header().Get("Cache-Control")!="no-store"||!strings.Contains(rec.Header().Get("Content-Type"),"application/json") {t.Fatal("unsafe response headers")}
 }
}
func TestPublicJSONDeploymentHandlerDisconnected(t *testing.T){
 h,err:=NewPublicDeploymentHandler(PublicDeploymentConfig{})
 if err!=nil {t.Fatal(err)}
 rec:=httptest.NewRecorder()
 h.ServeHTTP(rec,httptest.NewRequest(http.MethodGet,"/travel/api/v1/places",nil))
 if rec.Code!=503||!strings.Contains(rec.Body.String(),`"state":"disconnected"`) {t.Fatalf("deployment did not expose fail-closed API: %d %s",rec.Code,rec.Body.String())}
}
func TestPublicJSONMalformedProjectionFailsClosed(t *testing.T){
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"unsafe",Name:"private",Kind:locationui.KindArea,City:"Regina",Latitude:ptr(50)}}}}
 rec:=publicJSONRequest(reader,"GET","/travel/api/v1/places")
 if rec.Code!=502||strings.Contains(rec.Body.String(),"private") {t.Fatalf("malformed public projection exposed: %d %s",rec.Code,rec.Body.String())}
}
