package travelapp

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

type stubPublicReader struct {
 places locationui.View
 events eventui.View
 placesErr error
 eventsErr error
 query sdk.EventQuery
}
func(s *stubPublicReader) Places(context.Context)(locationui.View,error){return s.places,s.placesErr}
func(s *stubPublicReader) Events(_ context.Context,q sdk.EventQuery)(eventui.View,error){s.query=q;return s.events,s.eventsErr}
func serveTravel(reader PublicReader)*httptest.ResponseRecorder{
 result:=httptest.NewRecorder()
 HandlerWithReader(reader).ServeHTTP(result,httptest.NewRequest(http.MethodGet,"/travel",nil))
 return result
}
func TestPublicDiscoveryRendersOnlyPublicProjection(t *testing.T){
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"venue-1",Name:"Public & Green",Kind:locationui.KindArea,City:"Regina",Region:"Saskatchewan"}}},events:eventui.View{Items:[]eventui.Card{{ID:"event-1",Title:"Festival <Live>",PlaceID:"venue-1",StartAt:time.Now().UTC().Add(2*time.Hour)},{ID:"hidden",Title:"Hidden event",PlaceID:"not-public",StartAt:time.Now().UTC().Add(2*time.Hour)}}}}
 result:=serveTravel(reader)
 if result.Code!=http.StatusOK {t.Fatalf("status %d: %s",result.Code,result.Body.String())}
 body:=result.Body.String()
 for _,want:=range []string{"Public &amp; Green","Festival &lt;Live&gt;","Approximate location","Saskatchewan","href=\"/travel/place/venue-1\""}{if !strings.Contains(body,want){t.Errorf("missing %q: %s",want,body)}}
 for _,secret:=range []string{"Hidden event","not-public"}{if strings.Contains(body,secret){t.Errorf("unexpected private reference %q",secret)}}
 if reader.query.Limit!=100 || reader.query.From.IsZero() || !reader.query.To.After(reader.query.From) {t.Fatalf("invalid bounded event query: %+v",reader.query)}
}
func TestPublicDiscoveryEmptyAndUnavailable(t *testing.T){
 for _,tc:=range []struct{name string;reader *stubPublicReader;status int;message string}{{"empty",&stubPublicReader{},http.StatusOK,"No public places found"},{"places unavailable",&stubPublicReader{placesErr:errors.New("private upstream error")},http.StatusBadGateway,"Discovery is temporarily unavailable"},{"events unavailable",&stubPublicReader{eventsErr:errors.New("private upstream error")},http.StatusBadGateway,"Discovery is temporarily unavailable"}}{
  t.Run(tc.name,func(t *testing.T){result:=serveTravel(tc.reader);if result.Code!=tc.status{t.Fatalf("status %d, want %d",result.Code,tc.status)};body:=result.Body.String();if !strings.Contains(body,tc.message){t.Fatalf("missing %q",tc.message)};if strings.Contains(body,"private upstream error"){t.Fatal("upstream error leaked to public page")}})
 }
}
func TestMalformedPublicProjectionFailsClosed(t *testing.T){
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"secret",Name:"Should not render",Kind:locationui.KindArea,City:"Regina",Latitude:ptr(50)}}}}
 result:=serveTravel(reader)
 if result.Code!=http.StatusBadGateway || strings.Contains(result.Body.String(),"Should not render") {t.Fatalf("unsafe malformed projection: status=%d body=%s",result.Code,result.Body.String())}
}
func ptr(v float64)*float64{return &v}
