//go:build account420_integration
package account
import(
 "context"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
)
func TestWalletHTTPRequiresConsentAndAUTH3(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t)
 a,mail:=sessionAuth(t,db,testOrigin,testRP)
 uid,_:=newID();email:=uid+"@example.org"
 base:=AcceptanceConfig{Emails:[]string{email},RateKey:mustRandom(t),SessionApp:"bong-goggles",ProfileMode:true}
 auth4,e:=NewAcceptanceHandler(a,base);if e!=nil{t.Fatal(e)}
 cfg:=base;cfg.WalletMode=true;cfg.WalletChainID=420
 wallet,e:=NewAcceptanceHandler(a,cfg);if e!=nil{t.Fatal(e)}
 if e=wallet.wallet.Ready(ctx);e!=nil{t.Fatal(e)}
 if _,e=NewAcceptanceHandler(a,AcceptanceConfig{Emails:base.Emails,RateKey:base.RateKey,SessionApp:base.SessionApp,WalletMode:true,WalletChainID:420});e==nil{t.Fatal("wallet without profile gate")}
 noChain:=cfg;noChain.WalletChainID=0
 if _,e=NewAcceptanceHandler(a,noChain);e==nil{t.Fatal("unpinned chain allowed")}
 page:=acceptRequest(wallet,"GET","/","","",nil)
 if page.Code!=200||!strings.Contains(page.Body.String(),"Optional 420Wallet linking"){t.Fatal("wallet page missing")}
 flow:=page.Result().Cookies()[0]
 if w:=acceptRequest(auth4,"GET","/","","",nil);w.Code!=200||strings.Contains(w.Body.String(),"wallet-heading"){t.Fatal("AUTH-4 changed")}
 for _,path:=range []string{"/wallet-session.mjs","/wallet-ui.mjs"}{
  if w:=acceptRequest(auth4,"GET",path,"","",nil);w.Code!=404{t.Fatal("prior mode exposed wallet JS",path)}
  if w:=acceptRequest(wallet,"GET",path,"","",nil);w.Code!=200{t.Fatal("wallet JS missing",path)}
 }
 post:=func(handler http.Handler,path string,body any,session *http.Cookie,origin string,flowCookie *http.Cookie)*httptest.ResponseRecorder{
  r:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(jsonBody(t,body)))
  r.RemoteAddr="127.0.0.10:12345"
  r.Header.Set("Origin",origin);r.Header.Set("Content-Type","application/json")
  if flowCookie!=nil{r.AddCookie(flowCookie)}
  if session!=nil{r.AddCookie(session)}
  w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w
 }
 key:=walletTestKeyNumber(t,0x44);addr:=key.Address()
 if w:=post(auth4,"/v1/wallet/current",struct{}{},nil,testOrigin,flow);w.Code!=404{t.Fatal("AUTH-4 wallet route",w.Code)}
 if w:=post(wallet,"/v1/wallet/current",struct{}{},nil,testOrigin,flow);w.Code!=401{t.Fatal("guest saw wallet",w.Code)}
 var challenge EmailStart
 readResult(t,post(wallet,"/v1/email/start",map[string]string{"email":email},nil,testOrigin,flow),&challenge)
 response:=post(wallet,"/v1/email/finish",map[string]string{"challengeId":challenge.ChallengeID,"secret":mail.secret},nil,testOrigin,flow)
 if response.Code!=200{t.Fatal("email sign-in failed",response.Code)}
 cookies:=response.Result().Cookies()
 if len(cookies)!=1||cookies[0].Name!=sessionCookie{t.Fatal("AUTH-3 cookie missing")}
 session:=cookies[0]
 start:=map[string]any{"address":addr,"kind":"eoa","consentAccepted":true}
 if w:=post(wallet,"/v1/wallet/start",start,session,"https://other.invalid",flow);w.Code!=403{t.Fatal("CSRF bypass",w.Code)}
 if w:=post(wallet,"/v1/wallet/start",start,session,testOrigin,nil);w.Code!=403{t.Fatal("missing browser cookie",w.Code)}
 if w:=post(wallet,"/v1/wallet/start",map[string]any{"address":addr,"kind":"eoa","consentAccepted":false},session,testOrigin,flow);w.Code!=400{t.Fatal("unsigned consent",w.Code)}
 if w:=post(wallet,"/v1/wallet/start",map[string]any{"address":addr,"kind":"eoa","consentAccepted":true,"chainId":1},session,testOrigin,flow);w.Code!=400{t.Fatal("client chain injection",w.Code)}
 if w:=post(wallet,"/v1/wallet/start",map[string]any{"address":addr,"kind":"contract","consentAccepted":true},session,testOrigin,flow);w.Code!=503{t.Fatal("unconfigured 1271 verifier was enabled",w.Code)}
 var issued WalletLinkChallenge
 readResult(t,post(wallet,"/v1/wallet/start",start,session,testOrigin,flow),&issued)
 if issued.ChainID!=420||issued.Address!=addr||issued.Kind!="eoa"{t.Fatal("challenge scope")}
 sig:=walletTestSign(t,key,issued.Message)
 if w:=post(wallet,"/v1/wallet/finish",map[string]string{"challengeId":issued.ChallengeID,"signature":"0x"+strings.Repeat("0",130)},session,testOrigin,flow);w.Code!=401{t.Fatal("forged signature accepted",w.Code)}
 var r struct{Wallet *WalletLink}
 readResult(t,post(wallet,"/v1/wallet/current",struct{}{},session,testOrigin,flow),&r)
 if r.Wallet!=nil{t.Fatal("forgery linked wallet")}
 readResult(t,post(wallet,"/v1/wallet/finish",map[string]string{"challengeId":issued.ChallengeID,"signature":sig},session,testOrigin,flow),&r)
 if r.Wallet==nil||r.Wallet.Address!=addr{t.Fatal("genuine proof rejected")}
 if w:=post(wallet,"/v1/wallet/finish",map[string]string{"challengeId":issued.ChallengeID,"signature":sig},session,testOrigin,flow);w.Code!=401{t.Fatal("nonce replay",w.Code)}
 if w:=post(wallet,"/v1/wallet/start",start,session,testOrigin,flow);w.Code!=409{t.Fatal("two active wallet links",w.Code)}
 readResult(t,post(wallet,"/v1/wallet/current",struct{}{},session,testOrigin,flow),&r)
 if r.Wallet==nil||r.Wallet.Address!=addr{t.Fatal("wallet absent")}
 if w:=post(wallet,"/v1/wallet/unlink",map[string]string{"otherAccount":"a"},session,testOrigin,flow);w.Code!=400{t.Fatal("foreign account injection",w.Code)}
 if w:=post(wallet,"/v1/wallet/unlink",struct{}{},session,testOrigin,flow);w.Code!=200{t.Fatal("authorized unlink",w.Code)}
 readResult(t,post(wallet,"/v1/wallet/current",struct{}{},session,testOrigin,flow),&r)
 if r.Wallet!=nil{t.Fatal("wallet still linked")}
 if w:=post(wallet,"/v1/session/status",struct{}{},session,testOrigin,flow);w.Code!=200{t.Fatal("unlink killed 420ID session")}
 if w:=post(wallet,"/v1/session/logout",struct{}{},session,testOrigin,flow);w.Code!=200{t.Fatal("session logout")}
 if w:=post(wallet,"/v1/wallet/current",struct{}{},session,testOrigin,flow);w.Code!=401{t.Fatal("revoked session wallet access")}
}
