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

// No operator-controlled unhalt endpoint. Production publisher credentials
// and legal signing authority are never returned to this private console.
type C066HTTPSession struct {
 C066OperatorSession
 CSRFToken string
}
type C066HTTPSessionAuthority interface {
 VerifyOperatorWebSession(context.Context,string)(C066HTTPSession,error)
}
//go:embed operatorweb/*
var c066Web embed.FS
type C066OperatorHTTP struct {
 Sessions C066HTTPSessionAuthority
 Operations C066Operations
 Origin string
}
func(h C066OperatorHTTP)ServeHTTP(w http.ResponseWriter,r *http.Request){
 c064Headers(w)
 deny:=func(code int){c064Fail(w,code)}
 origin,e:=url.Parse(h.Origin)
 if e!=nil||origin.Scheme!="https"||origin.Host==""||origin.Path!=""||origin.RawQuery!=""||
 h.Sessions==nil||r.TLS==nil||r.Host!=origin.Host||r.URL.RawPath!=""||r.URL.RawQuery!=""{deny(http.StatusServiceUnavailable);return}
 if site:=r.Header.Get("Sec-Fetch-Site");site!=""&&site!="none"&&site!="same-origin"{deny(http.StatusForbidden);return}
 cookie,e:=r.Cookie("__Host-420ComplianceOperator")
 if e!=nil||len(cookie.Value)<16||len(cookie.Value)>4096{deny(http.StatusUnauthorized);return}
 count:=0
 for _,v:=range r.Cookies(){if v.Name=="__Host-420ComplianceOperator"{count++}}
 if count!=1{deny(http.StatusBadRequest);return}
 s,e:=h.Sessions.VerifyOperatorWebSession(r.Context(),cookie.Value)
 if e!=nil||s.Revoked||s.Role!="publisher_operator"||!c064CSRF.MatchString(s.CSRFToken)||!time.Now().Before(s.ExpiresAt){deny(http.StatusUnauthorized);return}
 check:=func()bool{
  a,err:=h.Sessions.VerifyOperatorWebSession(r.Context(),cookie.Value)
  return err==nil&&a==s&&!a.Revoked
 }
 if r.Method!=http.MethodGet&&(r.Header.Get("Origin")!=h.Origin||
 subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")),[]byte(s.CSRFToken))!=1){deny(http.StatusForbidden);return}
 assets:=map[string]string{"/private/operator":"dashboard.html","/private/operator/dashboard.js":"dashboard.js"}
 if name,ok:=assets[r.URL.Path];ok{
  if r.Method!=http.MethodGet||!check(){deny(http.StatusUnauthorized);return}
  data,err:=c066Web.ReadFile("operatorweb/"+name)
  if err!=nil{deny(http.StatusServiceUnavailable);return}
  if strings.HasSuffix(name,".js"){w.Header().Set("Content-Type","text/javascript; charset=utf-8")}else{w.Header().Set("Content-Type","text/html; charset=utf-8")}
  _,_=w.Write(data);return
 }
 if r.URL.Path=="/api/v1/operator/dashboard"&&r.Method==http.MethodGet{
  out,e:=h.Operations.Dashboard(r.Context(),cookie.Value)
  if e!=nil||out.Scope!=s.Scope||!check(){deny(http.StatusServiceUnavailable);return}
  c064Write(w,map[string]any{"dashboard":out,"csrf_token":s.CSRFToken});return
 }
 if r.URL.Path=="/api/v1/operator/halt"&&r.Method==http.MethodPost{
  if r.Header.Get("Content-Type")!="application/json"{deny(http.StatusBadRequest);return}
  data,e:=io.ReadAll(http.MaxBytesReader(w,r.Body,4096))
  var input struct{Environment string `json:"environment"`}
  if e!=nil||c064JSON(data,&input)!=nil||input.Environment!="production"||!check(){deny(http.StatusBadRequest);return}
  if h.Operations.Halt(r.Context(),cookie.Value,input.Environment)!=nil{deny(http.StatusServiceUnavailable);return}
  w.WriteHeader(http.StatusNoContent);return
 }
 if r.URL.Path=="/api/v1/operator/release"&&r.Method==http.MethodPost{
  // No browser-issued release authority. External independently certified
  // scheduler invokes Operations.PublishScheduled with preverified artifacts.
  deny(http.StatusForbidden);return
 }
 _=json.Valid
 deny(http.StatusNotFound)
}
