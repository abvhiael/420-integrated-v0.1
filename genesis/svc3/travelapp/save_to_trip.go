package travelapp

import (
 "context"
 "errors"
 "html/template"
 "net/http"
 "strings"
 "time"
)

// The save journey is opt-in. A private trip is never created or modified from
// a public request without independent Identity authentication and CSRF.
type saveToTripPage struct { Kind, RefID, Name, CSRF, Message string; Trips []Trip }
var saveToTripTemplate=template.Must(template.New("saveToTrip").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Save to trip | 420Travel</title><style>body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:45rem;margin:auto;padding:1rem}a{color:#a2e8a4}input,select,button{font:inherit;padding:.5rem}label{display:block;margin:1rem 0}a:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid #a2e8a4}</style></head><body><a href="#main">Skip to content</a><nav><a href="/travel">Discover</a> · <a href="/travel/trips">My trips</a></nav><main id="main"><h1>Save to a trip</h1>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}<p>{{.Name}}</p>{{if .Trips}}<form method="post"><input type="hidden" name="csrf_token" value="{{.CSRF}}"><label>Choose one of your trips <select name="trip_id" required>{{range .Trips}}<option value="{{.ID}}">{{.Title}}</option>{{end}}</select></label><button type="submit">Save {{.Kind}} to trip</button></form>{{else}}<p>Create a trip first, then return to this public listing to save it.</p><p><a href="/travel/trips">Create a trip</a></p>{{end}}<p>Saving an ID does not publish a private trip or guarantee continued availability of the place or event.</p></main></body></html>`))

func renderSaveToTrip(w http.ResponseWriter,status int,page saveToTripPage){
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'")
 w.WriteHeader(status);_ = saveToTripTemplate.Execute(w,page)
}

// HandlerWithSaveToTrip wraps the existing qualified routes. It never exposes
// a save action on the default public-only Travel server.
func HandlerWithSaveToTrip(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies,shares TripSharing)http.Handler {
 base:=HandlerWithQualifiedJourneys(reader,reviews,users,shares)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  const prefix="/travel/save/"
  if !strings.HasPrefix(r.URL.Path,prefix){base.ServeHTTP(w,r);return}
  parts:=strings.Split(strings.TrimPrefix(r.URL.Path,prefix),"/")
  if len(parts)!=2 || (parts[0]!="place"&&parts[0]!="event") || !validPlaceID(parts[1]){http.NotFound(w,r);return}
  if r.Method!=http.MethodGet&&r.Method!=http.MethodPost{w.Header().Set("Allow","GET, POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  repo,ok:=users.Trips.(EditableTripRepository)
  if !ok||users.Identity==nil||reader==nil{http.Error(w,"saving unavailable",http.StatusServiceUnavailable);return}
  session,err:=authenticated(r,users.Identity)
  if err!=nil{http.Error(w,"authentication required",http.StatusUnauthorized);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  if r.Method==http.MethodPost{
   r.Body=http.MaxBytesReader(w,r.Body,4096)
   if err:=r.ParseForm();err!=nil{http.Error(w,"invalid form",http.StatusBadRequest);return}
   if !allowPrivateMutation(r,session){http.Error(w,"invalid request token",http.StatusForbidden);return}
  }
  // Never authorize by a saved ID or an earlier GET. Reload the trusted
  // public projection for *each* POST, including after a place is withdrawn.
  feed,err:=publicJourneyFeed(r,reader)
  if err!=nil{http.Error(w,"public discovery unavailable",http.StatusBadGateway);return}
  name:=""
  for _,venue:=range feed.Travel {
   if parts[0]=="place"&&venue.Place.ID==parts[1] {name=venue.Place.Name;break}
  }
  if parts[0]=="event" {
   for _,event:=range feed.Calendar {if event.ID==parts[1] {name=event.Title;break}}
  }
  if name==""{http.NotFound(w,r);return}
  page:=saveToTripPage{Kind:parts[0],RefID:parts[1],Name:name,CSRF:session.CSRFToken}
  if r.Method==http.MethodGet {
   page.Trips,err=repo.ListOwned(ctx,session.SubjectID)
   if err!=nil{http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
   renderSaveToTrip(w,http.StatusOK,page);return
  }
  tripID:=r.PostForm.Get("trip_id")
  if !validPlaceID(tripID){http.NotFound(w,r);return}
  trip,err:=repo.GetOwned(ctx,session.SubjectID,tripID)
  if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return};if err!=nil{http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
  ids:=&trip.PlaceIDs;if parts[0]=="event"{ids=&trip.EventIDs}
  for _,existing:=range *ids {if existing==parts[1]{http.Redirect(w,r,"/travel/trips/"+tripID,http.StatusSeeOther);return}}
  if len(*ids)>=100{http.Error(w,"trip reference limit reached",http.StatusConflict);return}
  *ids=append(*ids,parts[1])
  if _,err:=repo.Replace(ctx,session.SubjectID,trip);errors.Is(err,ErrTripConflict){http.Error(w,"trip changed; retry",http.StatusConflict);return}else if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return}else if err!=nil{http.Error(w,"trip update unavailable",http.StatusServiceUnavailable);return}
  http.Redirect(w,r,"/travel/trips/"+tripID,http.StatusSeeOther)
 })
}
