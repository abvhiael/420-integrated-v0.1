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

// PublicReader is the narrow versioned public-service dependency used by Travel.
type PublicReader = consumers.PublicReader

type pageData struct {
 State string
 Message string
 Venues []consumers.Venue
}

var shell = template.Must(template.New("travel").Parse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>420Travel | 420 Integrated</title>
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif}header,main,footer{max-width:64rem;margin:auto;padding:1.5rem}header{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}a{color:#a2e8a4}nav{display:flex;flex-wrap:wrap;gap:1.2rem}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1}.panel{background:#1e3024;border:1px solid #456b4d;border-radius:.75rem;padding:1.5rem;max-width:48rem}p{max-width:65ch}a:focus-visible{outline:3px solid #a2e8a4;outline-offset:4px}@media(max-width:40rem){header,main,footer{padding:1rem}}</style>
</head><body><header><strong>420Travel</strong><nav aria-label="Travel navigation"><a href="/travel" aria-current="page">Discover</a><a href="/travel/map">Map</a><a href="/travel/events">Events</a><a href="/travel/trips">Trips</a></nav></header>
<main id="main"><h1>Explore somewhere new.</h1><p>Discover public places and upcoming events across the 420 Integrated community.</p>
{{if eq .State "ready"}}<section aria-label="Public places"><h2>Public places</h2>{{range .Venues}}<article class="panel"><h3>{{.Place.Name}}</h3><p>{{.Place.Category}} · {{.Place.City}} {{.Place.Region}} {{.Place.Country}}</p>{{if eq .Place.Kind "area"}}<p>Approximate location — exact coordinates are not published.</p>{{end}}{{if .Events}}<h4>Upcoming events</h4><ul>{{range .Events}}<li>{{.Title}} — <time datetime="{{.StartAt.Format "2006-01-02T15:04:05Z07:00"}}">{{.StartAt.Format "2 Jan 2006 15:04 MST"}}</time></li>{{end}}</ul>{{end}}</article>{{end}}</section>{{else}}<section class="panel" role="status" aria-live="polite"><h2>{{.Message}}</h2>{{if eq .State "disconnected"}}<p>Configure the public Location/Events service to enable discovery. No sample listings are shown as live data.</p>{{else if eq .State "empty"}}<p>No public places are available in this service response.</p>{{else}}<p>Public discovery could not be loaded. No private or cached records are shown.</p>{{end}}</section>{{end}}
<p>420BnB booking and DOOBR transactions are unavailable.</p></main><footer>420Travel · Genesis discovery and trip planning</footer></body></html>`))

// Handler configures public discovery only when an explicit service URL exists.
// No fallback to fixture data or a canonical source is permitted.
func Handler() http.Handler {
 base := strings.TrimSpace(os.Getenv("TRAVEL_PUBLIC_SERVICE_URL"))
 if base == "" { return HandlerWithReader(nil) }
 return HandlerWithReader(sdk.Client{BaseURL: base, HTTP: &http.Client{Timeout: 4 * time.Second}})
}

// HandlerWithReader enables deterministic tests and public-service integration.
func HandlerWithReader(reader PublicReader) http.Handler {
 mux := http.NewServeMux()
 mux.HandleFunc("GET /travel", func(w http.ResponseWriter, r *http.Request) {
  data := pageData{State: "disconnected", Message: "Discovery is not connected yet"}
  if reader != nil {
   ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
   defer cancel()
   now := time.Now().UTC()
   feed, err := loadPublicDiscovery(ctx, reader, sdk.EventQuery{From: now, To: now.Add(30*24*time.Hour), Limit: 100})
   if err != nil { data = pageData{State: "error", Message: "Discovery is temporarily unavailable"} } else if len(feed.Travel) == 0 { data = pageData{State: "empty", Message: "No public places found"} } else { data = pageData{State: "ready", Venues: feed.Travel} }
  }
  w.Header().Set("Content-Type", "text/html; charset=utf-8")
  w.Header().Set("Cache-Control", "no-store")
  w.Header().Set("X-Content-Type-Options", "nosniff")
  if data.State == "error" { w.WriteHeader(http.StatusBadGateway) }
  _ = shell.Execute(w, data)
 })
 return mux
}
