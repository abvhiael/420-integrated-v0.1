package travelapp

import (
 "context"
 "net/http"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/consumers"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

// travelEvent holds only published event fields and the matching public venue.
// Neither raw event/place IDs nor canonical private records are rendered.
type travelEvent struct {
 Title string
 StartAt time.Time
 PlaceName string
 PlaceURL string
 City string
 Region string
 Attributes []string
}

func serveTravelEvents(w http.ResponseWriter, r *http.Request, reader PublicReader) {
 data := pageData{Route:"events", Heading:"Discover events", State:"disconnected", Message:"Events are not connected yet"}
 data.Date = r.URL.Query().Get("date")
 data.Destination = strings.TrimSpace(r.URL.Query().Get("destination"))
 now := time.Now().UTC()
 from, to := now, now.Add(30*24*time.Hour)
 if len(data.Destination)>80 || strings.ContainsAny(data.Destination,"\x00\r\n") {
  data.State="invalid"; data.Message="Invalid event filters"; renderPage(w,http.StatusBadRequest,data); return
 }
 if data.Date!="" {
  day, err:=time.Parse("2006-01-02",data.Date)
  if err!=nil || day.Before(now.Truncate(24*time.Hour)) || day.After(now.Add(30*24*time.Hour)) {
   data.State="invalid"; data.Message="Invalid event filters"; renderPage(w,http.StatusBadRequest,data); return
  }
  from=day
  if from.Before(now) {from=now}
  to=day.Add(24*time.Hour)
  if ceiling:=now.Add(30*24*time.Hour);to.After(ceiling) {to=ceiling}
  if !to.After(from) {data.State="invalid"; data.Message="Invalid event filters"; renderPage(w,http.StatusBadRequest,data);return}
 }
 if reader==nil {renderPage(w,http.StatusOK,data);return}
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second)
 defer cancel()
 feed,err:=loadPublicDiscovery(ctx,reader,sdk.EventQuery{From:from,To:to,Limit:100})
 if err!=nil {data.State="error";data.Message="Events are temporarily unavailable";renderPage(w,http.StatusBadGateway,data);return}
 byID:=make(map[string]locationui.Item,len(feed.Travel))
 for _,venue:=range feed.Travel {byID[venue.Place.ID]=venue.Place}
 data.Events=make([]travelEvent,0,len(feed.Calendar))
 for _,event:=range feed.Calendar {
  if event.StartAt.Before(from)||!event.StartAt.Before(to) {continue}
  item:=travelEvent{Title:event.Title,StartAt:event.StartAt,Attributes:cannabisEventLabels(event.Tags)}
  if event.PlaceID!="" {
   place,ok:=byID[event.PlaceID]
   if !ok {continue} // A removed/private venue must not be inferred from the event.
   if data.Destination!="" && !matchesDestination(place,data.Destination) {continue}
   item.PlaceName=place.Name
   item.City=place.City
   item.Region=place.Region
   if validPlaceID(place.ID) {item.PlaceURL="/travel/place/"+place.ID}
  } else if data.Destination!="" {continue} // Standalone event has no verified destination.
  data.Events=append(data.Events,item)
 }
 if len(data.Events)==0 {data.State="empty";data.Message="No public events found"} else {data.State="ready"}
 renderPage(w,http.StatusOK,data)
}

func matchesDestination(place locationui.Item, term string) bool {
 term=strings.ToLower(strings.TrimSpace(term))
 return strings.Contains(strings.ToLower(place.City),term)||strings.Contains(strings.ToLower(place.Region),term)||strings.Contains(strings.ToLower(place.Country),term)
}

// Compile-time assertion that the route only depends on the shared public adapter.
var _ consumers.PublicReader = sdk.Client{}
