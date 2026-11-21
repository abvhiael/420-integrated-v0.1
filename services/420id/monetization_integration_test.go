//go:build account420_integration

package account

import (
 "context"
 "encoding/json"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "sync"
 "testing"
)

func auth11Clients()[]SSOClient{return []SSOClient{
 {App:"bong-goggles",Name:"BongGoggles",RedirectURI:"https://bonggoggles.420integrated.org/social-api/auth/callback",Secret:encodeBytes([]byte(strings.Repeat("q",32)))},
 {App:"doobtube",Name:"DoobTube",RedirectURI:"https://doobtube.420integrated.org/auth/420id/callback",Secret:encodeBytes([]byte(strings.Repeat("r",32)))},
}}
func auth11Setup(t *testing.T)(*SessionManager,*MonetizationManager,*testMailer,*Auth,SessionGrant){
 t.Helper()
 db:=sessionDB(t)
 store,e:=NewStore(db,[]string{"420id","bong-goggles","doobtube"});if e!=nil{t.Fatal(e)}
 mail:=&testMailer{}
 auth,e:=NewAuth(store,mail,testOrigin,testRP);if e!=nil{t.Fatal(e)}
 source,e:=NewSessionManager(auth,"420id");if e!=nil{t.Fatal(e)}
 mon,e:=NewMonetizationManager(source);if e!=nil{t.Fatal(e)}
 if e=mon.Ready(context.Background());e!=nil{t.Fatal("migration/grants",e)}
 id,_:=newID()
 grant:=mustIssueSession(t,source,freshEmail(t,auth,mail,id+"@example.org").Proof)
 return source,mon,mail,auth,grant
}
func TestAUTH11ConsentWalletReadinessAndSSOAppIsolation(t *testing.T){
 ctx:=context.Background()
 source,mon,_,_,grant:=auth11Setup(t)
 if _,e:=NewMonetizationManager(nil);!errors.Is(e,ErrInvalid){t.Fatal("nil authority")}
 if _,e:=NewMonetizationManager(&SessionManager{});!errors.Is(e,ErrInvalid){t.Fatal("unscoped authority")}
 initial,e:=mon.Current(ctx,grant.Token)
 if e!=nil||initial.Version!=0||initial.WalletLinked||initial.RewardOptIn||initial.CanClaim||initial.FinancialAuthority{t.Fatal("wallet-free baseline",initial,e)}
 if _,e=mon.Set(ctx,grant.Token,true,false,1);!errors.Is(e,ErrConflict){t.Fatal("stale activation accepted",e)}
 opted,e:=mon.Set(ctx,grant.Token,true,true,0)
 if e!=nil||opted.Version!=1||opted.RewardStage!="wallet_required"||opted.CreatorStage!="operator_programme_required"||opted.Paid||opted.CanClaim{t.Fatal("incorrect activation",opted,e)}
 if _,e=mon.Set(ctx,grant.Token,true,true,0);!errors.Is(e,ErrConflict){t.Fatal("replayed consent",e)}
 client,e:=NewSSOManager(source,auth11Clients());if e!=nil{t.Fatal(e)}
 client.monetization=mon
 bg,e:=client.client("bong-goggles");if e!=nil{t.Fatal(e)}
 doob,e:=client.client("doobtube");if e!=nil{t.Fatal(e)}
 binding:=mustRandom(t)
 issue:=func(c ssoClient)SSOExchange{
  t.Helper()
  req,verifier:=ssoUnitRequest(t,c)
  authorize,e:=client.Authorize(ctx,grant.Token,req,true,binding);if e!=nil{t.Fatal(e)}
  out,e:=client.Exchange(ctx,c,ssoCode(t,authorize.RedirectURI),verifier,c.redirect)
  if e!=nil{t.Fatal(e)}
  return out
 }
 bgGrant:=issue(bg)
 seen,e:=client.Introspect(ctx,bg,bgGrant.AccessToken)
 if e!=nil||!seen.Active||seen.Monetization==nil||!seen.Monetization.RewardOptIn||seen.Monetization.WalletLinked||seen.Monetization.CanClaim{t.Fatal("BongGoggles scoped consent",seen,e)}
 otherGrant:=issue(doob)
 other,e:=client.Introspect(ctx,doob,otherGrant.AccessToken)
 if e!=nil||!other.Active||other.Monetization!=nil{t.Fatal("cross-app leaked opt-in",other,e)}
 if other,e=client.Introspect(ctx,bg,otherGrant.AccessToken);e!=nil||other.Active||other.Monetization!=nil{t.Fatal("cross-client replay",other,e)}
 key:=walletTestKey(t)
 w,e:=NewWalletLinkManager(source,420,nil);if e!=nil{t.Fatal(e)}
 // Browser digest is bound to the challenge. No arbitrary wallet string
 // can be submitted as a payment or programme activation.
 bindWallet:=mustRandom(t)
 challenge,e:=w.Begin(ctx,grant.Token,key.Address(),"eoa",true,bindWallet);if e!=nil{t.Fatal(e)}
 if _,e=w.Complete(ctx,grant.Token,challenge.ChallengeID,walletTestSign(t,key,challenge.Message),bindWallet);e!=nil{t.Fatal(e)}
 seen,e=client.Introspect(ctx,bg,bgGrant.AccessToken)
 if e!=nil||seen.Monetization==nil||!seen.Monetization.WalletLinked||seen.Monetization.RewardStage!="canonical_verification_required"||seen.Monetization.CanClaim{t.Fatal("link minted illicit right",seen,e)}
 raw,_:=json.Marshal(seen)
 if strings.Contains(string(raw),key.Address())||strings.Contains(string(raw),string(grant.Session.Subject.ID))||strings.Contains(string(raw),grant.Token){t.Fatal("420ID private identifiers leaked")}
 if e=w.Unlink(ctx,grant.Token);e!=nil{t.Fatal(e)}
 seen,e=client.Introspect(ctx,bg,bgGrant.AccessToken)
 if e!=nil||seen.Monetization==nil||seen.Monetization.WalletLinked||seen.Monetization.RewardStage!="wallet_required"{t.Fatal("unlink retained readiness",seen,e)}
 revoked,e:=mon.Set(ctx,grant.Token,false,false,1)
 if e!=nil||revoked.Version!=2||revoked.RewardOptIn||revoked.CanClaim{t.Fatal("revocation",revoked,e)}
 seen,e=client.Introspect(ctx,bg,bgGrant.AccessToken)
 if e!=nil||seen.Monetization==nil||seen.Monetization.RewardOptIn||seen.Monetization.WalletLinked{t.Fatal("revoked programme leaked",seen,e)}
 if e=source.Logout(ctx,grant.Token);e!=nil{t.Fatal(e)}
 if _,e=mon.Current(ctx,grant.Token);!errors.Is(e,ErrAuthentication){t.Fatal("revoked owner still read",e)}
 seen,e=client.Introspect(ctx,bg,bgGrant.AccessToken)
 if e!=nil||seen.Active{t.Fatal("revoked source still authorizes app",seen,e)}
}
func TestAUTH11ConcurrentConsentVersionAndNoFinancialAuthority(t *testing.T){
 ctx:=context.Background();_,mon,_,_,grant:=auth11Setup(t)
 var wg sync.WaitGroup;answers:=make(chan error,8)
 for i:=0;i<8;i++{wg.Add(1);go func(n int){defer wg.Done();_,e:=mon.Set(ctx,grant.Token,n%2==0,n%2==1,0);answers<-e}(i)}
 wg.Wait();close(answers);ok,conflicts:=0,0
 for e:=range answers{if e==nil{ok++}else if errors.Is(e,ErrConflict){conflicts++}else{t.Fatal(e)}}
 if ok!=1||conflicts!=7{t.Fatal("lost version race",ok,conflicts)}
 state,e:=mon.Current(ctx,grant.Token)
 if e!=nil||state.Version!=1||state.CanClaim||state.Paid||state.PaymentAuthorized||state.FinancialAuthority{t.Fatal("financial authority minted",state,e)}
}
func TestAUTH11OwnerOnlyConsentHTTPAndFailClosedMode(t *testing.T){
 ctx:=context.Background();source,mon,_,auth,grant:=auth11Setup(t)
 clients:=auth11Clients()[:1]
 cfg:=AcceptanceConfig{Emails:[]string{},RateKey:mustRandom(t),SessionApp:"420id",ProfileMode:true,WalletMode:true,WalletChainID:420,SSOClients:clients,MonetizationMode:true}
 var email string
 if e:=auth.store.db.QueryRowContext(ctx,`SELECT email FROM account420.email_identities WHERE account_id=$1`,mustAccountID(t,source,grant.Token)).Scan(&email);e!=nil{t.Fatal(e)}
 cfg.Emails=[]string{email}
 h,e:=NewAcceptanceHandler(auth,cfg);if e!=nil{t.Fatal(e)}
 if e=h.Purge(ctx);e!=nil{t.Fatal(e)}
 no:=cfg;no.MonetizationMode=false
 legacy,e:=NewAcceptanceHandler(auth,no);if e!=nil{t.Fatal(e)}
 broken:=cfg;broken.WalletMode=false
 if _,e=NewAcceptanceHandler(auth,broken);!errors.Is(e,ErrInvalid){t.Fatal("walletless mode bypass",e)}
 broken=cfg;broken.SSOClients=nil
 if _,e=NewAcceptanceHandler(auth,broken);!errors.Is(e,ErrInvalid){t.Fatal("unapproved app bypass",e)}
 browser:=acceptRequest(h,"GET","/","","",nil).Result().Cookies()[0]
 app:=&http.Cookie{Name:sessionCookie,Value:grant.Token}
 post:=func(handler *AcceptanceHandler,path string,payload string,origin string,flow,session *http.Cookie)*httptest.ResponseRecorder{
  req:=httptest.NewRequest("POST",testOrigin+path,strings.NewReader(payload))
  req.RemoteAddr="127.0.0.33:12345"
  req.Header.Set("Content-Type","application/json");req.Header.Set("Origin",origin)
  if flow!=nil{req.AddCookie(flow)};if session!=nil{req.AddCookie(session)}
  w:=httptest.NewRecorder();handler.ServeHTTP(w,req);return w
 }
 if w:=post(legacy,"/v1/monetization/status","{}",testOrigin,browser,app);w.Code!=404{t.Fatal("legacy exposed",w.Code)}
 if w:=post(h,"/v1/monetization/status","{}",testOrigin,browser,nil);w.Code!=401{t.Fatal("anonymous status",w.Code)}
 if w:=post(h,"/v1/monetization/status","{}",testOrigin,nil,app);w.Code!=403{t.Fatal("missing CSRF flow",w.Code)}
 if w:=post(h,"/v1/monetization/status","{}","https://evil.invalid",browser,app);w.Code!=403{t.Fatal("cross-origin status",w.Code)}
 if w:=post(h,"/v1/monetization/consent",`{"rewardOptIn":true,"creatorOptIn":false,"expectedVersion":0}`,testOrigin,browser,app);w.Code!=400{t.Fatal("missing affirmative consent",w.Code)}
 if w:=post(h,"/v1/monetization/consent",`{"rewardOptIn":true,"creatorOptIn":true,"consentAccepted":true,"expectedVersion":0,"wallet":"0x123"}`,testOrigin,browser,app);w.Code!=400{t.Fatal("wallet injection",w.Code)}
 if w:=post(h,"/v1/monetization/consent",`{"rewardOptIn":true,"rewardOptIn":false,"creatorOptIn":true,"consentAccepted":true,"expectedVersion":0}`,testOrigin,browser,app);w.Code!=400{t.Fatal("duplicate JSON accepted",w.Code)}
 if w:=post(h,"/v1/monetization/consent",`{"rewardOptIn":true,"creatorOptIn":false,"consentAccepted":true,"expectedVersion":0}`,testOrigin,browser,app);w.Code!=200{t.Fatal("opt-in denied",w.Code,w.Body.String())}
 if w:=post(h,"/v1/monetization/status","{}",testOrigin,browser,app);w.Code!=200||!strings.Contains(w.Body.String(),"wallet_required")||strings.Contains(w.Body.String(),string(mustAccountID(t,source,grant.Token))){t.Fatal("private status",w.Code,w.Body.String())}
 if w:=post(h,"/v1/monetization/consent",`{"rewardOptIn":false,"creatorOptIn":false,"expectedVersion":1}`,testOrigin,browser,app);w.Code!=200{t.Fatal("revoke requires enable consent",w.Code)}
 if e=source.Logout(ctx,grant.Token);e!=nil{t.Fatal(e)}
 if w:=post(h,"/v1/monetization/status","{}",testOrigin,browser,app);w.Code!=401{t.Fatal("revoked session",w.Code)}
 if s,e:=mon.Current(ctx,grant.Token);!errors.Is(e,ErrAuthentication)||s.RewardOptIn{t.Fatal("revoked read",e)}
}
func mustAccountID(t *testing.T,s *SessionManager,token string)AccountID{
 t.Helper()
 d,e:=tokenDigest(token);if e!=nil{t.Fatal(e)}
 var id AccountID
 if e=s.auth.store.db.QueryRow("SELECT account_id FROM account420.sessions WHERE token_digest=$1",d).Scan(&id);e!=nil{t.Fatal(e)}
 return id
}
