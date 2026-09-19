// Package travelapp serves the Genesis 420Travel application shell.
// Live public discovery integration is intentionally deferred to GEN-SVC-3.2.
package travelapp

import (
    "html/template"
    "net/http"
)

var shell = template.Must(template.New("travel").Parse(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>420Travel | 420 Integrated</title>
<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif}header,main,footer{max-width:64rem;margin:auto;padding:1.5rem}header{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}a{color:#a2e8a4}nav{display:flex;flex-wrap:wrap;gap:1.2rem}h1{font-size:clamp(2rem,6vw,3.4rem);line-height:1.1}.panel{background:#1e3024;border:1px solid #456b4d;border-radius:.75rem;padding:1.5rem;max-width:48rem}p{max-width:65ch}a:focus-visible{outline:3px solid #a2e8a4;outline-offset:4px}@media(max-width:40rem){header,main,footer{padding:1rem}}</style>
</head><body><header><strong>420Travel</strong><nav aria-label="Travel navigation"><a href="/travel" aria-current="page">Discover</a><a href="/travel/map">Map</a><a href="/travel/events">Events</a><a href="/travel/trips">Trips</a></nav></header>
<main id="main"><h1>Explore somewhere new.</h1><p>Find places, public events and future trips across the 420 Integrated community.</p><section class="panel" aria-live="polite"><h2>Discovery is not connected yet</h2><p>The Travel application shell is available. Live destinations, maps, events, reviews and saved trips are not enabled in this build. No sample listing is presented as real data.</p><p>420BnB booking and DOOBR transactions are unavailable.</p></section></main><footer>420Travel · Genesis discovery and trip planning</footer></body></html>`))

// Handler returns the Travel shell and fails closed for routes that do not yet exist.
// It does not contact canonical repositories or expose any private location data.
func Handler() http.Handler {
    mux := http.NewServeMux()
    mux.HandleFunc("GET /travel", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        w.Header().Set("Cache-Control", "no-store")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        if err := shell.Execute(w, nil); err != nil { return }
    })
    return mux
}
