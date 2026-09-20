package travelapp

import (
 "html/template"
 "net/http"
)

type saveCatalogPage struct { Places []saveCatalogItem; Events []saveCatalogItem }
type saveCatalogItem struct { ID, Name string }
var saveCatalogTemplate=template.Must(template.New("saveCatalog").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Find a place or event to save | 420Travel</title><style>body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:45rem;margin:auto;padding:1rem}a{color:#a2e8a4}a:focus-visible{outline:3px solid #a2e8a4}</style></head><body><a href="#main">Skip to content</a><nav><a href="/travel">Discover</a> · <a href="/travel/trips">My trips</a></nav><main id="main"><h1>Save a published place or event</h1><p>Choose a currently published item, then choose the trip where you want to save it.</p><section><h2>Places</h2><ul>{{range .Places}}<li><a href="/travel/save/place/{{.ID}}">Save {{.Name}} to a trip</a></li>{{else}}<li>No public places available.</li>{{end}}</ul></section><section><h2>Upcoming events</h2><ul>{{range .Events}}<li><a href="/travel/save/event/{{.ID}}">Save {{.Name}} to a trip</a></li>{{else}}<li>No published upcoming events available.</li>{{end}}</ul></section></main></body></html>`))

func serveSaveCatalog(w http.ResponseWriter,r *http.Request,reader PublicReader,users TravelUserDependencies){
 if r.Method!=http.MethodGet{w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
 if users.Identity==nil||users.Trips==nil||reader==nil{http.Error(w,"saving unavailable",http.StatusServiceUnavailable);return}
 if _,err:=authenticated(r,users.Identity);err!=nil{http.Error(w,"authentication required",http.StatusUnauthorized);return}
 feed,err:=publicJourneyFeed(r,reader);if err!=nil{http.Error(w,"public discovery unavailable",http.StatusBadGateway);return}
 page:=saveCatalogPage{}
 for _,venue:=range feed.Travel{if validPlaceID(venue.Place.ID){page.Places=append(page.Places,saveCatalogItem{ID:venue.Place.ID,Name:venue.Place.Name})}}
 for _,event:=range feed.Calendar{if validPlaceID(event.ID){page.Events=append(page.Events,saveCatalogItem{ID:event.ID,Name:event.Title})}}
 w.Header().Set("Content-Type","text/html; charset=utf-8");w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Referrer-Policy","no-referrer");w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'")
 _=saveCatalogTemplate.Execute(w,page)
}
