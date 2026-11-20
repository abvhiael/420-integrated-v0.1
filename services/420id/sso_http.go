package account

import (
 "context"
 "crypto/sha256"
 "errors"
 "io"
 "mime"
 "net/http"
 "net/url"
 "time"
)

// A browser initiates a top-level navigation to the 420ID first-party host.
// Only an exact registered HTTPS callback may receive an authorization code.
// No query parameters are reflected in HTML and no browser receives a token.
func parseSSOQuery(raw string)(SSORequest,error){
 var result SSORequest
 v,e:=url.ParseQuery(raw)
 if e!=nil||len(v)!=5{return result,ErrInvalid}
 for _,key:=range []string{"app","redirect_uri","state","code_challenge","code_challenge_method"}{
  if len(v[key])!=1{return result,ErrInvalid}
 }
 if v.Get("code_challenge_method")!="S256"{return result,ErrInvalid}
 result=SSORequest{App:v.Get("app"),RedirectURI:v.Get("redirect_uri"),State:v.Get("state"),CodeChallenge:v.Get("code_challenge")}
 return result,nil
}
func (h *AcceptanceHandler) ssoBrowserRoute(ctx context.Context,w http.ResponseWriter,r *http.Request,raw,binding []byte){
 token,e:=readSessionCookie(r)
 if e!=nil{deny(w,401);return}
 current,e:=h.sessions.Validate(ctx,token)
 if e!=nil{deny(w,401);return}
 id,e:=h.auth.store.Resolve(ctx,current.Subject)
 if e!=nil||!h.approved(ctx,id){deny(w,401);return}
 if r.URL.Path=="/v1/sso/logout-all"{
  if !decodeRequest(raw,&struct{}{}){deny(w,400);return}
  if e=h.sso.LogoutAll(ctx,token);e!=nil{deny(w,401);return}
  clearSessionCookie(w);reply(w,200,map[string]bool{"signedOutEverywhere":true});return
 }
 var request struct {
  SSORequest
  ConsentAccepted bool `json:"consentAccepted"`
 }
 if !decodeRequest(raw,&request){deny(w,400);return}
 info,e:=h.sso.ValidateRequest(request.SSORequest)
 if e!=nil{deny(w,400);return}
 if r.URL.Path=="/v1/sso/prepare"{
  if request.ConsentAccepted{deny(w,400);return}
  reply(w,200,map[string]any{"client":info});return
 }
 if r.URL.Path!="/v1/sso/authorize"{deny(w,404);return}
 if !request.ConsentAccepted{deny(w,400);return}
 result,e:=h.sso.Authorize(ctx,token,request.SSORequest,true,binding)
 if errors.Is(e,ErrAuthentication){deny(w,401);return}
 if errors.Is(e,ErrInvalid){deny(w,400);return}
 if e!=nil{deny(w,503);return}
 reply(w,200,result)
}
func (h *AcceptanceHandler) ssoBackendRoute(w http.ResponseWriter,r *http.Request){
 if h.sso==nil||!h.secure(r){deny(w,403);return}
 // Browser fetches carry an Origin or cookies. No CORS or shared browser
 // cookie can redeem authorization codes or validate another app's tokens.
 if r.URL.RawQuery!=""||r.URL.RawPath!=""||r.URL.ForceQuery||
  r.Header.Get("Origin")!=""||r.Header.Get("Cookie")!=""||
  r.Header.Get("Sec-Fetch-Site")!=""||len(r.Header.Values("Authorization"))!=1||
  len(r.Header.Get("Authorization"))>256{deny(w,403);return}
 typ,params,e:=mime.ParseMediaType(r.Header.Get("Content-Type"))
 if e!=nil||typ!="application/json"||len(params)!=0||r.Header.Get("Content-Encoding")!=""{deny(w,415);return}
 ctx,cancel:=context.WithTimeout(r.Context(),15*time.Second);defer cancel()
 // The same durable global, peer and client-bound caps apply to confidential
 // endpoints, including invalid credentials. No unauthenticated brute force
 // is granted a high-frequency backend bypass.
 key:=sha256.Sum256([]byte(r.Header.Get("Authorization")))
 if e=h.limit(ctx,key[:],r.RemoteAddr,false);e!=nil{
  if errors.Is(e,errLimited){deny(w,429)}else{deny(w,503)};return
 }
 app,secret,ok:=r.BasicAuth()
 if !ok{deny(w,401);return}
 client,e:=h.sso.CheckClient(app,secret)
 if e!=nil{deny(w,401);return}
 if r.ContentLength>maxRequest{deny(w,413);return}
 raw,e:=io.ReadAll(http.MaxBytesReader(w,r.Body,maxRequest))
 if e!=nil{deny(w,413);return}
 if !uniqueObject(raw){deny(w,400);return}
 switch r.URL.Path{
 case "/v1/sso/token":
  var body struct{Code string;CodeVerifier string;RedirectURI string}
  if !decodeRequest(raw,&body){deny(w,400);return}
  grant,e:=h.sso.Exchange(ctx,client,body.Code,body.CodeVerifier,body.RedirectURI)
  if errors.Is(e,ErrAuthentication){deny(w,401);return}
  if errors.Is(e,ErrUnavailable){deny(w,503);return}
  if e!=nil{deny(w,503);return}
  reply(w,200,grant)
 case "/v1/sso/introspect":
  var body struct{Token string}
  if !decodeRequest(raw,&body){deny(w,400);return}
  result,e:=h.sso.Introspect(ctx,client,body.Token)
  if e!=nil{deny(w,503);return}
  reply(w,200,result)
 case "/v1/sso/revoke":
  var body struct{Token string}
  if !decodeRequest(raw,&body){deny(w,400);return}
  if e=h.sso.Revoke(ctx,client,body.Token);e!=nil{deny(w,401);return}
  reply(w,200,map[string]bool{"revoked":true})
 default:deny(w,404)
 }
}
