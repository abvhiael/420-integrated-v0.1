package complianceauth

import (
 "context"
 "crypto/subtle"
 "encoding/json"
 "io"
 "net/http"
 "net/url"
 "time"
)

// Auditor sessions are issued outside this handler; TLS and host are checked
// before any private evidence is accessed.
type C067HTTPSession struct {
 Token string
 CSRFToken string
 ExpiresAt time.Time
 Revoked bool
}
type C067HTTPSessionAuthority interface {
 VerifyAuditorWebSession(context.Context,string)(C067HTTPSession,error)
}
type C067AuditorHTTP struct {
 Sessions C067HTTPSessionAuthority
 Service C067AuditorService
 Origin string
}
func(h C067AuditorHTTP)ServeHTTP(w http.ResponseWriter,r *http.Request){
 c064Headers(w)
 deny:=func(status int){c064Fail(w,status)}
 origin,e:=url.Parse(h.Origin)
 if e!=nil||origin.Scheme!="https"||origin.Host==""||origin.Path!=""||origin.RawQuery!=""||
 r.TLS==nil||r.Host!=origin.Host||r.URL.RawPath!=""||r.URL.RawQuery!=""||h.Sessions==nil{
  deny(http.StatusServiceUnavailable);return
 }
 if site:=r.Header.Get("Sec-Fetch-Site");site!=""&&site!="same-origin"&&site!="none"{deny(http.StatusForbidden);return}
 if r.Method!=http.MethodPost||r.URL.Path!="/api/v1/auditor/evidence"||r.Header.Get("Content-Type")!="application/json"{
  deny(http.StatusNotFound);return
 }
 cookie,e:=r.Cookie("__Host-420ComplianceAuditor")
 if e!=nil||len(cookie.Value)<16||len(cookie.Value)>4096{deny(http.StatusUnauthorized);return}
 count:=0
 for _,c:=range r.Cookies(){if c.Name=="__Host-420ComplianceAuditor"{count++}}
 if count!=1{deny(http.StatusUnauthorized);return}
 session,e:=h.Sessions.VerifyAuditorWebSession(r.Context(),cookie.Value)
 if e!=nil||session.Revoked||session.Token!=cookie.Value||!c064CSRF.MatchString(session.CSRFToken)||
 !time.Now().Before(session.ExpiresAt)||r.Header.Get("Origin")!=h.Origin||
 subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")),[]byte(session.CSRFToken))!=1 {
  deny(http.StatusForbidden);return
 }
 data,e:=io.ReadAll(http.MaxBytesReader(w,r.Body,64<<10))
 var request struct{Items []C067EvidenceRequest `json:"items"`}
 if e!=nil||c064JSON(data,&request)!=nil{deny(http.StatusBadRequest);return}
 result,e:=h.Service.Export(r.Context(),cookie.Value,request.Items)
 if e!=nil{deny(http.StatusForbidden);return}
 fresh,e:=h.Sessions.VerifyAuditorWebSession(r.Context(),cookie.Value)
 if e!=nil||fresh!=session||fresh.Revoked{deny(http.StatusForbidden);return}
 w.Header().Set("Content-Type","application/json")
 w.Header().Set("Content-Disposition","attachment; filename=redacted-audit-evidence.json")
 _=json.NewEncoder(w).Encode(result)
}
