package complianceauth

import (
 "context"
 "crypto/subtle"
 "embed"
 "encoding/json"
 "io"
 "net/http"
 "net/url"
 "strings"
 "time"
)

// Private reviewer identity is independently verified; requests cannot choose
// tenant, jurisdiction, reviewer identity, role or grant.
type C065Session struct {
 Scope C064AuthorScope
 ReviewerID string
 SessionID string
 Role string
 CSRFToken string
 ExpiresAt time.Time
 Revoked bool
}
type C065SessionAuthority interface {
 VerifyReviewConsoleSession(context.Context,string)(C065Session,error)
 EndReviewConsoleSession(context.Context,string)error
}
type C065ReviewLookup interface {
 // Lookup returns an authorized, current private draft in verified scope.
 // Implementations MUST NOT discover drafts across scope boundaries.
 Lookup(context.Context,C064AuthorScope,string)(C064DraftVersion,error)
}
//go:embed reviewerweb/*
var c065Assets embed.FS
type C065ReviewConsole struct {
 Sessions C065SessionAuthority
 Lookup C065ReviewLookup
 Service C065ReviewService
 Origin string
 Now func()time.Time
}
func (h C065ReviewConsole) ServeHTTP(w http.ResponseWriter,r *http.Request){
 c064Headers(w)
 fail:=func(code int){c064Fail(w,code)}
 origin,e:=url.Parse(h.Origin)
 if e!=nil||origin.Scheme!="https"||origin.Host==""||origin.Path!=""||origin.RawQuery!=""||
 h.Sessions==nil||h.Lookup==nil||h.Service.Reviews==nil||h.Service.Drafts==nil||h.Service.Authority==nil||
 h.Service.Impacts==nil||r.TLS==nil||r.Host!=origin.Host||r.URL.RawPath!="" {
  fail(http.StatusServiceUnavailable);return
 }
 if r.Header.Get("Sec-Fetch-Site")!=""&&r.Header.Get("Sec-Fetch-Site")!="same-origin"&&r.Header.Get("Sec-Fetch-Site")!="none" {
  fail(http.StatusForbidden);return
 }
 cookie,e:=r.Cookie("__Host-420ComplianceReviewer")
 if e!=nil||len(cookie.Value)<16||len(cookie.Value)>4096{fail(http.StatusUnauthorized);return}
 count:=0
 for _,v:=range r.Cookies(){if v.Name=="__Host-420ComplianceReviewer"{count++}}
 if count!=1{fail(http.StatusBadRequest);return}
 s,e:=h.Sessions.VerifyReviewConsoleSession(r.Context(),cookie.Value)
 now:=time.Now().UTC()
 if h.Now!=nil{now=h.Now().UTC()}
 if e!=nil||s.Revoked||!c064ID.MatchString(s.ReviewerID)||!c064ID.MatchString(s.SessionID)||
 !c051Scope(s.Scope.Tenant)||!c051Scope(s.Scope.Domain)||!c051Scope(s.Scope.Jurisdiction)||
 (s.Role!="reviewer"&&s.Role!="approver")||!c064CSRF.MatchString(s.CSRFToken)||
 !now.Before(s.ExpiresAt){fail(http.StatusUnauthorized);return}
 ctx,cancel:=context.WithDeadline(r.Context(),s.ExpiresAt)
 defer cancel()
 fresh:=func()bool{
  updated,err:=h.Sessions.VerifyReviewConsoleSession(ctx,cookie.Value)
  return err==nil&&!updated.Revoked&&updated==s
 }
 if r.Method!=http.MethodGet&&(r.Header.Get("Origin")!=h.Origin||
 subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")),[]byte(s.CSRFToken))!=1){
  fail(http.StatusForbidden);return
 }
 if r.URL.RawQuery!=""{fail(http.StatusBadRequest);return}
 assets:=map[string]string{"/private/review":"console.html","/private/review/console.js":"console.js"}
 if file,ok:=assets[r.URL.Path];ok {
  if r.Method!=http.MethodGet||!fresh(){fail(http.StatusUnauthorized);return}
  data,err:=c065Assets.ReadFile("reviewerweb/"+file)
  if err!=nil{fail(http.StatusServiceUnavailable);return}
  if strings.HasSuffix(file,".js"){w.Header().Set("Content-Type","text/javascript; charset=utf-8")}else{
   w.Header().Set("Content-Type","text/html; charset=utf-8")}
  _,_=w.Write(data);return
 }
 if r.URL.Path=="/api/v1/review/session"&&r.Method==http.MethodGet {
  if !fresh(){fail(http.StatusUnauthorized);return}
  c064Write(w,map[string]any{"reviewer":s.ReviewerID,"scope":s.Scope,"role":s.Role,
   "csrf_token":s.CSRFToken,"valid_until":s.ExpiresAt,"state":"REVIEW_ONLY_NO_PUBLICATION"});return
 }
 if r.URL.Path=="/api/v1/review/logout"&&r.Method==http.MethodPost{
  if !fresh()||h.Sessions.EndReviewConsoleSession(ctx,cookie.Value)!=nil{fail(http.StatusServiceUnavailable);return}
  http.SetCookie(w,&http.Cookie{Name:"__Host-420ComplianceReviewer",Path:"/",MaxAge:-1,Secure:true,HttpOnly:true,SameSite:http.SameSiteStrictMode})
  w.WriteHeader(http.StatusNoContent);return
 }
 if r.URL.Path!="/api/v1/review/drafts"||r.Method!=http.MethodPost||
 r.Header.Get("Content-Type")!="application/json"{fail(http.StatusNotFound);return}
 data,e:=io.ReadAll(http.MaxBytesReader(w,r.Body,128<<10))
 var input struct{
  DraftID string `json:"draft_id"`
  Findings []C065Finding `json:"findings"`
  Impact ImpactReport `json:"impact"`
  ConflictIDs []string `json:"conflict_ids"`
  Decision string `json:"decision"`
  Signature C065ApprovalProof `json:"signature"`
  ExpectedReviewRevision uint64 `json:"expected_review_revision"`
 }
 if e!=nil||c064JSON(data,&input)!=nil||!c064ID.MatchString(input.DraftID){fail(http.StatusBadRequest);return}
 draft,e:=h.Lookup.Lookup(ctx,s.Scope,input.DraftID)
 if e!=nil||draft.Scope!=s.Scope||draft.ID!=input.DraftID||!fresh(){fail(http.StatusNotFound);return}
 out,e:=h.Service.Review(ctx,C065ReviewInput{Draft:draft,SessionID:s.SessionID,
  ReviewerID:s.ReviewerID,ReviewerRole:s.Role,Findings:input.Findings,Impact:input.Impact,
  ConflictIDs:input.ConflictIDs,Decision:input.Decision,Signature:input.Signature,
  ExpectedReviewRevision:input.ExpectedReviewRevision})
 if e!=nil{fail(http.StatusConflict);return}
 if !fresh(){fail(http.StatusUnauthorized);return}
 c064Write(w,out)
}
