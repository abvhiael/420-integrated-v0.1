package travelapp

import (
 "context"
 "errors"
 "html/template"
 "net/http"
 "strconv"
 "strings"
 "time"
)

// savedTripItem displays only titles from the current authorized public feed.
// An absent entry never authorizes a private Location/Events lookup.
type savedTripItem struct { Kind, ID, Title, Notice string; Position int; CanUp, CanDown bool }
type savedTripPage struct { Trip Trip; CSRF, Notice string; Places, Events []savedTripItem }

var savedTripTemplate = template.Must(template.New("savedTrip").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit trip | 420Travel</title><style>body{background:#101913;color:#f2f7f0;font:16px/1.5 system-ui,sans-serif;max-width:54rem;margin:auto;padding:1rem}a{color:#a2e8a4}article{border:1px solid #456b4d;border-radius:.5rem;padding:.8rem;margin:.5rem 0}button,input,select{font:inherit;padding:.4rem}form{display:inline-block;margin:.2rem}label{display:block;margin:.6rem 0}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #a2e8a4}</style></head><body><a href="#main">Skip to content</a><nav><a href="/travel/trips">My trips</a> · <a href="/travel/save">Find places and events</a></nav><main id="main"><h1>Edit {{.Trip.Title}}</h1>{{if .Notice}}<p role="status">{{.Notice}}</p>{{end}}<p>Visibility: {{.Trip.Visibility}}. These are planning references, not bookings or proof of continuing publication.</p><section aria-label="Saved places"><h2>Saved places</h2>{{range .Places}}<article><h3>{{.Title}}</h3>{{if .Notice}}<p role="status">{{.Notice}}</p>{{end}}<form method="post"><input type="hidden" name="csrf_token" value="{{$.CSRF}}"><input type="hidden" name="version" value="{{$.Trip.UpdatedAt.UTC.Format "2006-01-02T15:04:05.999999999Z07:00"}}"><input type="hidden" name="kind" value="place"><input type="hidden" name="ref_id" value="{{.ID}}"><button name="action" value="up" {{if not .CanUp}}disabled{{end}}>Move {{.Title}} up</button><button name="action" value="down" {{if not .CanDown}}disabled{{end}}>Move {{.Title}} down</button><button name="action" value="remove">Remove {{.Title}}</button></form></article>{{else}}<p>No places saved yet. <a href="/travel/save">Find a place to save</a>.</p>{{end}}</section><section aria-label="Saved events"><h2>Saved events</h2>{{range .Events}}<article><h3>{{.Title}}</h3>{{if .Notice}}<p role="status">{{.Notice}}</p>{{end}}<form method="post"><input type="hidden" name="csrf_token" value="{{$.CSRF}}"><input type="hidden" name="version" value="{{$.Trip.UpdatedAt.UTC.Format "2006-01-02T15:04:05.999999999Z07:00"}}"><input type="hidden" name="kind" value="event"><input type="hidden" name="ref_id" value="{{.ID}}"><button name="action" value="up" {{if not .CanUp}}disabled{{end}}>Move {{.Title}} up</button><button name="action" value="down" {{if not .CanDown}}disabled{{end}}>Move {{.Title}} down</button><button name="action" value="remove">Remove {{.Title}}</button></form></article>{{else}}<p>No events saved yet. <a href="/travel/save">Find an event to save</a>.</p>{{end}}</section><p><a href="?mode=details">Edit title, visibility, or saved IDs manually</a></p></main></body></html>`))

func renderSavedTrip(w http.ResponseWriter, page savedTripPage) {
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'")
 _ = savedTripTemplate.Execute(w,page)
}

func savedItems(ids []string, kind string, titles map[string]string, unavailable bool) []savedTripItem {
 result:=make([]savedTripItem,0,len(ids))
 for i,id:=range ids {
  item:=savedTripItem{Kind:kind,ID:id,Position:i,CanUp:i>0,CanDown:i<len(ids)-1}
  if unavailable {item.Title="Saved "+kind;item.Notice="Public service is unavailable. The saved reference has been kept; its current title and publication status cannot be checked."} else if title:=titles[id];title!="" {item.Title=title} else {item.Title="Saved "+kind;item.Notice="This item is not in the current public feed. It may have been withdrawn or may be outside the discovery window. You can keep or remove the saved reference."}
  result=append(result,item)
 }
 return result
}

// HandlerWithSavedTripItems augments the qualified app's trip detail route.
// Unlisted share management and the existing owner-scoped details editor keep
// their original route and protections; cards use the same optimistic version.
func HandlerWithSavedTripItems(reader PublicReader,reviews TravelReviewReader,users TravelUserDependencies,shares TripSharing) http.Handler {
 base:=HandlerWithQualifiedJourneys(reader,reviews,users,shares)
 repo,ok:=users.Trips.(EditableTripRepository)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) {
  const prefix="/travel/trips/"
  if !strings.HasPrefix(r.URL.Path,prefix) || r.URL.Query().Get("mode")=="details" {base.ServeHTTP(w,r);return}
  id:=strings.TrimPrefix(r.URL.Path,prefix)
  if !validPlaceID(id) || strings.Contains(id,"/") {base.ServeHTTP(w,r);return}
  if !ok || users.Identity==nil {http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
  if r.Method!=http.MethodGet&&r.Method!=http.MethodPost {w.Header().Set("Allow","GET, POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  session,err:=authenticated(r,users.Identity);if err!=nil{http.Error(w,"authentication required",http.StatusUnauthorized);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  trip,err:=repo.GetOwned(ctx,session.SubjectID,id)
  if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return};if err!=nil{http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
  if r.Method==http.MethodPost {
   r.Body=http.MaxBytesReader(w,r.Body,4096)
   if err:=r.ParseForm();err!=nil{http.Error(w,"invalid form",http.StatusBadRequest);return}
   if !allowPrivateMutation(r,session){http.Error(w,"invalid request token",http.StatusForbidden);return}
   version,err:=time.Parse(time.RFC3339Nano,r.PostForm.Get("version"))
   if err!=nil||version.IsZero()||!version.Equal(trip.UpdatedAt){http.Error(w,"trip has changed; reload before editing",http.StatusConflict);return}
   kind:=r.PostForm.Get("kind");refID:=r.PostForm.Get("ref_id");action:=r.PostForm.Get("action")
   if !validPlaceID(refID)|| (kind!="place"&&kind!="event") || (action!="up"&&action!="down"&&action!="remove") {http.Error(w,"invalid saved item action",http.StatusBadRequest);return}
   ids:=&trip.PlaceIDs;if kind=="event"{ids=&trip.EventIDs}
   index:=-1;for i,v:=range *ids {if v==refID {index=i;break}}
   if index<0{http.Error(w,"saved item has changed; reload",http.StatusConflict);return}
   switch action {case "remove": *ids=append((*ids)[:index:index],(*ids)[index+1:]...)
   case "up":if index==0{http.Error(w,"item is already first",http.StatusConflict);return};(*ids)[index],(*ids)[index-1]=(*ids)[index-1],(*ids)[index]
   case "down":if index==len(*ids)-1{http.Error(w,"item is already last",http.StatusConflict);return};(*ids)[index],(*ids)[index+1]=(*ids)[index+1],(*ids)[index]}
   if _,err:=repo.Replace(ctx,session.SubjectID,trip);errors.Is(err,ErrTripConflict)||errors.Is(err,ErrTripNotFound){http.Error(w,"trip has changed; reload before editing",http.StatusConflict);return}else if err!=nil{http.Error(w,"trip update unavailable",http.StatusServiceUnavailable);return}
   http.Redirect(w,r,r.URL.Path,http.StatusSeeOther);return
  }
  places:=map[string]string{};events:=map[string]string{};unavailable:=reader==nil
  if !unavailable {
   feed,err:=publicJourneyFeed(r,reader)
   if err!=nil {unavailable=true} else {
    for _,venue:=range feed.Travel {if validPlaceID(venue.Place.ID){places[venue.Place.ID]=venue.Place.Name}}
    for _,event:=range feed.Calendar {if validPlaceID(event.ID){events[event.ID]=event.Title}}
   }
  }
  page:=savedTripPage{Trip:trip,CSRF:session.CSRFToken,Places:savedItems(trip.PlaceIDs,"place",places,unavailable),Events:savedItems(trip.EventIDs,"event",events,unavailable)}
  if unavailable {page.Notice="Current public titles cannot be loaded. Your saved items remain unchanged."}
  renderSavedTrip(w,page)
 })
}

// Avoid accidentally using list order indexes supplied by a client; locate the
// exact saved ID within the owner-authorized trip on every mutation.
var _ = strconv.Itoa
