//go:build account420_integration

package account

import (
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestRestrictedSessionHTTP(t *testing.T){
 db:=sessionDB(t);a,mail:=sessionAuth(t,db,testOrigin,testRP);uid,_:=newID();email:=uid+"@example.org"
 cfg:=AcceptanceConfig{Emails:[]string{email},RateKey:mustRandom(t),SessionApp:"bong-goggles"}
 h,e:=NewAcceptanceHandler(a,cfg);if e!=nil{t.Fatal(e)}
 old:=cfg;old.SessionApp="";auth2,e:=NewAcceptanceHandler(a,old);if e!=nil{t.Fatal(e)}
 page:=acceptRequest(h,"GET","/","","",nil);if page.Code!=200||!strings.Contains(page.Body.String(),"Manage sessions"){t.Fatal("AUTH-3 page absent")}
 flow:=page.Result().Cookies()[0]
 if w:=acceptRequest(auth2,"POST","/v1/session/status","{}",testOrigin,flow);w.Code!=404{t.Fatal("AUTH-2 exposed sessions")}
 post:=func(handler http.Handler,path string,v any,token *http.Cookie,origin string)*httptest.ResponseRecorder{
  r:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(jsonBody(t,v)));r.RemoteAddr="127.0.0.3:12345";r.Header.Set("Origin",origin);r.Header.Set("Content-Type","application/json");r.AddCookie(flow);if token!=nil{r.AddCookie(token)};w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w
 }
 var start EmailStart
 readResult(t,post(h,"/v1/email/start",map[string]string{"email":email},nil,testOrigin),&start)
 finish:=map[string]any{"challengeId":start.ChallengeID,"secret":mail.secret}
 var verified struct{Session Session;Registration *RegistrationOptions}
 response:=post(h,"/v1/email/finish",finish,nil,testOrigin);readResult(t,response,&verified)
 cookies:=response.Result().Cookies();if len(cookies)!=1||cookies[0].Name!=sessionCookie||!cookies[0].Secure||!cookies[0].HttpOnly||cookies[0].SameSite!=http.SameSiteStrictMode||cookies[0].Domain!=""||cookies[0].Path!="/"||cookies[0].MaxAge<=0{t.Fatal("unsafe session cookie")}
 token:=cookies[0];if strings.Contains(response.Body.String(),token.Value)||verified.Session.Subject.App!="bong-goggles"||verified.Registration==nil{t.Fatal("session leakage or wrong scope")}
 empty:=struct{}{};var status struct{Authenticated bool;Session Session}
 readResult(t,post(h,"/v1/session/status",empty,token,testOrigin),&status);if !status.Authenticated||status.Session.ID!=verified.Session.ID{t.Fatal("session unavailable")}
 if w:=post(h,"/v1/session/renew",empty,token,"https://evil.example.org");w.Code!=403{t.Fatal("CSRF accepted")}
 if w:=post(h,"/v1/session/renew",map[string]string{"app":"doobtube"},token,testOrigin);w.Code!=400{t.Fatal("client selected app")}
 renewal:=post(h,"/v1/session/renew",empty,token,testOrigin);var result struct{Session Session};readResult(t,renewal,&result)
 fresh:=renewal.Result().Cookies()[0];if fresh.Value==token.Value{t.Fatal("bearer not rotated")}
 if w:=post(h,"/v1/session/renew",empty,token,testOrigin);w.Code!=401{t.Fatal("rotation replay accepted")}
 logout:=post(h,"/v1/session/logout",empty,fresh,testOrigin);if logout.Code!=200||logout.Result().Cookies()[0].MaxAge>=0{t.Fatal("logout did not clear cookie")}
 status.Authenticated=true;readResult(t,post(h,"/v1/session/status",empty,fresh,testOrigin),&status);if status.Authenticated{t.Fatal("logged-out cookie authenticated")}
 // Explicit recovery of an unknown/unregistered mailbox must not create a new account.
 uid2,_:=newID();unknown:=uid2+"@example.org";cfg.Emails=append(cfg.Emails,unknown)
 h2,e:=NewAcceptanceHandler(a,cfg);if e!=nil{t.Fatal(e)}
 readResult(t,post(h2,"/v1/email/start",map[string]string{"email":unknown},nil,testOrigin),&start)
 if w:=post(h2,"/v1/email/finish",map[string]any{"challengeId":start.ChallengeID,"secret":mail.secret,"recover":true},nil,testOrigin);w.Code!=401{t.Fatal("unregistered recovery accepted")}
 var exists bool;if e=db.QueryRow("SELECT EXISTS(SELECT 1 FROM account420.email_identities WHERE email=$1)",unknown).Scan(&exists);e!=nil||exists{t.Fatal("recovery created account",e)}
}
