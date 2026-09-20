package travelapp

import (
 "context"
 "html/template"
 "net/http"
 "time"
)

type qualifiedTripListPage struct {
 CSRF string
 Trips []Trip
 ShareReady bool
}

var qualifiedTripListTemplate=template.Must(template.New("qualifiedTrips").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My trips | 420Travel</title><style>body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:54rem;margin:auto;padding:1rem}a{color:#a2e8a4}article{border:1px solid #456b4d;border-radius:.5rem;margin:1rem 0;padding:1rem}button,input,select{font:inherit;padding:.4rem}label{display:block;margin:.5rem 0}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #a2e8a4}</style></head><body><a href="#main">Skip to content</a><nav><a href="/travel">Travel</a> · <a href="/travel/map">Map</a> · <a href="/travel/business/claim">Business claim</a></nav><main id="main"><h1>My trips</h1><form method="post" action="/travel/trips"><input type="hidden" name="csrf_token" value="{{.CSRF}}"><label>Trip title <input name="title" maxlength="160" required></label><label>Visibility <select name="visibility"><option value="PRIVATE">Private</option><option value="UNLISTED">Unlisted</option><option value="PUBLIC">Public</option></select></label><button type="submit">Create trip</button></form><p><a href="/travel/save">Find a public place or event to save to a trip</a></p><section aria-label="Saved trips">{{range .Trips}}<article><h2>{{.Title}}</h2><p>Visibility: {{.Visibility}}</p><p><a href="/travel/trips/{{.ID}}">Edit saved places, events and trip details</a></p>{{if and $.ShareReady (eq .Visibility "UNLISTED")}}<form method="post" action="/travel/trips/{{.ID}}/share"><input type="hidden" name="csrf_token" value="{{$.CSRF}}"><button type="submit">Create seven-day sharing link</button></form><form method="post" action="/travel/trips/{{.ID}}/revoke-shares"><input type="hidden" name="csrf_token" value="{{$.CSRF}}"><button type="submit">Revoke all sharing links</button></form>{{end}}</article>{{else}}<p>No trips saved.</p>{{end}}</section><p>Sharing links are bearer credentials; send them only to intended recipients. Publishing a trip does not establish that referenced places or events remain public.</p></main></body></html>`))

// serveQualifiedTripList is only called by the composition entrypoint when a
// verified Identity and an editable, owner-scoped repository are injected.
// The older create handler retains POST, including its CSRF enforcement.
func serveQualifiedTripList(w http.ResponseWriter,r *http.Request,deps TravelUserDependencies,shares TripSharing){
 repo,ok:=deps.Trips.(EditableTripRepository)
 if deps.Identity==nil||!ok {http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
 session,err:=authenticated(r,deps.Identity)
 if err!=nil {http.Error(w,"authentication required",http.StatusUnauthorized);return}
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
 trips,err:=repo.ListOwned(ctx,session.SubjectID)
 if err!=nil {http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'")
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 _=qualifiedTripListTemplate.Execute(w,qualifiedTripListPage{CSRF:session.CSRFToken,Trips:trips,ShareReady:shares.Trips!=nil&&shares.Grants!=nil&&shares.Published!=nil})
}
