//go:build account420_integration

package account

import (
 "context"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
)
func TestSSOHTTPConsentBackendIsolationAndLogout(t *testing.T){
 db:=sessionDB(t)
 store,e:=NewStore(db,[]string{"bong-goggles","doobtube","420town","420wallet"});if e!=nil{t.Fatal(e)}
 mail:=&testMailer{}
 auth,e:=NewAuth(store,mail,testOrigin,testRP);if e!=nil{t.Fatal(e)}
 id,_:=newID();email:=id+"@example.org"
 clients:=ssoIntegrationClients()
 base:=AcceptanceConfig{Emails:[]string{email},RateKey:mustRandom(t),SessionApp:"bong-goggles"}
 previous,e:=NewAcceptanceHandler(auth,base);if e!=nil{t.Fatal(e)}
 cfg:=base;cfg.SSOClients=clients
 h,e:=NewAcceptanceHandler(auth,cfg);if e!=nil{t.Fatal(e)}
 if e=h.sso.Ready(context.Background());e!=nil{t.Fatal("SSO migration missing",e)}
 if _,e=NewAcceptanceHandler(auth,AcceptanceConfig{Emails:base.Emails,RateKey:base.RateKey,SSOClients:clients});e==nil{t.Fatal("SSO without authenticated source accepted")}
 client,_:=h.sso.client("doobtube")
 request,verifier:=ssoUnitRequest(t,client)
 makeURL:=func(req SSORequest)string{
  u:=url.Values{
   "app":[]string{req.App},
   "redirect_uri":[]string{req.RedirectURI},
   "state":[]string{req.State},
   "code_challenge":[]string{req.CodeChallenge},
   "code_challenge_method":[]string{"S256"},
  }
  return "/sso/authorize?"+u.Encode()
 }
 authURL:=makeURL(request)
 if resp:=acceptRequest(previous,"GET",authURL,"","",nil);resp.Code==200{t.Fatal("AUTH-3 exposed SSO")}
 page:=acceptRequest(h,"GET",authURL,"","",nil)
 if page.Code!=200||!strings.Contains(page.Body.String(),"Approve an application sign-on")||
  strings.Contains(page.Body.String(),request.State)||strings.Contains(page.Body.String(),request.CodeChallenge)||
  page.Header().Get("Cache-Control")!="no-store"||page.Header().Get("Referrer-Policy")!="no-referrer"{t.Fatal("unsafe SSO authorization page",page.Code)}
 cookies:=page.Result().Cookies()
 if len(cookies)!=1||cookies[0].Name!=flowCookie||!cookies[0].HttpOnly||!cookies[0].Secure||cookies[0].Domain!=""{t.Fatal("missing host-only browser flow",cookies)}
 browser:=cookies[0]
 for _,path:=range []string{"/sso-session.mjs","/sso-ui.mjs"}{
  if r:=acceptRequest(previous,"GET",path,"","",nil);r.Code!=404{t.Fatal("prior mode exposed SSO asset",path)}
  if r:=acceptRequest(h,"GET",path,"","",nil);r.Code!=200||r.Body.Len()==0{t.Fatal("SSO asset unavailable",path)}
 }
 invalid:=[]string{
  authURL+"&redirect_uri=https%3A%2F%2Fevil.org%2Fcallback",
  strings.Replace(authURL,"S256","plain",1),
  strings.Replace(authURL,"app=doobtube","app=unknown",1),
  authURL+"&extra=untrusted",
  "/v1/email/start?unexpected=true",
 }
 for _,path:=range invalid{if r:=acceptRequest(h,"GET",path,"","",nil);r.Code!=400&&r.Code!=404{t.Fatal("invalid query accepted",path,r.Code)}}
 post:=func(path string,body any,token *http.Cookie,origin string,flow *http.Cookie)*httptest.ResponseRecorder{
  req:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(jsonBody(t,body)))
  req.RemoteAddr="127.0.0.15:12345"
  req.Header.Set("Content-Type","application/json");req.Header.Set("Origin",origin)
  if flow!=nil{req.AddCookie(flow)}
  if token!=nil{req.AddCookie(token)}
  wr:=httptest.NewRecorder();h.ServeHTTP(wr,req);return wr
 }
 serverPost:=func(path,app,secret string,body any,origin string,cookie *http.Cookie)*httptest.ResponseRecorder{
  req:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(jsonBody(t,body)))
  req.RemoteAddr="127.0.0.16:12345";req.Header.Set("Content-Type","application/json")
  req.SetBasicAuth(app,secret)
  if origin!=""{req.Header.Set("Origin",origin)}
  if cookie!=nil{req.AddCookie(cookie)}
  wr:=httptest.NewRecorder();h.ServeHTTP(wr,req);return wr
 }
 if r:=post("/v1/sso/prepare",request,nil,testOrigin,browser);r.Code!=401{t.Fatal("unauthenticated handoff prepared",r.Code)}
 var challenge EmailStart
 readResult(t,post("/v1/email/start",map[string]string{"email":email},nil,testOrigin,browser),&challenge)
 login:=post("/v1/email/finish",map[string]string{"challengeId":challenge.ChallengeID,"secret":mail.secret},nil,testOrigin,browser)
 if login.Code!=200{t.Fatal("central sign-in rejected",login.Code)}
 appCookie:=login.Result().Cookies()
 if len(appCookie)!=1||appCookie[0].Name!=sessionCookie{t.Fatal("central session cookie missing")}
 token:=appCookie[0]
 if r:=post("/v1/sso/authorize",map[string]any{"app":request.App,"redirectUri":request.RedirectURI,"state":request.State,"codeChallenge":request.CodeChallenge,"consentAccepted":false},token,testOrigin,browser);r.Code!=400{t.Fatal("silent app consent",r.Code)}
 payload:=map[string]any{"app":request.App,"redirectUri":request.RedirectURI,"state":request.State,"codeChallenge":request.CodeChallenge}
 if r:=post("/v1/sso/prepare",payload,token,"https://evil.example.org",browser);r.Code!=403{t.Fatal("cross-origin prepare",r.Code)}
 if r:=post("/v1/sso/prepare",payload,token,testOrigin,nil);r.Code!=403{t.Fatal("no flow cookie",r.Code)}
 if r:=post("/v1/sso/prepare",map[string]any{"app":"unknown","redirectUri":request.RedirectURI,"state":request.State,"codeChallenge":request.CodeChallenge},token,testOrigin,browser);r.Code!=400{t.Fatal("unknown app permitted",r.Code)}
 var prepared struct{Client SSOClientInfo}
 readResult(t,post("/v1/sso/prepare",payload,token,testOrigin,browser),&prepared)
 if prepared.Client.App!="doobtube"||prepared.Client.RedirectURI!=request.RedirectURI{t.Fatal("untrusted display",prepared)}
 payload["consentAccepted"]=true
 var authOut SSOAuthorization
 readResult(t,post("/v1/sso/authorize",payload,token,testOrigin,browser),&authOut)
 code:=ssoCode(t,authOut.RedirectURI)
 if strings.Contains(authOut.RedirectURI,token.Value)||strings.Contains(authOut.RedirectURI,email){t.Fatal("source session leaked in redirect")}
 exchange:=map[string]string{"code":code,"codeVerifier":verifier,"redirectUri":client.redirect}
 if x:=serverPost("/v1/sso/token","doobtube",clients[0].Secret,exchange,testOrigin,nil);x.Code!=403{t.Fatal("browser Origin permitted confidential exchange",x.Code)}
 if x:=serverPost("/v1/sso/token","doobtube",clients[0].Secret,exchange,"",browser);x.Code!=403{t.Fatal("browser cookies permitted confidential exchange",x.Code)}
 if x:=serverPost("/v1/sso/token","doobtube","wrong",exchange,"",nil);x.Code!=401{t.Fatal("wrong secret accepted",x.Code)}
 if x:=serverPost("/v1/sso/token","420town",clients[1].Secret,exchange,"",nil);x.Code!=401{t.Fatal("wrong app redeemed code",x.Code)}
 wrong:=map[string]string{"code":code,"codeVerifier":"Z"+verifier[1:],"redirectUri":client.redirect}
 if x:=serverPost("/v1/sso/token","doobtube",clients[0].Secret,wrong,"",nil);x.Code!=401{t.Fatal("wrong PKCE accepted",x.Code)}
 var minted SSOExchange
 response:=serverPost("/v1/sso/token","doobtube",clients[0].Secret,exchange,"",nil)
 readResult(t,response,&minted)
 if minted.Session.Subject.App!="doobtube"||minted.TokenType!="Bearer"||len(response.Result().Cookies())!=0{t.Fatal("unsafe app token response",minted)}
 if x:=serverPost("/v1/sso/token","doobtube",clients[0].Secret,exchange,"",nil);x.Code!=401{t.Fatal("authorization code replay",x.Code)}
 var active SSOIntrospection
 readResult(t,serverPost("/v1/sso/introspect","doobtube",clients[0].Secret,map[string]string{"token":minted.AccessToken},"",nil),&active)
 if !active.Active||active.Subject==nil||active.Subject.App!="doobtube"{t.Fatal("valid app session missing",active)}
 // Exercise real HTTP, durable rate accounting and token validation beyond the old 30/min ceiling.
 for i:=0;i<120;i++{var seen SSOIntrospection;readResult(t,serverPost("/v1/sso/introspect","doobtube",clients[0].Secret,map[string]string{"token":minted.AccessToken},"",nil),&seen);if !seen.Active||seen.Subject==nil||seen.Subject.App!="doobtube"{t.Fatal("sustained introspection failed",i)}}
 var forbidden SSOIntrospection
 readResult(t,serverPost("/v1/sso/introspect","420town",clients[1].Secret,map[string]string{"token":minted.AccessToken},"",nil),&forbidden)
 if forbidden.Active||forbidden.Subject!=nil{t.Fatal("other app received identity",forbidden)}
 if x:=post("/v1/session/status",struct{}{},nil,testOrigin,browser);x.Code!=200{t.Fatal("central status endpoint",x.Code)}
 if x:=post("/v1/sso/logout-all",struct{}{},token,testOrigin,browser);x.Code!=200{t.Fatal("global sign-out",x.Code)}
 active=SSOIntrospection{}
 readResult(t,serverPost("/v1/sso/introspect","doobtube",clients[0].Secret,map[string]string{"token":minted.AccessToken},"",nil),&active)
 if active.Active{t.Fatal("globally signed-out app remains valid")}
 if x:=post("/v1/sso/authorize",payload,token,testOrigin,browser);x.Code!=401{t.Fatal("logged-out source authorized new handoff",x.Code)}
 // No secret, internal account identifier, wallet, or email is ever
 // contained in an introspection response.
 raw,_:=json.Marshal(forbidden)
 if strings.Contains(string(raw),email)||strings.Contains(string(raw),minted.AccessToken){t.Fatal("sensitive data in introspection")}
}
