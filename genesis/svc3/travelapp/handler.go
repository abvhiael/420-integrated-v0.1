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
}

var shell = template.Must(template.New("travel").Parse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Heading}} | 420Travel</title>
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif}header,main,footer{max-width:64rem;margin:auto;padding:1.5rem}header{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}a{color:#a2e8a4}nav{display:flex;flex-wrap:wrap;gap:1.2rem}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1}.panel{background:#1e3024;border:1px solid #456b4d;border-radius:.75rem;padding:1.5rem;max-width:48rem}p{max-width:65ch}a:focus-visible{outline:3px solid #a2e8a4;outline-offset:4px}nav a[aria-current="page"]{font-weight:700;text-decoration-thickness:3px}@media(max-width:40rem){header,main,footer{padding:1rem}}</style>
</head><body><a href="#main">Skip to content</a><header><strong>420Travel</strong><nav aria-label="Travel navigation"><a href="/travel" {{if eq .Route "discover"}}aria-current="page"{{end}}>Discover</a><a href="/travel/map" {{if eq .Route "map"}}aria-current="page"{{end}}>Map</a><a href="/travel/events" {{if eq .Route "events"}}aria-current="page"{{end}}>Events</a><a href="/travel/trips" {{if eq .Route "trips"}}aria-current="page"{{end}}>Trips</a><a href="/travel/business/claim" {{if eq .Route "claim"}}aria-current="page"{{end}}>Business claim</a></nav></header>
<main id="main"><h1>{{.Heading}}</h1>{{if eq .Route "discover"}}<p>Discover public places and upcoming events across the 420 Integrated community.</p>
{{if eq .State "ready"}}<section aria-label="Public places"><h2>Public places</h2>{{range .Venues}}<article class="panel"><h3>{{.Place.Name}}</h3><p>{{.Place.Category}} · {{.Place.City}} {{.Place.Region}} {{.Place.Country}}</p>{{if eq .Place.Kind "area"}}<p>Approximate location — exact coordinates are not published.</p>{{end}}{{if .Events}}<h4>Upcoming events</h4><ul>{{range .Events}}<li>{{.Title}} — <time datetime="{{.StartAt.Format "2006-01-02T15:04:05Z07:00"}}">{{.StartAt.Format "2 Jan 2006 15:04 MST"}}</time></li>{{end}}</ul>{{end}}</article>{{end}}</section>{{else}}<section class="panel" role="status" aria-live="polite"><h2>{{.Message}}</h2>{{if eq .State "disconnected"}}<p>Configure the public Location/Events service to enable discovery. No sample listings are shown as live data.</p>{{else if eq .State "empty"}}<p>No public places are available in this service response.</p>{{else}}<p>Public discovery could not be loaded. No private or cached records are shown.</p>{{end}}</section>{{end}}
{{else}}<section class="panel" role="status"><h2>{{.Message}}</h2><p>This route is a navigation shell only. Its data, permissions and actions are not connected; no private or sample records are shown.</p><p><a href="/travel">Return to discovery</a></p></section>{{end}}
<p>420BnB booking and DOOBR transactions are unavailable.</p></main><footer>420Travel · Genesis discovery and trip planning</footer></body></html>`))

// Handler configures public discovery only when an explicit service URL exists.
func Handler() http.Handler {
 base := strings.TrimSpace(os.Getenv("TRAVEL_PUBLIC_SERVICE_URL"))
 if base == "" { return HandlerWithReader(nil) }
 return HandlerWithReader(sdk.Client{BaseURL: base, HTTP: &http.Client{Timeout: 4 * time.Second}})
}

// HandlerWithReader enables deterministic tests and public-service integration.
// Planned routes are navigable but return 503 until their service journeys exist.
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
 for _, route := range []struct{path, key, heading string}{
  {"/travel/map", "map", "Explore the map"},
  {"/travel/events", "events", "Discover events"},
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
  // Do not use an unverified URL identifier to look up a private place.
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
