// Package travelapp serves public GEN-SVC-3 Travel discovery.
// It never reads canonical/private Location or Events repositories.
package travelapp

import (
 "context"
 "html/template"
 "net/http"
 "os"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/consumers"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
)

type PublicReader = consumers.PublicReader

type pageData struct {
 Route string
 Heading string
 State string
 Message string
 Venues []consumers.Venue
 Events []travelEvent
 Date string
 Destination string
}

var shell = template.Must(template.New("travel").Funcs(template.FuncMap{"cannabisPlaceLabels": cannabisPlaceLabels, "cannabisEventLabels": cannabisEventLabels}).Parse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Heading}} | 420Travel</title>
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif}header,main,footer{max-width:64rem;margin:auto;padding:1.5rem}header{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}a{color:#a2e8a4}nav{display:flex;flex-wrap:wrap;gap:1.2rem}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1}.panel{background:#1e3024;border:1px solid #456b4d;border-radius:.75rem;padding:1.5rem;max-width:48rem}p{max-width:65ch}a:focus-visible{outline:3px solid #a2e8a4;outline-offset:4px}nav a[aria-current="page"]{font-weight:700;text-decoration-thickness:3px}input,button{font:inherit;padding:.5rem;border-radius:.25rem}form{display:flex;flex-wrap:wrap;gap:.75rem;align-items:end;margin:1rem 0}label{display:grid;gap:.25rem}@media(max-width:40rem){header,main,footer{padding:1rem}}</style>
</head><body><a href="#main">Skip to content</a><header><strong>420Travel</strong><nav aria-label="Travel navigation"><a href="/travel" {{if eq .Route "discover"}}aria-current="page"{{end}}>Discover</a><a href="/travel/map" {{if eq .Route "map"}}aria-current="page"{{end}}>Map</a><a href="/travel/events" {{if eq .Route "events"}}aria-current="page"{{end}}>Events</a><a href="/travel/trips" {{if eq .Route "trips"}}aria-current="page"{{end}}>Trips</a><a href="/travel/business/claim" {{if eq .Route "claim"}}aria-current="page"{{end}}>Business claim</a></nav></header>
<main id="main"><h1>{{.Heading}}</h1>{{if eq .Route "discover"}}<p>Discover public places and upcoming events across the 420 Integrated community.</p>
{{if eq .State "ready"}}<section aria-label="Public places"><h2>Public places</h2>{{range .Venues}}<article class="panel"><h3>{{.Place.Name}}</h3><p>{{.Place.Category}} · {{.Place.City}} {{.Place.Region}} {{.Place.Country}}</p>{{range cannabisPlaceLabels .Place.Category}}<p>{{.}}</p>{{end}}{{if eq .Place.Kind "area"}}<p>Approximate location — exact coordinates are not published.</p>{{end}}{{if .Events}}<h4>Upcoming events</h4><ul>{{range .Events}}<li>{{.Title}} — <time datetime="{{.StartAt.Format "2006-01-02T15:04:05Z07:00"}}">{{.StartAt.Format "2 Jan 2006 15:04 MST"}}</time>{{range cannabisEventLabels .Tags}} · {{.}}{{end}}</li>{{end}}</ul>{{end}}</article>{{end}}</section>{{else}}<section class="panel" role="status" aria-live="polite"><h2>{{.Message}}</h2>{{if eq .State "disconnected"}}<p>Configure the public Location/Events service to enable discovery. No sample listings are shown as live data.</p>{{else if eq .State "empty"}}<p>No public places are available in this service response.</p>{{else}}<p>Public discovery could not be loaded. No private or cached records are shown.</p>{{end}}</section>{{end}}
{{else if eq .Route "events"}}<p>Public events in the next 30 days. Date and destination filters only use the public Location/Events service.</p><form method="get" action="/travel/events"><label>Date (UTC)<input type="date" name="date" value="{{.Date}}"></label><label>Destination (city or region)<input name="destination" maxlength="80" value="{{.Destination}}"></label><button type="submit">Filter events</button></form>
{{if eq .State "ready"}}<section aria-label="Public events"><h2>Upcoming events</h2>{{range .Events}}<article class="panel"><h3>{{.Title}}</h3><p><time datetime="{{.StartAt.Format "2006-01-02T15:04:05Z07:00"}}">{{.StartAt.Format "2 Jan 2006 15:04 MST"}}</time></p>{{if .PlaceName}}<p>At {{if .PlaceURL}}<a href="{{.PlaceURL}}">{{.PlaceName}}</a>{{else}}{{.PlaceName}}{{end}} · {{.City}} {{.Region}}</p>{{else}}<p>No public venue is specified.</p>{{end}}{{range .Attributes}}<p>{{.}}</p>{{end}}</article>{{end}}</section>{{else}}<section class="panel" role="status" aria-live="polite"><h2>{{.Message}}</h2>{{if eq .State "disconnected"}}<p>Connect the public Location/Events service to browse events.</p>{{else if eq .State "empty"}}<p>No public events matched these filters.</p>{{else if eq .State "invalid"}}<p>Choose a UTC date within the next 30 days and a destination of at most 80 characters.</p>{{else}}<p>Public events could not be loaded. No private or cached records are shown.</p>{{end}}</section>{{end}}<p>Saving events to trips, ticketing and organizer provenance are not connected in this build.</p>
{{else}}<section class="panel" role="status"><h2>{{.Message}}</h2><p>This route is a navigation shell only. Its data, permissions and actions are not connected; no private or sample records are shown.</p><p><a href="/travel">Return to discovery</a></p></section>{{end}}
<p>Public category and event-tag labels are descriptive only. They do not verify cannabis-friendly status, onsite consumption permission, licensing, legal compliance, access or availability; check local rules and confirm directly with the venue or organizer.</p><p>420BnB booking and DOOBR transactions are unavailable.</p></main><footer>420Travel · Genesis discovery and trip planning</footer></body></html>`))

// Handler configures public discovery only when an explicit service URL exists.
func Handler() http.Handler {
 base := strings.TrimSpace(os.Getenv("TRAVEL_PUBLIC_SERVICE_URL"))
 if base == "" { return HandlerWithReader(nil) }
 return HandlerWithReader(sdk.Client{BaseURL: base, HTTP: &http.Client{Timeout: 4 * time.Second}})
}

// HandlerWithReader enables deterministic tests and public-service integration.
func HandlerWithReader(reader PublicReader) http.Handler {
 mux := http.NewServeMux()
 mux.HandleFunc("GET /travel", func(w http.ResponseWriter, r *http.Request) {
  data := pageData{Route: "discover", Heading: "Explore somewhere new.", State: "disconnected", Message: "Discovery is not connected yet"}
  if reader != nil {
   ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
   defer cancel()
   now := time.Now().UTC()
   feed, err := loadPublicDiscovery(ctx, reader, sdk.EventQuery{From: now, To: now.Add(30*24*time.Hour), Limit: 100})
   if err != nil { data.State = "error"; data.Message = "Discovery is temporarily unavailable" } else if len(feed.Travel) == 0 { data.State = "empty"; data.Message = "No public places found" } else { data.State = "ready"; data.Venues = feed.Travel }
  }
  status := http.StatusOK
  if data.State == "error" { status = http.StatusBadGateway }
  renderPage(w, status, data)
 })
 mux.HandleFunc("GET /travel/events", func(w http.ResponseWriter, r *http.Request) { serveTravelEvents(w, r, reader) })
 for _, route := range []struct{path, key, heading string}{
  {"/travel/map", "map", "Explore the map"},
  {"/travel/trips", "trips", "Your trips"},
  {"/travel/business/claim", "claim", "Claim a business"},
 } {
  route := route
  mux.HandleFunc("GET "+route.path, func(w http.ResponseWriter, r *http.Request) {
   renderPage(w, http.StatusServiceUnavailable, pageData{Route: route.key, Heading: route.heading, Message: "This feature is not available yet"})
  })
 }
 mux.HandleFunc("GET /travel/place/{place_id}", func(w http.ResponseWriter, r *http.Request) {
  if !validPlaceID(r.PathValue("place_id")) { http.NotFound(w, r); return }
  renderPage(w, http.StatusServiceUnavailable, pageData{Route: "place", Heading: "Place details", Message: "This place page is not available yet"})
 })
 return mux
}

func validPlaceID(id string) bool {
 if len(id) < 1 || len(id) > 128 { return false }
 for _, char := range id {
  if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '-' || char == '_') { return false }
 }
 return true
}

func renderPage(w http.ResponseWriter, status int, data pageData) {
 w.Header().Set("Content-Type", "text/html; charset=utf-8")
 w.Header().Set("Cache-Control", "no-store")
 w.Header().Set("X-Content-Type-Options", "nosniff")
 w.WriteHeader(status)
 _ = shell.Execute(w, data)
}
