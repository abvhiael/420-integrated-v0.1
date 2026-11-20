//go:build account420_integration

package account

import (
 "context"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)
func TestIdentityNamesHTTPIsExplicitAndWalletOptional(t *testing.T){
 db:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP)
 uid,_:=newID();email:=uid+"@example.org"
 base:=AcceptanceConfig{Emails:[]string{email},RateKey:mustRandom(t),SessionApp:"bong-goggles",ProfileMode:true,WalletMode:true,WalletChainID:420}
 previous,e:=NewAcceptanceHandler(a,base);if e!=nil{t.Fatal(e)}
 c:=base;c.IdentityMode=true;c.IdentityReader=&identityNamesFixture{}
 h,e:=NewAcceptanceHandler(a,c);if e!=nil{t.Fatal(e)}
 if e=h.identity.Ready(context.Background());e!=nil{t.Fatal("schema not ready",e)}
 bad:=base;bad.IdentityMode=true
 if _,e=NewAcceptanceHandler(a,bad);e==nil{t.Fatal("missing pinned verifier accepted")}
 bad=c;bad.WalletMode=false
 if _,e=NewAcceptanceHandler(a,bad);e==nil{t.Fatal("identity without wallet mode accepted")}
 page:=acceptRequest(h,"GET","/","","",nil)
 if page.Code!=200||!strings.Contains(page.Body.String(),"on-chain 420Identity and 420Names"){t.Fatal("identity page missing")}
 flow:=page.Result().Cookies()[0]
 if old:=acceptRequest(previous,"GET","/","","",nil);old.Code!=200||strings.Contains(old.Body.String(),"identity-heading"){t.Fatal("AUTH-5 page changed")}
 for _,path:=range []string{"/identity-session.mjs","/identity-ui.mjs"}{
  if x:=acceptRequest(previous,"GET",path,"","",nil);x.Code!=404{t.Fatal("old mode exposed Identity JS")}
  if x:=acceptRequest(h,"GET",path,"","",nil);x.Code!=200||x.Body.Len()==0{t.Fatal("Identity asset unavailable",path)}
 }
 post:=func(handler http.Handler,path string,body any,token *http.Cookie,origin string,flowCookie *http.Cookie)*httptest.ResponseRecorder{
  req:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(jsonBody(t,body)))
  req.RemoteAddr="127.0.0.12:12345";req.Header.Set("Origin",origin);req.Header.Set("Content-Type","application/json")
  if flowCookie!=nil{req.AddCookie(flowCookie)}
  if token!=nil{req.AddCookie(token)}
  wr:=httptest.NewRecorder();handler.ServeHTTP(wr,req);return wr
 }
 empty:=struct{}{}
 if x:=post(previous,"/v1/identity/current",empty,nil,testOrigin,flow);x.Code!=404{t.Fatal("old mode enabled Identity API")}
 if x:=post(h,"/v1/identity/current",empty,nil,testOrigin,flow);x.Code!=401{t.Fatal("public Identity API exposure")}
 var started EmailStart
 readResult(t,post(h,"/v1/email/start",map[string]string{"email":email},nil,testOrigin,flow),&started)
 login:=post(h,"/v1/email/finish",map[string]string{"challengeId":started.ChallengeID,"secret":mail.secret},nil,testOrigin,flow)
 if login.Code!=200{t.Fatal("no AUTH-3 session",login.Code)}
 cookies:=login.Result().Cookies();if len(cookies)!=1||cookies[0].Name!=sessionCookie{t.Fatal("invalid cookie")}
 session:=cookies[0]
 profile:="0x"+strings.Repeat("1",64);label:="0x"+strings.Repeat("2",64)
 preview:=map[string]any{"identityProfileId":profile,"nameLabelHash":label}
 if x:=post(h,"/v1/identity/preview",preview,session,"https://evil.invalid",flow);x.Code!=403{t.Fatal("cross origin accepted")}
 if x:=post(h,"/v1/identity/preview",preview,session,testOrigin,nil);x.Code!=403{t.Fatal("browser flow not required")}
 if x:=post(h,"/v1/identity/preview",preview,session,testOrigin,flow);x.Code!=503{t.Fatal("unlinked wallet elevated",x.Code)}
 if x:=post(h,"/v1/identity/save",map[string]any{"identityProfileId":profile,"nameLabelHash":label,"consentAccepted":false,"expectedRevision":0},session,testOrigin,flow);x.Code!=400{t.Fatal("consent bypass")}
 if x:=post(h,"/v1/identity/save",map[string]any{"identityProfileId":profile,"nameLabelHash":label,"consentAccepted":true,"expectedRevision":0,"accountId":uid},session,testOrigin,flow);x.Code!=400{t.Fatal("account injection")}
 if x:=post(h,"/v1/identity/preview",map[string]any{"identityProfileId":zero32},session,testOrigin,flow);x.Code!=400{t.Fatal("zero profile accepted")}
 key:=walletTestKeyNumber(t,0x67)
 var walletChallenge WalletLinkChallenge
 readResult(t,post(h,"/v1/wallet/start",map[string]any{"address":key.Address(),"kind":"eoa","consentAccepted":true},session,testOrigin,flow),&walletChallenge)
 if x:=post(h,"/v1/wallet/finish",map[string]string{"challengeId":walletChallenge.ChallengeID,"signature":walletTestSign(t,key,walletChallenge.Message)},session,testOrigin,flow);x.Code!=200{t.Fatal("wallet linking rejected",x.Code)}
 var verified struct{Verification OnChainIdentityDisplay}
 readResult(t,post(h,"/v1/identity/preview",preview,session,testOrigin,flow),&verified)
 if !verified.Verification.IdentityActive||!verified.Verification.BilateralNameVerified{t.Fatal("verified binding absent")}
 var saved struct{Preference IdentityNamesPreference}
 readResult(t,post(h,"/v1/identity/save",map[string]any{"identityProfileId":profile,"nameLabelHash":label,"consentAccepted":true,"expectedRevision":0},session,testOrigin,flow),&saved)
 if saved.Preference.Revision!=1||!saved.Preference.BilateralNameVerified{t.Fatal("saved wrong binding")}
 if x:=post(h,"/v1/identity/save",map[string]any{"identityProfileId":profile,"nameLabelHash":label,"consentAccepted":true,"expectedRevision":0},session,testOrigin,flow);x.Code!=409{t.Fatal("stale revision HTTP accepted",x.Code)}
 readResult(t,post(h,"/v1/identity/current",empty,session,testOrigin,flow),&saved)
 if saved.Preference.IdentityProfileID!=profile{t.Fatal("read current")}
 if x:=post(h,"/v1/wallet/unlink",empty,session,testOrigin,flow);x.Code!=200{t.Fatal("unlink failed")}
 if x:=post(h,"/v1/identity/current",empty,session,testOrigin,flow);x.Code!=503{t.Fatal("unlinked stale preference displayed",x.Code)}
 if x:=post(h,"/v1/identity/clear",empty,session,testOrigin,flow);x.Code!=200{t.Fatal("clear failed",x.Code)}
 var cleared struct{Preference *IdentityNamesPreference}
 readResult(t,post(h,"/v1/identity/current",empty,session,testOrigin,flow),&cleared)
 if cleared.Preference!=nil{t.Fatal("cleared preference visible")}
 if x:=post(h,"/v1/session/logout",empty,session,testOrigin,flow);x.Code!=200{t.Fatal("logout failed")}
 if x:=post(h,"/v1/identity/current",empty,session,testOrigin,flow);x.Code!=401{t.Fatal("revoked session used to read Identity",x.Code)}
}
