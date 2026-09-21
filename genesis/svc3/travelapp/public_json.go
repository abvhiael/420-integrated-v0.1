package travelapp

import (
 "context"
 "encoding/json"
 "net/http"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

// The JSON API deliberately copies an allowlist of public fields rather than
// serializing upstream models, which may acquire nonpublic fields in the future.
type publicJSONPlace struct {
 ID string `json:"id"`
 Name string `json:"name"`
 Category string `json:"category"`
 City string `json:"city"`
 Region string `json:"region"`
 Country string `json:"country"`
 Approximate bool `json:"approximate"`
}
type publicJSONEvent struct {
 ID string `json:"id"`
 Title string `json:"title"`
 StartsAt time.Time `json:"starts_at"`
 PlaceID string `json:"place_id,omitempty"`
 PlaceName string `json:"place_name,omitempty"`
 City string `json:"city,omitempty"`
 Region string `json:"region,omitempty"`
}
type publicJSONResponse struct {
 State string `json:"state"`
 Places []publicJSONPlace `json:"places,omitempty"`
 Events []publicJSONEvent `json:"events,omitempty"`
}
func writePublicJSON(w http.ResponseWriter, code int, response publicJSONResponse) {
 w.Header().Set("Content-Type", "application/json; charset=utf-8")
 w.Header().Set("Cache-Control", "no-store")
 w.Header().Set("X-Content-Type-Options", "nosniff")
 w.WriteHeader(code)
 _ = json.NewEncoder(w).Encode(response)
}
func validPublicDestination(term string) bool {
 return len(term)<=80 && !strings.ContainsAny(term,"\x00\r\n")
}

// WithPublicJSON adds only two anonymous GET endpoints. No authentication,
// mutation, private repository or third-party map data is exposed.
func WithPublicJSON(next http.Handler, reader PublicReader) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
  if r.URL.Path!="/travel/api/v1/places" && r.URL.Path!="/travel/api/v1/events" {next.ServeHTTP(w,r);return}
  if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");writePublicJSON(w,http.StatusMethodNotAllowed,publicJSONResponse{State:"method_not_allowed"});return}
  term:=strings.TrimSpace(r.URL.Query().Get("destination"))
  if !validPublicDestination(term) {writePublicJSON(w,http.StatusBadRequest,publicJSONResponse{State:"invalid"});return}
  now:=time.Now().UTC()
  from,to:=now,now.Add(30*24*time.Hour)
  if r.URL.Path=="/travel/api/v1/events" && r.URL.Query().Get("date")!="" {
   day,err:=time.Parse("2006-01-02",r.URL.Query().Get("date"))
   if err!=nil || day.Before(now.Truncate(24*time.Hour)) || day.After(now.Add(30*24*time.Hour)) {writePublicJSON(w,http.StatusBadRequest,publicJSONResponse{State:"invalid"});return}
   from=day
   if from.Before(now) {from=now}
   to=day.Add(24*time.Hour)
   if ceiling:=now.Add(30*24*time.Hour);to.After(ceiling) {to=ceiling}
   if !to.After(from) {writePublicJSON(w,http.StatusBadRequest,publicJSONResponse{State:"invalid"});return}
  }
  if reader==nil {writePublicJSON(w,http.StatusServiceUnavailable,publicJSONResponse{State:"disconnected"});return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  feed,err:=loadPublicDiscovery(ctx,reader,sdk.EventQuery{From:from,To:to,Limit:100})
  if err!=nil {writePublicJSON(w,http.StatusBadGateway,publicJSONResponse{State:"unavailable"});return}
  response:=publicJSONResponse{State:"empty"}
  if r.URL.Path=="/travel/api/v1/places" {
   response.Places=make([]publicJSONPlace,0,len(feed.Travel))
   for _,venue:=range feed.Travel {
    place:=venue.Place
    if !validPlaceID(place.ID) || term!=""&&!matchesDestination(place,term) {continue}
    response.Places=append(response.Places,publicJSONPlace{ID:place.ID,Name:place.Name,Category:place.Category,City:place.City,Region:place.Region,Country:place.Country,Approximate:place.Kind==locationui.KindArea})
   }
   if len(response.Places)>0 {response.State="ready"}
  } else {
   response.Events=make([]publicJSONEvent,0,len(feed.Calendar))
   places:=make(map[string]locationui.Item,len(feed.Travel))
   for _,venue:=range feed.Travel {if validPlaceID(venue.Place.ID) {places[venue.Place.ID]=venue.Place}}
   for _,event:=range feed.Calendar {
    if !event.StartAt.Before(to)||event.StartAt.Before(from)||!validPlaceID(event.ID) {continue}
    item:=publicJSONEvent{ID:event.ID,Title:event.Title,StartsAt:event.StartAt}
    if event.PlaceID!="" {
     place,ok:=places[event.PlaceID];if !ok {continue}
     if term!=""&&!matchesDestination(place,term) {continue}
     item.PlaceID=place.ID;item.PlaceName=place.Name;item.City=place.City;item.Region=place.Region
    } else if term!="" {continue}
    response.Events=append(response.Events,item)
   }
   if len(response.Events)>0 {response.State="ready"}
  }
  writePublicJSON(w,http.StatusOK,response)
 })
}
