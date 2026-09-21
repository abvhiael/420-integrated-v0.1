package travelapp

import (
 "context"
 "html/template"
 "math"
 "net/http"
 "strconv"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/consumers"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

type publicJourneyPage struct {
 Heading string
 Message string
 Destination string
 Venues []consumers.Venue
 Place locationui.Item
 Events []travelEvent
 ReviewAvailable bool
 SaveAvailable bool
}

var publicJourneyTemplate = template.Must(template.New("publicJourney").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Heading}} | 420Travel</title><style>body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:62rem;margin:auto;padding:1rem}a{color:#a2e8a4}article{padding:1rem;border:1px solid #456b4d;border-radius:.5rem;margin:1rem 0}label{display:block;margin:.5rem 0}input{font:inherit;padding:.4rem}a:focus-visible,input:focus-visible{outline:3px solid #a2e8a4}</style></head><body><a href="#main">Skip to content</a><header><nav aria-label="Travel navigation"><a href="/travel">Discover</a> · <a href="/travel/map">Nearby</a> · <a href="/travel/events">Events</a></nav></header><main id="main"><h1>{{.Heading}}</h1>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}{{if eq .Heading "Nearby discovery"}}<form method="get" action="/travel/map"><label>City or region <input name="destination" maxlength="80" value="{{.Destination}}"></label><button type="submit">Find public places</button></form><p>Text-based nearby discovery by published city or region. Precise-distance search is not available for approximate areas.</p>{{end}}{{if .Place.ID}}<article><h2>{{.Place.Name}}</h2><p>{{.Place.Category}} · {{.Place.City}} {{.Place.Region}} {{.Place.Country}}</p>{{if .SaveAvailable}}<p><a href="/travel/save/place/{{.Place.ID}}">Save {{.Place.Name}} to a trip</a></p>{{end}}{{if eq .Place.Kind "area"}}<p>Approximate area: exact coordinates are not published.</p>{{end}}{{if .ReviewAvailable}}<p><a href="/travel/place/{{.Place.ID}}/reviews">Verified travel reviews</a> (published independently by 420Reputation)</p>{{else}}<p>Registry/Verify ownership and verified travel reviews are not connected; no verification badge is asserted.</p>{{end}}<h3>Upcoming public events</h3>{{if .Events}}<ul>{{range .Events}}<li>{{.Title}} — <time datetime="{{.StartAt.Format "2006-01-02T15:04:05Z07:00"}}">{{.StartAt.Format "2 Jan 2006 15:04 MST"}}</time>{{if and $.SaveAvailable .ID}} · <a href="/travel/save/event/{{.ID}}">Save event to a trip</a>{{end}}</li>{{end}}</ul>{{else}}<p>No upcoming public events in the current feed.</p>{{end}}</article>{{end}}{{range .Venues}}<article><h2><a href="/travel/place/{{.Place.ID}}">{{.Place.Name}}</a></h2><p>{{.Place.Category}} · {{.Place.City}} {{.Place.Region}} {{.Place.Country}}</p>{{if $.SaveAvailable}}<p><a href="/travel/save/place/{{.Place.ID}}">Save {{.Place.Name}} to a trip</a></p>{{end}}{{if eq .Place.Kind "area"}}<p>Approximate area; no precise coordinates displayed.</p>{{end}}{{if .Events}}<h3>Upcoming public events</h3><ul>{{range .Events}}<li>{{.Title}} — {{.StartAt.Format "2 Jan 2006 15:04 MST"}}</li>{{end}}</ul>{{end}}</article>{{end}}<p>420BnB booking and DOOBR transactions are unavailable.</p></main></body></html>`))

func renderPublicJourney(w http.ResponseWriter,status int,data publicJourneyPage) {
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.WriteHeader(status)
 _=publicJourneyTemplate.Execute(w,data)
}

func publicJourneyFeed(r *http.Request, reader PublicReader)(consumers.Feed,error) {
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second)
 defer cancel()
 now:=time.Now().UTC()
 return loadPublicDiscovery(ctx,reader,sdk.EventQuery{From:now,To:now.Add(30*24*time.Hour),Limit:100})
}

func servePublicPlace(w http.ResponseWriter,r *http.Request,reader PublicReader) {servePublicPlaceWithReviews(w,r,reader,false)}

// Place details are resolved only from the freshly authorized public feed.
// An unpublished/withdrawn or malformed place ID never falls back to the
// private canonical repository or a stale saved-trip reference.
func servePublicPlaceWithReviews(w http.ResponseWriter,r *http.Request,reader PublicReader,reviewAvailable bool) {
 id:=r.PathValue("place_id")
 if !validPlaceID(id) {http.NotFound(w,r);return}
 if reader==nil {renderPublicJourney(w,http.StatusServiceUnavailable,publicJourneyPage{Heading:"Place details",Message:"Public places are not connected"});return}
 feed,err:=publicJourneyFeed(r,reader)
 if err!=nil {renderPublicJourney(w,http.StatusBadGateway,publicJourneyPage{Heading:"Place details",Message:"Public places are temporarily unavailable"});return}
 for _,venue:=range feed.Travel {
  if venue.Place.ID!=id {continue}
  page:=publicJourneyPage{Heading:"Place details",Place:venue.Place,ReviewAvailable:reviewAvailable,SaveAvailable:saveLinksAvailable(r)}
  for _,event:=range venue.Events {
   item:=travelEvent{Title:event.Title,StartAt:event.StartAt}
   if validPlaceID(event.ID){item.ID=event.ID}
   page.Events=append(page.Events,item)
  }
  renderPublicJourney(w,http.StatusOK,page);return
 }
 http.NotFound(w,r)
}

// Nearby is explicitly coarse destination search, not a fabricated radius.
func servePublicNearby(w http.ResponseWriter,r *http.Request,reader PublicReader) {
 destination:=strings.TrimSpace(r.URL.Query().Get("destination"))
 page:=publicJourneyPage{Heading:"Nearby discovery",Destination:destination,SaveAvailable:saveLinksAvailable(r)}
 if len(destination)>80||strings.ContainsAny(destination,"\x00\r\n") {page.Message="Invalid destination";renderPublicJourney(w,http.StatusBadRequest,page);return}
 if reader==nil {page.Message="Public places are not connected";renderPublicJourney(w,http.StatusServiceUnavailable,page);return}
 feed,err:=publicJourneyFeed(r,reader)
 if err!=nil {page.Message="Public discovery is temporarily unavailable";renderPublicJourney(w,http.StatusBadGateway,page);return}
 for _,venue:=range feed.Travel {
  if !validPlaceID(venue.Place.ID) {continue}
  if destination==""||matchesDestination(venue.Place,destination) {page.Venues=append(page.Venues,venue)}
 }
 if len(page.Venues)==0 {page.Message="No public places matched this destination"}
 renderPublicJourney(w,http.StatusOK,page)
}

// Coarse public areas must never receive an inferred precise location.
func validPublicPinCoordinates(lat,lon string)bool {
 latitude,e1:=strconv.ParseFloat(lat,64);longitude,e2:=strconv.ParseFloat(lon,64)
 return e1==nil&&e2==nil&&!math.IsNaN(latitude)&&!math.IsNaN(longitude)&&!math.IsInf(latitude,0)&&!math.IsInf(longitude,0)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180
}
