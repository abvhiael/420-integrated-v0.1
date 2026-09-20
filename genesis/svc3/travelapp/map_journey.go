package travelapp

import (
 "html/template"
 "math"
 "net/http"
 "strings"

 "github.com/420integrated/420-integrated/genesis/svc2/consumers"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

// travelMapPin is a projected exact-public coordinate, not an inferred location.
type travelMapPin struct { ID, Name string; X, Y float64 }
type travelMapEntry struct { Place locationui.Item; Events []string }
type travelMapPage struct { Destination, Category, Message string; Entries []travelMapEntry; Pins []travelMapPin }

var travelMapTemplate = template.Must(template.New("travelMap").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nearby discovery | 420Travel</title><style>*,*:before,*:after{box-sizing:border-box}body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:70rem;margin:auto;padding:1rem}a{color:#a2e8a4}form{display:flex;flex-wrap:wrap;gap:1rem}label{display:grid;gap:.25rem}input,button{font:inherit;padding:.4rem}article{padding:1rem;border:1px solid #456b4d;border-radius:.5rem;margin:1rem 0}a:focus-visible,input:focus-visible,button:focus-visible{outline:3px solid #a2e8a4}svg{width:100%;height:auto;border:1px solid #456b4d;background:#1e3024}svg circle{fill:#a2e8a4;stroke:#101913;stroke-width:1.5}</style></head><body><a href="#main">Skip to content</a><nav aria-label="Travel navigation"><a href="/travel">Discover</a> · <a href="/travel/events">Events</a></nav><main id="main"><h1>Nearby discovery</h1><form method="get" action="/travel/map"><label>City or region<input name="destination" maxlength="80" value="{{.Destination}}"></label><label>Category<input name="category" maxlength="80" value="{{.Category}}"></label><button>Filter published places</button></form><p>This is a world-coordinate overview, not a street map or a distance-to-venue estimate. Only explicitly published exact coordinates appear as dots. Approximate areas appear in the list only. No device location is collected.</p>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}{{if .Pins}}<section aria-label="Public exact-coordinate overview"><h2>Public pin overview</h2><svg viewBox="0 0 1000 500" role="img" aria-label="World coordinate overview of published exact-location places; see the accessible place list for names"><path d="M0 250H1000 M500 0V500" stroke="#456b4d" stroke-width="1" fill="none"/>{{range .Pins}}<a href="/travel/place/{{.ID}}" aria-label="Place: {{.Name}}"><circle cx="{{.X}}" cy="{{.Y}}" r="5"><title>{{.Name}}</title></circle></a>{{end}}</svg></section>{{end}}<section aria-label="Published places"><h2>Matching places</h2>{{range .Entries}}<article><h3><a href="/travel/place/{{.Place.ID}}">{{.Place.Name}}</a></h3><p>{{.Place.Category}} · {{.Place.City}} {{.Place.Region}} {{.Place.Country}}</p>{{if eq .Place.Kind "area"}}<p>Approximate area — no exact location or distance published.</p>{{else}}<p>Exact-public location.</p>{{end}}{{if .Events}}<h4>Upcoming public events</h4><ul>{{range .Events}}<li>{{.}}</li>{{end}}</ul>{{end}}</article>{{else}}<p>No public places match these filters.</p>{{end}}</section><p>420BnB bookings and DOOBR transactions are unavailable.</p></main></body></html>`))

func renderTravelMap(w http.ResponseWriter,status int,page travelMapPage){
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'")
 w.WriteHeader(status);_ = travelMapTemplate.Execute(w,page)
}

// HandlerWithNearbyMap is a public, opt-in enhancement of the standard Travel
// handler. Every request re-reads the current public projection, so withdrawn
// places and events are not retained as stale map/list results.
func HandlerWithNearbyMap(reader PublicReader) http.Handler {
 base:=HandlerWithReader(reader)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/travel/map" {base.ServeHTTP(w,r);return}
  if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  serveTravelNearbyMap(w,r,reader)
 })
}

func serveTravelNearbyMap(w http.ResponseWriter,r *http.Request,reader PublicReader){
 destination:=strings.TrimSpace(r.URL.Query().Get("destination"))
 category:=strings.TrimSpace(r.URL.Query().Get("category"))
 page:=travelMapPage{Destination:destination,Category:category}
 if len(destination)>80||len(category)>80||strings.ContainsAny(destination+category,"\x00\r\n") {page.Message="Invalid search filter";renderTravelMap(w,http.StatusBadRequest,page);return}
 if reader==nil {page.Message="Public discovery is not connected";renderTravelMap(w,http.StatusServiceUnavailable,page);return}
 feed,err:=publicJourneyFeed(r,reader)
 if err!=nil {page.Message="Public discovery is temporarily unavailable";renderTravelMap(w,http.StatusBadGateway,page);return}
 if len(feed.Travel)>500 {page.Message="Public discovery exceeds the map result limit";renderTravelMap(w,http.StatusBadGateway,page);return}
 for _,venue:=range feed.Travel {
  place:=venue.Place
  if !validPlaceID(place.ID)||!matchesTravelMapFilters(place,destination,category){continue}
  entry:=travelMapEntry{Place:place}
  // The public projection includes only public events. Do not render event IDs,
  // credentials, organizer information or hidden canonical Location records.
  for _,event:=range venue.Events {if len(entry.Events)<100 {entry.Events=append(entry.Events,event.Title)}}
  if place.Kind==locationui.KindPin && place.Latitude!=nil && place.Longitude!=nil {
   lat,lon:=*place.Latitude,*place.Longitude
   if !math.IsNaN(lat)&&!math.IsNaN(lon)&&!math.IsInf(lat,0)&&!math.IsInf(lon,0)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180 {
    page.Pins=append(page.Pins,travelMapPin{ID:place.ID,Name:place.Name,X:(lon+180)/360*1000,Y:(90-lat)/180*500})
   }
  }
  page.Entries=append(page.Entries,entry)
 }
 renderTravelMap(w,http.StatusOK,page)
}

func matchesTravelMapFilters(place locationui.Item,destination,category string)bool {
 if destination!=""&&!matchesDestination(place,destination){return false}
 return category==""||strings.EqualFold(strings.TrimSpace(string(place.Category)),category)
}

var _ = consumers.Feed{} // Keep the nearby route coupled to the public discovery contract.
