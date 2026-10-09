package travelapp

import (
 "context"
 "errors"
 "html/template"
 "net/http"
 "strings"
 "time"
)

// ClaimDecisionRepository performs a separately authorized, audited decision.
// SQLClaimRepository implements this boundary; development ClaimStore does not.
type ClaimDecisionRepository interface {
 Decide(context.Context,string,string,ClaimStatus)(PlaceClaim,error)
}

var claimStatusHTML=template.Must(template.New("claimStatus").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Claim status | 420Travel</title></head><body><a href="#main">Skip to content</a><nav><a href="/travel">Travel</a> · <a href="/travel/business/claim">Business claims</a></nav><main id="main"><h1>Your business claim</h1><p>Place: {{.PlaceID}}</p><p role="status">Status: {{.Status}}</p><p>Claim approval does not grant page editing, Registry, Verify or Reputation authority.</p></main></body></html>`))
var claimReviewHTML=template.Must(template.New("claimReview").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Review claim | 420Travel</title></head><body><a href="#main">Skip to content</a><main id="main"><h1>Review claim</h1><p>Decisions require independently authorized reviewer access. Approval does not grant place management.</p><form method="post"><input type="hidden" name="csrf_token" value="{{.CSRF}}"><label>Claim identifier <input readonly name="claim_id" value="{{.ID}}"></label><label>Decision <select name="decision" required><option value="APPROVED">Approve</option><option value="REJECTED">Reject</option></select></label><button type="submit">Record decision</button></form></main></body></html>`))

func claimPrivateHeaders(w http.ResponseWriter) {
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("Pragma","no-cache")
 w.Header().Set("Referrer-Policy","no-referrer")
 w.Header().Set("X-Robots-Tag","noindex, nofollow, noarchive")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Security-Policy","default-src 'none'; form-action 'self'; base-uri 'none'")
}

// HandlerWithClaimWorkflows requires both a session-bound Identity authority and
// an independently authorizing SQL-style reviewer decision repository.
// It never exposes anonymous claim enumeration or raw evidence references.
func HandlerWithClaimWorkflows(base http.Handler, identity TravelIdentity, claims ClaimRepository, reviewer ClaimReviewerAuthorizer, decisions ClaimDecisionRepository) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request) {
  const own="/travel/business/claim/status/"
  const review="/travel/business/claim/review/"
  isOwn:=strings.HasPrefix(r.URL.Path,own)
  isReview:=strings.HasPrefix(r.URL.Path,review)
  if !isOwn&&!isReview {base.ServeHTTP(w,r);return}
  prefix:=own;if isReview {prefix=review}
  id:=strings.TrimPrefix(r.URL.Path,prefix)
  if !validPlaceID(id)||strings.Contains(id,"/") {http.NotFound(w,r);return}
  if identity==nil||claims==nil||(isReview&&(reviewer==nil||decisions==nil)) {http.Error(w,"claim workflow unavailable",http.StatusServiceUnavailable);return}
  if isOwn&&r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  if isReview&&r.Method!=http.MethodGet&&r.Method!=http.MethodPost {w.Header().Set("Allow","GET, POST");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  session,err:=authenticated(r,identity)
  if err!=nil {http.Error(w,"authentication required",http.StatusUnauthorized);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  if isOwn {
   claim,err:=claims.GetOwned(ctx,session.SubjectID,id)
   if errors.Is(err,ErrClaimNotFound){http.NotFound(w,r);return}
   if err!=nil {http.Error(w,"claim unavailable",http.StatusServiceUnavailable);return}
   claimPrivateHeaders(w)
   _=claimStatusHTML.Execute(w,struct{PlaceID string;Status ClaimStatus}{claim.PlaceID,claim.Status})
   return
  }
  // Authorize each reviewer request independently, including GET, so mere
  // possession of a claim identifier cannot reveal its existence.
  target:=ClaimApproved
  if r.Method==http.MethodPost {
   r.Body=http.MaxBytesReader(w,r.Body,4096)
   if err:=r.ParseForm();err!=nil {http.Error(w,"invalid form",http.StatusBadRequest);return}
   if !allowPrivateMutation(r,session) {http.Error(w,"invalid request token",http.StatusForbidden);return}
   if r.PostForm.Get("claim_id")!=id {http.Error(w,"invalid claim reference",http.StatusBadRequest);return}
   target=ClaimStatus(r.PostForm.Get("decision"))
   if target!=ClaimApproved&&target!=ClaimRejected {http.Error(w,"invalid decision",http.StatusBadRequest);return}
  }
  permitted,err:=reviewer.AuthorizeClaimReview(ctx,session.SubjectID,id,target)
  if err!=nil||!permitted {http.NotFound(w,r);return}
  if r.Method==http.MethodGet {
   claimPrivateHeaders(w)
   _=claimReviewHTML.Execute(w,struct{ID,CSRF string}{id,session.CSRFToken})
   return
  }
  _,err=decisions.Decide(ctx,session.SubjectID,id,target)
  if errors.Is(err,ErrClaimUnauthorized)||errors.Is(err,ErrClaimNotFound){http.NotFound(w,r);return}
  if errors.Is(err,ErrClaimConflict){http.Error(w,"claim changed; reload",http.StatusConflict);return}
  if err!=nil {http.Error(w,"claim decision unavailable",http.StatusServiceUnavailable);return}
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("Referrer-Policy","no-referrer")
  http.Redirect(w,r,"/travel/business/claim",http.StatusSeeOther)
 })
}
