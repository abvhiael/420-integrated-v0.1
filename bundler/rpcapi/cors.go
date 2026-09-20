package rpcapi

import (
 "errors"
 "net/http"
 "net/url"
 "strings"
)

// BrowserCORS enables the public JSON-RPC surface for explicitly authorized
// Wallet origins. It never applies to peer ingress, status or health endpoints.
// CORS is a browser interoperability boundary, not authentication or admission.
func BrowserCORS(next http.Handler, origins []string) (http.Handler, error) {
 if next==nil {return nil,errors.New("rpc handler required")}
 allowed:=make(map[string]struct{},len(origins))
 if len(origins)>32{return nil,errors.New("too many browser origins")}
 for _, raw:=range origins {
  if raw!=strings.TrimSpace(raw)||raw==""||raw=="*"||strings.ContainsAny(raw,"\r\n") {return nil,errors.New("invalid browser origin")}
  u,err:=url.Parse(raw)
  if err!=nil||u.Host==""||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Path!=""||u.Opaque!="" {return nil,errors.New("invalid browser origin")}
  hostname:=strings.ToLower(u.Hostname())
  local:=hostname=="localhost"||hostname=="127.0.0.1"||hostname=="::1"
  if u.Scheme!="https" && !(u.Scheme=="http"&&local) {return nil,errors.New("browser origin requires HTTPS outside localhost")}
  origin:=u.Scheme+"://"+u.Host
  if origin!=raw {return nil,errors.New("browser origin must be canonical")}
  if _,exists:=allowed[origin];exists{return nil,errors.New("duplicate browser origin")}
  allowed[origin]=struct{}{}
 }
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  origin:=r.Header.Get("Origin")
  if origin=="" {next.ServeHTTP(w,r);return}
  if _,ok:=allowed[origin];!ok {http.Error(w,"browser origin not allowed",http.StatusForbidden);return}
  w.Header().Set("Access-Control-Allow-Origin",origin)
  w.Header().Set("Vary","Origin")
  // Requests have no cookie-based authentication; never set Allow-Credentials.
  if r.Method==http.MethodOptions {
   if r.Header.Get("Access-Control-Request-Method")!="POST" {http.Error(w,"unsupported preflight method",http.StatusMethodNotAllowed);return}
   requested:=strings.ToLower(r.Header.Get("Access-Control-Request-Headers"))
   for _,header:=range strings.Split(requested,",") {
    h:=strings.TrimSpace(header)
    if h!=""&&h!="content-type" {http.Error(w,"unsupported preflight header",http.StatusForbidden);return}
   }
   w.Header().Set("Access-Control-Allow-Methods","POST")
   w.Header().Set("Access-Control-Allow-Headers","Content-Type")
   w.Header().Set("Access-Control-Max-Age","600")
   w.WriteHeader(http.StatusNoContent)
   return
  }
  next.ServeHTTP(w,r)
 }),nil
}
