// GOV-PRE-08 LOCAL BROWSER QUALIFICATION FIXTURE ONLY.
//
// This executable runs the unmodified *production* 420ID confidential
// app-gateway handler against an isolated disposable PostgreSQL database.
// It simulates ONLY the upstream 420ID confidential SSO provider, which is
// independently exercised by the production 420ID server integration suite.
// No browser bearer, secret, signing key, account entitlement or Wallet
// transaction authority is issued by this executable.
package main

import (
 "bytes"
 "context"
 "crypto/subtle"
 "database/sql"
 "encoding/base64"
 "encoding/json"
 "flag"
 "fmt"
 "io"
 "net"
 "net/http"
 "os"
 "strings"
 "sync"
 "time"

 appgateway "github.com/420integrated/420-integrated/services/420id/app-gateway"
 _ "github.com/lib/pq"
)

const app="420wallet"
const origin="https://wallet.420integrated.org"
var localToken=base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{84},32))
var localCode=base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{67},32))

type authority struct {
 mu sync.Mutex
 active bool
 exchanges int
 introspections int
 revocations int
}
func (a *authority) RoundTrip(r *http.Request)(*http.Response,error){
 if r.URL.Scheme!="https"||r.URL.Host!="auth.420integrated.org"||r.Method!="POST" {
  return nil,fmt.Errorf("wrong upstream SSO authority or method")
 }
 name,password,ok:=r.BasicAuth()
 expected:=base64.RawURLEncoding.EncodeToString(bytes.Repeat([]byte{23},32))
 if !ok||name!=app||subtle.ConstantTimeCompare([]byte(password),[]byte(expected))!=1{
  return nil,fmt.Errorf("confidential SSO authorization missing")
 }
 var req map[string]string
 if e:=json.NewDecoder(io.LimitReader(r.Body,64<<10)).Decode(&req);e!=nil{return nil,e}
 a.mu.Lock()
 defer a.mu.Unlock()
 var response any
 now:=time.Now().UTC()
 switch r.URL.Path{
 case "/v1/sso/token":
  if req["code"]!=localCode||len(req["codeVerifier"])!=43||
    req["redirectUri"]!=origin+"/420id-api/auth/callback"||!a.active {
   return nil,fmt.Errorf("invalid local confidential PKCE grant")
  }
  a.exchanges++
  response=map[string]any{"accessToken":localToken,"tokenType":"Bearer",
   "session":map[string]any{"id":"12345678-1234-4123-8123-123456789abc",
    "subject":map[string]string{"app":app,"sub":"23456789-1234-4234-8234-123456789abc"},
    "method":"sso","issuedAt":now,"expiresAt":now.Add(time.Hour),
    "idleUntil":now.Add(30*time.Minute)}}
 case "/v1/sso/introspect":
  if req["token"]!=localToken{return nil,fmt.Errorf("wrong SSO token")}
  a.introspections++
  if a.active {response=map[string]any{"active":true,"method":"sso",
    "subject":map[string]string{"app":app,"sub":"23456789-1234-4234-8234-123456789abc"},
    "expiresAt":now.Add(time.Hour),"idleUntil":now.Add(30*time.Minute)}}
  else {response=map[string]any{"active":false}}
 case "/v1/sso/revoke":
  if req["token"]!=localToken{return nil,fmt.Errorf("wrong SSO revocation token")}
  a.active=false;a.revocations++
  response=map[string]any{"revoked":true}
 default:return nil,fmt.Errorf("unrecognized confidential SSO operation")
 }
 raw,e:=json.Marshal(response);if e!=nil{return nil,e}
 return &http.Response{StatusCode:200,Header:http.Header{"Content-Type":[]string{"application/json"}},
  Body:io.NopCloser(bytes.NewReader(raw))},nil
}
func main(){
 dsn:=flag.String("dsn","","private LOCAL qualification database, never a production 420ID DB")
 listen:=flag.String("listen","127.0.0.1:18789","local browser gateway address")
 flag.Parse()
 if !strings.Contains(*dsn,"accountwallet_local") || !strings.Contains(*dsn,"127.0.0.1:5434") ||
  !strings.HasPrefix(*listen,"127.0.0.1:") ||
  os.Getenv("GOVPRE08_INSECURE_LOCAL_BROWSER_ONLY")!="1"{
  fmt.Fprintln(os.Stderr,"GOV_PRE08_LOCAL_420ID_GATEWAY_REFUSES_UNPINNED_DATABASE_OR_NETWORK")
  os.Exit(2)
 }
 db,e:=sql.Open("postgres",*dsn)
 if e!=nil{panic(e)};defer db.Close()
 ctx,cancel:=context.WithTimeout(context.Background(),15*time.Second);defer cancel()
 if e=db.PingContext(ctx);e!=nil{panic(e)}
 if e=appgateway.Migrate(ctx,db);e!=nil{panic(e)}
 source:=&authority{active:true}
 gateway,e:=appgateway.New(appgateway.Config{
  AppID:app,DB:db,ClientSecret:bytes.Repeat([]byte{23},32),
  SessionKey:bytes.Repeat([]byte{31},32),
  Client:&http.Client{Transport:source},TrustedTLSProxy:true,
 })
 if e!=nil{panic(e)}
 if e=gateway.Ready(ctx);e!=nil{panic(e)}
 listener,e:=net.Listen("tcp",*listen)
 if e!=nil{panic(e)};defer listener.Close()
 mux:=http.NewServeMux()
 mux.HandleFunc("/test/health",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"{http.Error(w,"unsupported",405);return}
  w.Header().Set("Content-Type","application/json")
  _=json.NewEncoder(w).Encode(map[string]bool{"localGatewayReady":true})
 })
 mux.HandleFunc("/test/revoke",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"{http.Error(w,"unsupported",405);return}
  source.mu.Lock();source.active=false;source.mu.Unlock()
  w.Header().Set("Content-Type","application/json")
  _=json.NewEncoder(w).Encode(map[string]bool{"centralSessionRevoked":true})
 })
 mux.HandleFunc("/test/counters",func(w http.ResponseWriter,r *http.Request){
  if r.Method!="GET"{http.Error(w,"unsupported",405);return}
  source.mu.Lock();defer source.mu.Unlock()
  w.Header().Set("Content-Type","application/json")
  _=json.NewEncoder(w).Encode(map[string]int{
   "exchanges":source.exchanges,"introspections":source.introspections,
   "revocations":source.revocations})
 })
 mux.Handle("/",http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  // Test-only local reverse proxy adapts the original HTTPS Wallet host to
  // the real gateway's strict origin/CSRF/TLS validation. The public browser
  // never obtains the app secret or bearer.
  r.Host="wallet.420integrated.org"
  r.Header.Set("X-Forwarded-Proto","https")
  r.RemoteAddr="127.0.0.1:45123"
  gateway.ServeHTTP(w,r)
 }))
 fmt.Println("GOV_PRE08_REAL_POSTGRES_WALLET_420ID_APP_GATEWAY_READY",*listen)
 if e=http.Serve(listener,mux);e!=nil{panic(e)}
}
