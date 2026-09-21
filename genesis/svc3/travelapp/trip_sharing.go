package travelapp

import (
 "context"
 "crypto/rand"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "errors"
 "net/http"
 "strings"
 "time"
)

var ErrTripShareUnavailable=errors.New("trip sharing unavailable")

// TripShareGrantStore persists only SHA-256 token hashes, never bearer tokens.
// Deployments must use a shared durable store, not a per-process map.
type TripShareGrantStore interface {
 Issue(context.Context,string,string,string,time.Time) error // owner, trip ID, token hash, expiry
 Revoke(context.Context,string,string) error // owner, trip ID: all links
 Resolve(context.Context,string)(string,string,error) // token hash -> owner, trip ID
}

// PublishedTripVerifier must check current PUBLIC place/event projections on
// *every anonymous read*. A nil verifier disables all public/shared reads.
// Returning nil means every referenced item is currently authorized for
// publication; it must not infer authorization from a saved trip ID.
type PublishedTripVerifier interface { VerifyPublishedTrip(context.Context,Trip) error }

type TripSharing struct {
 Trips EditableTripRepository
 Grants TripShareGrantStore
 Published PublishedTripVerifier
 Now func()time.Time
}
func (s TripSharing) now()time.Time {if s.Now!=nil{return s.Now().UTC()};return time.Now().UTC()}
func (s TripSharing) Issue(ctx context.Context,owner,id string)(string,error){
 if s.Trips==nil||s.Grants==nil||s.Published==nil||authorizedTripOwner(owner)!=nil||!validPlaceID(id){return "",ErrTripShareUnavailable}
 t,err:=s.Trips.GetOwned(ctx,owner,id);if err!=nil{return "",err};if t.Visibility!=TripUnlisted{return "",ErrTripShareUnavailable}
 // A grant must not be created when an upstream item has already been
 // withdrawn or current publication cannot be verified. Resolve rechecks.
 if err=s.Published.VerifyPublishedTrip(ctx,t);err!=nil{return "",ErrTripShareUnavailable}
 var secret [32]byte;if _,err=rand.Read(secret[:]);err!=nil{return "",ErrTripShareUnavailable}
 token:=hex.EncodeToString(secret[:]);sum:=sha256.Sum256([]byte(token))
 if err=s.Grants.Issue(ctx,owner,id,hex.EncodeToString(sum[:]),s.now().Add(7*24*time.Hour));err!=nil{return "",ErrTripShareUnavailable}
 return token,nil
}
func (s TripSharing) Revoke(ctx context.Context,owner,id string)error {
 if s.Trips==nil||s.Grants==nil||authorizedTripOwner(owner)!=nil||!validPlaceID(id){return ErrTripShareUnavailable}
 if _,err:=s.Trips.GetOwned(ctx,owner,id);err!=nil{return err}
 return s.Grants.Revoke(ctx,owner,id)
}
func (s TripSharing) Resolve(ctx context.Context,token string)(Trip,error){
 if s.Trips==nil||s.Grants==nil||s.Published==nil||len(token)!=64 {return Trip{},ErrTripNotFound}
 raw,err:=hex.DecodeString(token);if err!=nil||len(raw)!=32 {return Trip{},ErrTripNotFound}
 canonical:=hex.EncodeToString(raw);if subtle.ConstantTimeCompare([]byte(token),[]byte(canonical))!=1{return Trip{},ErrTripNotFound}
 sum:=sha256.Sum256([]byte(token));owner,id,err:=s.Grants.Resolve(ctx,hex.EncodeToString(sum[:]));if err!=nil||authorizedTripOwner(owner)!=nil||!validPlaceID(id){return Trip{},ErrTripNotFound}
 trip,err:=s.Trips.GetOwned(ctx,owner,id);if err!=nil||trip.Visibility!=TripUnlisted{return Trip{},ErrTripNotFound}
 if err:=s.Published.VerifyPublishedTrip(ctx,trip);err!=nil{return Trip{},ErrTripNotFound}
 trip.OwnerID="";return trip,nil
}

// HandlerWithTripSharing is opt-in and wraps the existing editing journey.
// It never creates an anonymous public-trip route; that requires separately
// authorized PUBLIC projection and independent publication qualification.
func HandlerWithTripSharing(reader PublicReader,deps TravelUserDependencies,shares TripSharing)http.Handler {
 base:=HandlerWithTripEditing(reader,deps)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("Referrer-Policy","no-referrer")
  w.Header().Set("Cache-Control","no-store")
  if strings.HasPrefix(r.URL.Path,"/travel/shared/"){
   if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
   token:=strings.TrimPrefix(r.URL.Path,"/travel/shared/");ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
   trip,err:=shares.Resolve(ctx,token);if err!=nil{http.NotFound(w,r);return}
   w.Header().Set("Content-Type","text/plain; charset=utf-8")
   w.Header().Set("X-Content-Type-Options","nosniff")
   // Deliberately do not disclose saved IDs until an independently reviewed
   // public presentation projects current place/event metadata.
   _,_=w.Write([]byte("Shared trip: "+trip.Title+"\n"));return
  }
  const prefix="/travel/trips/"
  if !strings.HasPrefix(r.URL.Path,prefix)||(!strings.HasSuffix(r.URL.Path,"/share")&&!strings.HasSuffix(r.URL.Path,"/revoke-shares")){base.ServeHTTP(w,r);return}
  if r.Method!=http.MethodPost{w.Header().Set("Allow","POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  if deps.Identity==nil||shares.Trips==nil||shares.Grants==nil||shares.Published==nil{http.Error(w,"sharing unavailable",http.StatusServiceUnavailable);return}
  session,err:=authenticated(r,deps.Identity);if err!=nil{http.Error(w,"authentication required",http.StatusUnauthorized);return}
  r.Body=http.MaxBytesReader(w,r.Body,4096);if err:=r.ParseForm();err!=nil{http.Error(w,"invalid form",http.StatusBadRequest);return}
  if !allowPrivateMutation(r,session){http.Error(w,"invalid request token",http.StatusForbidden);return}
  raw:=strings.TrimPrefix(r.URL.Path,prefix);id:=strings.TrimSuffix(strings.TrimSuffix(raw,"/revoke-shares"),"/share")
  if !validPlaceID(id)||strings.Contains(id,"/"){http.NotFound(w,r);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  if strings.HasSuffix(raw,"/revoke-shares"){
   if err:=shares.Revoke(ctx,session.SubjectID,id);err!=nil{http.NotFound(w,r);return}
   http.Redirect(w,r,"/travel/trips/"+id,http.StatusSeeOther);return
  }
  token,err:=shares.Issue(ctx,session.SubjectID,id);if err!=nil{if errors.Is(err,ErrTripNotFound){http.NotFound(w,r)}else{http.Error(w,"sharing unavailable",http.StatusServiceUnavailable)};return}
  w.Header().Set("Content-Type","text/plain; charset=utf-8");w.Header().Set("X-Content-Type-Options","nosniff")
  _,_=w.Write([]byte("/travel/shared/"+token+"\n"))
 })
}
