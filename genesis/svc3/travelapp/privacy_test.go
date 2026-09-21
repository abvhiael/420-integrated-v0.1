package travelapp

import (
 "context"
 "errors"
 "net/http"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

type changingPublicReader struct {
 views []locationui.View
 calls int
 eventView eventui.View
 latestErr error
}
func (s *changingPublicReader) Places(context.Context) (locationui.View,error) {
 s.calls++
 if s.calls == 2 && s.latestErr != nil { return locationui.View{}, s.latestErr }
 if s.calls > len(s.views) { return locationui.View{}, errors.New("unexpected public place read") }
 return s.views[s.calls-1],nil
}
func (s *changingPublicReader) Events(context.Context,sdk.EventQuery) (eventui.View,error) { return s.eventView,nil }

func TestTravelFailsClosedWhenPlaceBecomesUnavailableMidRequest(t *testing.T) {
 initial:=locationui.View{Items:[]locationui.Item{{ID:"revoked-venue",Name:"Revoked venue private name",Kind:locationui.KindArea,City:"Regina"}}}
 cases:=[]struct{name string;latest locationui.View;latestErr error}{
  {name:"place removed from public projection",latest:locationui.View{}},
  {name:"place changes to a different public projection",latest:locationui.View{Items:[]locationui.Item{{ID:"revoked-venue",Name:"Changed public name",Kind:locationui.KindArea,City:"Regina"}}}},
  {name:"second public read fails",latestErr:errors.New("private upstream visibility fault")},
 }
 for _,tc:=range cases { t.Run(tc.name,func(t *testing.T){
  reader:=&changingPublicReader{views:[]locationui.View{initial,tc.latest},latestErr:tc.latestErr,eventView:eventui.View{Items:[]eventui.Card{{ID:"old-event",Title:"Revoked private event title",PlaceID:"revoked-venue",StartAt:time.Now().UTC().Add(time.Hour)}}}}
  response:=serveTravel(reader)
  if response.Code!=http.StatusBadGateway { t.Fatalf("status %d, expected 502",response.Code) }
  if reader.calls!=2 {t.Fatalf("expected second public-place read, got %d",reader.calls)}
  for _,secret:=range []string{"Revoked venue private name","Revoked private event title","revoked-venue","private upstream visibility fault"} {if strings.Contains(response.Body.String(),secret){t.Fatalf("leaked %q",secret)}}
 }) }
}
func TestTravelRecheckKeepsStableAreaApproximate(t *testing.T) {
 stable:=locationui.View{Items:[]locationui.Item{{ID:"area-1",Name:"Approximate venue",Kind:locationui.KindArea,City:"Regina"}}}
 reader:=&changingPublicReader{views:[]locationui.View{stable,stable},eventView:eventui.View{Items:[]eventui.Card{{ID:"event-1",Title:"Public event",PlaceID:"area-1",StartAt:time.Now().UTC().Add(time.Hour)}}}}
 response:=serveTravel(reader)
 if response.Code!=http.StatusOK {t.Fatalf("status %d",response.Code)}
 for _,want:=range []string{"Approximate venue","Approximate location","Public event"}{if !strings.Contains(response.Body.String(),want){t.Fatalf("missing %q",want)}}
 if reader.calls!=2 {t.Fatalf("expected second public-place read, got %d",reader.calls)}
}
