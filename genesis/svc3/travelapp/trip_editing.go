package travelapp

import (
 "context"
 "errors"
 "html/template"
 "net/http"
 "strings"
 "time"
)

// EditableTripRepository extends the create/list contract without enabling
// private routes in the default public Travel handler.
type EditableTripRepository interface {
 TripRepository
 GetOwned(context.Context,string,string)(Trip,error)
 Replace(context.Context,string,Trip)(Trip,error)
 Delete(context.Context,string,string)error
}

type editTripPage struct { Trip Trip; CSRF string; Message string }
var editTripTemplate=template.Must(template.New("editTrip").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edit trip | 420Travel</title></head><body><main><h1>Edit trip</h1>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}<p><a href="/travel/trips">My trips</a></p><form method="post"><input type="hidden" name="csrf_token" value="{{.CSRF}}"><input type="hidden" name="version" value="{{.Trip.UpdatedAt.UTC.Format "2006-01-02T15:04:05.999999999Z07:00"}}"><label>Title <input name="title" maxlength="160" required value="{{.Trip.Title}}"></label><label>Visibility <select name="visibility"><option value="PRIVATE" {{if eq .Trip.Visibility "PRIVATE"}}selected{{end}}>Private</option><option value="UNLISTED" {{if eq .Trip.Visibility "UNLISTED"}}selected{{end}}>Unlisted (sharing unavailable)</option><option value="PUBLIC" {{if eq .Trip.Visibility "PUBLIC"}}selected{{end}}>Public</option></select></label><label>Saved place IDs (one per line)<textarea name="place_ids" rows="5">{{range .Trip.PlaceIDs}}{{.}}
{{end}}</textarea></label><label>Saved event IDs (one per line)<textarea name="event_ids" rows="5">{{range .Trip.EventIDs}}{{.}}
{{end}}</textarea></label><button name="action" value="save" type="submit">Save changes</button><button name="action" value="delete" type="submit">Delete trip</button></form><p>Saved IDs are planning references, not proof that a place or event remains public or bookable. Unlisted sharing is unavailable.</p></main></body></html>`))

func renderTripEdit(w http.ResponseWriter,status int,page editTripPage){
 w.Header().Set("Content-Type","text/html; charset=utf-8");w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff");w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("Content-Security-Policy","default-src 'none'; form-action 'self'; base-uri 'none'")
 w.WriteHeader(status);_ = editTripTemplate.Execute(w,page)
}

func tripReferenceLines(raw string)([]string,error){
 if len(raw)>16000{return nil,ErrTripInvalid}
 lines:=strings.Split(strings.ReplaceAll(raw,"\r\n","\n"),"\n")
 result:=make([]string,0,len(lines));seen:=make(map[string]bool)
 for _,line:=range lines{
  id:=strings.TrimSpace(line);if id==""{continue}
  if !validPlaceID(id)||seen[id]||len(result)>=100{return nil,ErrTripInvalid}
  seen[id]=true;result=append(result,id)
 }
 return result,nil
}

// HandlerWithTripEditing offers an opt-in owner-scoped editing journey. It
// delegates every other path to the existing private/public route composition.
// The caller must supply trusted Identity and an editable persistent repository.
func HandlerWithTripEditing(reader PublicReader,deps TravelUserDependencies)http.Handler {
 base:=HandlerWithUserDependencies(reader,deps)
 repo,ok:=deps.Trips.(EditableTripRepository)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  const prefix="/travel/trips/"
  if !strings.HasPrefix(r.URL.Path,prefix){base.ServeHTTP(w,r);return}
  id:=strings.TrimPrefix(r.URL.Path,prefix)
  if !validPlaceID(id)||strings.Contains(id,"/"){http.NotFound(w,r);return}
  if !ok||deps.Identity==nil{http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
  if r.Method!=http.MethodGet&&r.Method!=http.MethodPost{w.Header().Set("Allow","GET, POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  session,err:=authenticated(r,deps.Identity);if err!=nil{http.Error(w,"authentication required",http.StatusUnauthorized);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  original,err:=repo.GetOwned(ctx,session.SubjectID,id)
  if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return};if err!=nil{http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
  if r.Method==http.MethodGet{renderTripEdit(w,http.StatusOK,editTripPage{Trip:original,CSRF:session.CSRFToken});return}
  r.Body=http.MaxBytesReader(w,r.Body,20000)
  if err:=r.ParseForm();err!=nil{http.Error(w,"invalid form",http.StatusBadRequest);return}
  if !allowPrivateMutation(r,session){http.Error(w,"invalid request token",http.StatusForbidden);return}
  version,err:=time.Parse(time.RFC3339Nano,r.PostForm.Get("version"))
  if err!=nil||version.IsZero()||!version.Equal(original.UpdatedAt){http.Error(w,"trip has changed; reload before editing",http.StatusConflict);return}
  switch r.PostForm.Get("action"){
  case "delete":
   if err:=repo.Delete(ctx,session.SubjectID,id);errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return}else if err!=nil{http.Error(w,"trip deletion unavailable",http.StatusServiceUnavailable);return}
   http.Redirect(w,r,"/travel/trips",http.StatusSeeOther)
  case "save":
   places,err:=tripReferenceLines(r.PostForm.Get("place_ids"));if err!=nil{http.Error(w,"invalid saved place IDs",http.StatusBadRequest);return}
   events,err:=tripReferenceLines(r.PostForm.Get("event_ids"));if err!=nil{http.Error(w,"invalid saved event IDs",http.StatusBadRequest);return}
   original.Title=strings.TrimSpace(r.PostForm.Get("title"));original.Visibility=TripVisibility(r.PostForm.Get("visibility"));original.PlaceIDs=places;original.EventIDs=events
   if err:=validateTrip(original);err!=nil{http.Error(w,"invalid trip",http.StatusBadRequest);return}
   if _,err:=repo.Replace(ctx,session.SubjectID,original);errors.Is(err,ErrTripConflict){http.Error(w,"trip has changed; reload before editing",http.StatusConflict);return}else if errors.Is(err,ErrTripNotFound){http.NotFound(w,r);return}else if err!=nil{http.Error(w,"trip update unavailable",http.StatusServiceUnavailable);return}
   http.Redirect(w,r,r.URL.Path,http.StatusSeeOther)
  default:http.Error(w,"invalid action",http.StatusBadRequest)
  }
 })
}

var _ EditableTripRepository = (*SQLTripRepository)(nil)
var _ EditableTripRepository = (*DurableTripStore)(nil)
