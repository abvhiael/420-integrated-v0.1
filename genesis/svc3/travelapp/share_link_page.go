package travelapp

import (
 "context"
 "errors"
 "html/template"
 "net/http"
 "strings"
 "time"
)

// Share links are bearer credentials: only the initiating owner receives the
// raw token, in this POST response. No GET endpoint retrieves an issued token.
type issuedSharePage struct {Title, URL, CSRF, TripID string; Expires time.Time}
var issuedShareTemplate=template.Must(template.New("issuedShare").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New sharing link | 420Travel</title><style>body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:46rem;margin:auto;padding:1rem}a{color:#a2e8a4}input{width:100%;font:inherit;padding:.5rem}button{font:inherit;padding:.5rem}a:focus-visible,input:focus-visible,button:focus-visible{outline:3px solid #a2e8a4}</style></head><body><main><h1>New sharing link for {{.Title}}</h1><p role="status">This link is shown only now. Copy the path below and share it only with people you want to see your unlisted trip. A recipient who has the link can open it without signing in.</p><label for="share-url">Private sharing path</label><input id="share-url" readonly value="{{.URL}}" aria-describedby="share-expiry"><p id="share-expiry">Expires {{.Expires.UTC.Format "2 Jan 2006 15:04 UTC"}}. It can stop working earlier if the trip becomes private, its public references are withdrawn, or you revoke the links.</p><p>Copy this path and append it to the trusted Travel website address. Do not paste it into public posts, analytics or search listings. If you lose this link, create a new one; the old token cannot be displayed again.</p><form method="post" action="/travel/trips/{{.TripID}}/revoke-shares"><input type="hidden" name="csrf_token" value="{{.CSRF}}"><button type="submit">Revoke all sharing links</button></form><p><a href="/travel/trips/{{.TripID}}">Return to trip</a></p></main></body></html>`))

// serveIssuedShareLink is mounted only by HandlerWithQualifiedJourneys. The
// existing HandlerWithTripSharing keeps its text/plain interface for clients.
func serveIssuedShareLink(w http.ResponseWriter,r *http.Request,users TravelUserDependencies,shares TripSharing) {
 if r.Method!=http.MethodPost {w.Header().Set("Allow","POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
 if users.Identity==nil||shares.Trips==nil||shares.Grants==nil||shares.Published==nil {http.Error(w,"sharing unavailable",http.StatusServiceUnavailable);return}
 const prefix="/travel/trips/"
 raw:=strings.TrimPrefix(r.URL.Path,prefix)
 if !strings.HasPrefix(r.URL.Path,prefix)||!strings.HasSuffix(raw,"/share") {http.NotFound(w,r);return}
 id:=strings.TrimSuffix(raw,"/share")
 if !validPlaceID(id) {http.NotFound(w,r);return}
 session,err:=authenticated(r,users.Identity);if err!=nil {http.Error(w,"authentication required",http.StatusUnauthorized);return}
 r.Body=http.MaxBytesReader(w,r.Body,4096)
 if err:=r.ParseForm();err!=nil {http.Error(w,"invalid form",http.StatusBadRequest);return}
 if !allowPrivateMutation(r,session) {http.Error(w,"invalid request token",http.StatusForbidden);return}
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
 trip,err:=shares.Trips.GetOwned(ctx,session.SubjectID,id)
 if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return}
 if err!=nil {http.Error(w,"sharing unavailable",http.StatusServiceUnavailable);return}
 token,err:=shares.Issue(ctx,session.SubjectID,id)
 if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return}
 if err!=nil {http.Error(w,"sharing unavailable",http.StatusServiceUnavailable);return}
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Pragma","no-cache")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("X-Robots-Tag","noindex, nofollow, noarchive")
 w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'")
 _=issuedShareTemplate.Execute(w,issuedSharePage{Title:trip.Title,URL:"/travel/shared/"+token,TripID:id,CSRF:session.CSRFToken,Expires:shares.now().Add(7*24*time.Hour)})
}
