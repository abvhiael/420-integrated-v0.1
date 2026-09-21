package travelapp

import (
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func getEvents(reader PublicReader, path string) *httptest.ResponseRecorder {
 result:=httptest.NewRecorder()
 HandlerWithReader(reader).ServeHTTP(result,httptest.NewRequest(http.MethodGet,path,nil))
 return result
}

func TestEventsShowsOnlyPublicVenueLinksAndStandaloneEvents(t *testing.T) {
 start:=time.Now().UTC().Add(2*time.Hour)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"regina-1",Name:"Green & Public",Kind:locationui.KindArea,City:"Regina",Region:"Saskatchewan"}}},events:eventui.View{Items:[]eventui.Card{
  {ID:"visible",Title:"Public <festival>",PlaceID:"regina-1",StartAt:start},
  {ID:"standalone",Title:"Online gathering",StartAt:start},
  {ID:"private",Title:"Private gathering",PlaceID:"private-venue",StartAt:start},
  {ID:"past",Title:"Past public event",PlaceID:"regina-1",StartAt:time.Now().UTC().Add(-time.Hour)},
 }}}
 result:=getEvents(reader,"/travel/events")
 if result.Code!=http.StatusOK {t.Fatalf("status=%d body=%s",result.Code,result.Body.String())}
 body:=result.Body.String()
 for _,want:=range []string{"Public &lt;festival&gt;","Online gathering","Green &amp; Public","href=\"/travel/place/regina-1\"","No public venue is specified.","aria-current=\"page\""} {if !strings.Contains(body,want){t.Errorf("missing %q",want)}}
 for _,secret:=range []string{"Private gathering","private-venue","Past public event","regina-1\" data-"} {if strings.Contains(body,secret){t.Errorf("leaked %q",secret)}}
 if reader.query.Limit!=100||reader.query.To.Sub(reader.query.From)>30*24*time.Hour||reader.query.From.IsZero(){t.Fatalf("unbounded query %+v",reader.query)}
}

func TestEventsDestinationFiltersUsingOnlyPublishedVenues(t *testing.T){
 start:=time.Now().UTC().Add(2*time.Hour)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"regina",Name:"Regina venue",Kind:locationui.KindArea,City:"Regina"},{ID:"calgary",Name:"Calgary venue",Kind:locationui.KindArea,City:"Calgary"}}},events:eventui.View{Items:[]eventui.Card{{ID:"one",Title:"Regina event",PlaceID:"regina",StartAt:start},{ID:"two",Title:"Calgary event",PlaceID:"calgary",StartAt:start},{ID:"three",Title:"Standalone event",StartAt:start}}}}
 result:=getEvents(reader,"/travel/events?destination=regINA")
 if result.Code!=http.StatusOK||!strings.Contains(result.Body.String(),"Regina event"){t.Fatalf("destination query failed: %d %s",result.Code,result.Body.String())}
 for _,no:=range []string{"Calgary event","Standalone event","Calgary venue"}{if strings.Contains(result.Body.String(),no){t.Errorf("destination filter exposed %q",no)}}
 empty:=getEvents(reader,"/travel/events?destination=Toronto")
 if empty.Code!=http.StatusOK||!strings.Contains(empty.Body.String(),"No public events found"){t.Fatalf("missing empty filtered state: %d %s",empty.Code,empty.Body.String())}
}

func TestEventsDateValidationAndWindow(t *testing.T){
 for _,path:=range []string{"/travel/events?date=bad","/travel/events?date=2020-01-01","/travel/events?date=2999-01-01","/travel/events?destination="+strings.Repeat("x",81)} {
  result:=getEvents(nil,path)
  if result.Code!=http.StatusBadRequest||!strings.Contains(result.Body.String(),"Invalid event filters"){t.Fatalf("invalid filter %q: %d %s",path,result.Code,result.Body.String())}
 }
 reader:=&stubPublicReader{}
 day:=time.Now().UTC().Add(48*time.Hour).Format("2006-01-02")
 result:=getEvents(reader,"/travel/events?date="+day)
 if result.Code!=http.StatusOK {t.Fatalf("date status=%d",result.Code)}
 if reader.query.To.Sub(reader.query.From)>24*time.Hour||reader.query.Limit!=100||reader.query.From.IsZero(){t.Fatalf("invalid selected-day query %+v",reader.query)}
}

func TestEventsDisconnectedAndUpstreamErrorsFailClosed(t *testing.T){
 disconnected:=getEvents(nil,"/travel/events")
 if disconnected.Code!=http.StatusOK||!strings.Contains(disconnected.Body.String(),"Events are not connected yet"){t.Fatalf("disconnected response: %d %s",disconnected.Code,disconnected.Body.String())}
 for _,reader:=range []*stubPublicReader{{placesErr:errors.New("secret upstream error")},{eventsErr:errors.New("secret upstream error")}} {
  result:=getEvents(reader,"/travel/events")
  if result.Code!=http.StatusBadGateway||!strings.Contains(result.Body.String(),"Events are temporarily unavailable")||strings.Contains(result.Body.String(),"secret upstream error"){t.Fatalf("unsafe upstream response: %d %s",result.Code,result.Body.String())}
 }
}
