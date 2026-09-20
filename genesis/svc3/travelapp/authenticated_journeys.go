package travelapp

import (
 "context"
 "crypto/rand"
 "crypto/subtle"
 "encoding/hex"
 "errors"
 "html/template"
 "net/http"
 "net/url"
 "strings"
 "time"
)

// VerifiedSession is supplied by the trusted deployment's Identity/session
// adapter, never by an unsigned browser header, form field or query parameter.
// CSRFToken must be an unpredictable per-session secret. The default Handler()
// deliberately does not supply an adapter or expose these routes.
type VerifiedSession struct { SubjectID string; CSRFToken string }
type TravelIdentity interface { Authenticate(*http.Request)(VerifiedSession,error) }

// Only durable, tenant-scoped implementations should be used in deployment.
// The in-process stores from GEN-SVC-3.7/3.8 satisfy these interfaces for
// deterministic development tests, not production persistence.
type TripRepository interface {
 Create(context.Context,string,Trip)(Trip,error)
 ListOwned(context.Context,string)([]Trip,error)
}
type ClaimRepository interface {
 Submit(context.Context,string,PlaceClaim)(PlaceClaim,error)
 GetOwned(context.Context,string,string)(PlaceClaim,error)
}

type TravelUserDependencies struct {
 Identity TravelIdentity
 Trips TripRepository
 Claims ClaimRepository
}

var privateJourneyTemplate=template.Must(template.New("privateJourney").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{.Heading}} | 420Travel</title></head><body><nav><a href="/travel">Travel</a> · <a href="/travel/trips">My trips</a> · <a href="/travel/business/claim">Business claim</a></nav><main><h1>{{.Heading}}</h1>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}{{if eq .Heading "Your trips"}}<form method="post" action="/travel/trips"><input type="hidden" name="csrf_token" value="{{.CSRFToken}}"><label>Trip title <input name="title" maxlength="160" required></label><label>Visibility <select name="visibility"><option value="PRIVATE">Private</option><option value="UNLISTED">Unlisted (sharing unavailable)</option><option value="PUBLIC">Public</option></select></label><button type="submit">Create trip</button></form><section aria-label="My trips">{{range .Trips}}<article><h2>{{.Title}}</h2><p>{{.Visibility}}</p></article>{{else}}<p>No trips saved.</p>{{end}}</section>{{else if eq .Heading "Business claim"}}<p>A request does not grant place-page editing, Registry, Verify or review authority.</p><form method="post" action="/travel/business/claim"><input type="hidden" name="csrf_token" value="{{.CSRFToken}}"><label>Public place ID <input name="place_id" maxlength="128" required></label><label>Registry record ID <input name="registry_record_id" maxlength="256" required></label><label>Provenance evidence reference <input name="evidence_ref" maxlength="512" required></label><button type="submit">Submit for review</button></form>{{end}}</main></body></html>`))

type privateJourneyData struct { Heading string; Message string; CSRFToken string; Trips []Trip }
func renderPrivateJourney(w http.ResponseWriter,status int,page privateJourneyData){
 w.Header().Set("Content-Type","text/html; charset=utf-8");w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff");w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("Content-Security-Policy","default-src 'none'; form-action 'self'; base-uri 'none'")
 w.WriteHeader(status);_=privateJourneyTemplate.Execute(w,page)
}
func authenticated(r *http.Request,identity TravelIdentity)(VerifiedSession,error){
 if identity==nil{return VerifiedSession{},ErrTripUnauthorized}
 session,err:=identity.Authenticate(r)
 if err!=nil||strings.TrimSpace(session.SubjectID)==""||len(session.CSRFToken)<32{return VerifiedSession{},ErrTripUnauthorized}
 return session,nil
}
func allowPrivateMutation(r *http.Request,session VerifiedSession)bool {
 if origin:=r.Header.Get("Origin");origin!="" {
  parsed,err:=url.Parse(origin)
  expectedScheme:="http";if r.TLS!=nil {expectedScheme="https"}
  if err!=nil||parsed.Scheme!=expectedScheme||parsed.Host!=r.Host||parsed.User!=nil||parsed.RawQuery!=""||parsed.Fragment!=""||parsed.Path!="" {return false}
 }
 if len(session.CSRFToken)<32||len(r.PostFormValue("csrf_token"))!=len(session.CSRFToken){return false}
 return subtle.ConstantTimeCompare([]byte(r.PostFormValue("csrf_token")),[]byte(session.CSRFToken))==1
}
func randomTravelID()(string,error){var b [16]byte;if _,err:=rand.Read(b[:]);err!=nil{return "",err};return hex.EncodeToString(b[:]),nil}

// HandlerWithUserDependencies provides injectable E2E journeys. The public
// Handler() does NOT enable them until real session, durable repository,
// provenance and operational security adapters are deployed and qualified.
func HandlerWithUserDependencies(reader PublicReader,deps TravelUserDependencies)http.Handler {
 public:=HandlerWithReader(reader)
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/travel/trips"&&r.URL.Path!="/travel/business/claim" {public.ServeHTTP(w,r);return}
  if r.Method!=http.MethodGet&&r.Method!=http.MethodPost {w.Header().Set("Allow","GET, POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  if deps.Identity==nil||deps.Trips==nil||deps.Claims==nil {public.ServeHTTP(w,r);return}
  session,err:=authenticated(r,deps.Identity)
  if err!=nil {http.Error(w,"authentication required",http.StatusUnauthorized);return}
  if r.URL.Path=="/travel/trips" {serveAuthenticatedTrips(w,r,session,deps.Trips);return}
  serveAuthenticatedClaim(w,r,session,reader,deps.Claims)
 })
}

func serveAuthenticatedTrips(w http.ResponseWriter,r *http.Request,session VerifiedSession,repo TripRepository){
 page:=privateJourneyData{Heading:"Your trips",CSRFToken:session.CSRFToken}
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
 if r.Method==http.MethodPost {
  r.Body=http.MaxBytesReader(w,r.Body,4096)
  if err:=r.ParseForm();err!=nil {renderPrivateJourney(w,http.StatusBadRequest,privateJourneyData{Heading:"Your trips",Message:"Invalid trip form"});return}
  if !allowPrivateMutation(r,session) {http.Error(w,"invalid request token",http.StatusForbidden);return}
  id,err:=randomTravelID();if err!=nil {http.Error(w,"trip creation unavailable",http.StatusServiceUnavailable);return}
  _,err=repo.Create(ctx,session.SubjectID,Trip{ID:id,Title:strings.TrimSpace(r.PostForm.Get("title")),Visibility:TripVisibility(r.PostForm.Get("visibility"))})
  if err!=nil {renderPrivateJourney(w,http.StatusBadRequest,privateJourneyData{Heading:"Your trips",Message:"Trip could not be created"});return}
  http.Redirect(w,r,"/travel/trips",http.StatusSeeOther);return
 }
 trips,err:=repo.ListOwned(ctx,session.SubjectID)
 if err!=nil {http.Error(w,"trips unavailable",http.StatusServiceUnavailable);return}
 page.Trips=trips
 renderPrivateJourney(w,http.StatusOK,page)
}
func serveAuthenticatedClaim(w http.ResponseWriter,r *http.Request,session VerifiedSession,reader PublicReader,repo ClaimRepository){
 page:=privateJourneyData{Heading:"Business claim",CSRFToken:session.CSRFToken}
 if r.Method==http.MethodGet {renderPrivateJourney(w,http.StatusOK,page);return}
 r.Body=http.MaxBytesReader(w,r.Body,4096)
 if err:=r.ParseForm();err!=nil {renderPrivateJourney(w,http.StatusBadRequest,privateJourneyData{Heading:"Business claim",Message:"Invalid claim form"});return}
 if !allowPrivateMutation(r,session){http.Error(w,"invalid request token",http.StatusForbidden);return}
 id:=strings.TrimSpace(r.PostForm.Get("place_id"))
 if !validPlaceID(id)||reader==nil {http.Error(w,"public place required",http.StatusBadRequest);return}
 feed,err:=publicJourneyFeed(r,reader)
 if err!=nil {http.Error(w,"public places unavailable",http.StatusBadGateway);return}
 found:=false;for _,v:=range feed.Travel {if v.Place.ID==id {found=true;break}}
 if !found {http.NotFound(w,r);return}
 claimID,err:=randomTravelID();if err!=nil {http.Error(w,"claim unavailable",http.StatusServiceUnavailable);return}
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
 _,err=repo.Submit(ctx,session.SubjectID,PlaceClaim{ID:claimID,PlaceID:id,RegistryRecordID:strings.TrimSpace(r.PostForm.Get("registry_record_id")),EvidenceRef:strings.TrimSpace(r.PostForm.Get("evidence_ref"))})
 if err!=nil {
  status:=http.StatusBadRequest;if errors.Is(err,ErrClaimUnavailable){status=http.StatusServiceUnavailable}
  renderPrivateJourney(w,status,privateJourneyData{Heading:"Business claim",Message:"Claim could not be verified or submitted"});return
 }
 renderPrivateJourney(w,http.StatusAccepted,privateJourneyData{Heading:"Business claim",Message:"Claim submitted for independent review. No place-page control has been granted."})
}
