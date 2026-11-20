//go:build account420_integration

package account

import (
 "bytes"
 "context"
 "crypto/sha256"
 "encoding/json"
 "errors"
 "database/sql"
 "net/url"
 "strings"
 "sync"
 "testing"
)

func ssoIntegrationAuth(t *testing.T,db *sql.DB)(*Auth,*testMailer,*SessionManager){
 t.Helper()
 store,e:=NewStore(db,[]string{"bong-goggles","doobtube","420town"})
 if e!=nil{t.Fatal(e)}
 mail:=&testMailer{}
 auth,e:=NewAuth(store,mail,testOrigin,testRP);if e!=nil{t.Fatal(e)}
 source,e:=NewSessionManager(auth,"bong-goggles");if e!=nil{t.Fatal(e)}
 return auth,mail,source
}
func ssoIntegrationClients()[]SSOClient{return []SSOClient{
 {App:"doobtube",Name:"DoobTube",RedirectURI:"https://doobtube.420integrated.org/auth/420id/callback",Secret:encodeBytes([]byte(strings.Repeat("x",32)))},
 {App:"420town",Name:"420Town",RedirectURI:"https://town.420integrated.org/auth/420id/callback",Secret:encodeBytes([]byte(strings.Repeat("y",32)))},
}}
func ssoCode(t *testing.T,redirect string)string{
 t.Helper()
 u,e:=url.Parse(redirect);if e!=nil{t.Fatal(e)}
 code:=u.Query().Get("code")
 if _,e=decodeToken(code);e!=nil{t.Fatal("invalid authorization code",e)}
 if len(u.Query())!=2||u.Query().Get("state")==""{t.Fatal("unsafe redirect query")}
 return code
}
func TestSSODurableAppScopedTokenAndParentLifecycle(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t);db2:=sessionDB(t)
 a,mail,source:=ssoIntegrationAuth(t,db)
 _,_,source2:=ssoIntegrationAuth(t,db2)
 clients:=ssoIntegrationClients()
 s,e:=NewSSOManager(source,clients);if e!=nil{t.Fatal(e)}
 s2,e:=NewSSOManager(source2,clients);if e!=nil{t.Fatal(e)}
 if e=s.Ready(ctx);e!=nil{t.Fatal("migration 008 not ready",e)}
 id,_:=newID();email:=id+"@example.org"
 grant:=mustIssueSession(t,source,freshEmail(t,a,mail,email).Proof)
 binding:=mustRandom(t);wrong:=mustRandom(t)
 c,e:=s.CheckClient("doobtube",clients[0].Secret);if e!=nil{t.Fatal(e)}
 town,e:=s.CheckClient("420town",clients[1].Secret);if e!=nil{t.Fatal(e)}
 request,verifier:=ssoUnitRequest(t,c)
 if _,e=s.Authorize(ctx,grant.Token,request,false,binding);!errors.Is(e,ErrInvalid){t.Fatal("silent consent",e)}
 if _,e=s.Authorize(ctx,"invalid",request,true,binding);!errors.Is(e,ErrAuthentication){t.Fatal("missing central session",e)}
 result,e:=s.Authorize(ctx,grant.Token,request,true,binding);if e!=nil{t.Fatal(e)}
 if !strings.HasPrefix(result.RedirectURI,c.redirect+"?code=")||strings.Contains(result.RedirectURI,grant.Token)||strings.Contains(result.RedirectURI,string(grant.Session.Subject.ID)){t.Fatal("unsafe callback",result)}
 oldCode:=ssoCode(t,result.RedirectURI)
 // Explicit consent supersedes earlier codes for the same source and app.
 replacement,e:=s.Authorize(ctx,grant.Token,request,true,wrong);if e!=nil{t.Fatal(e)}
 if _,e=s2.Exchange(ctx,c,oldCode,verifier,c.redirect);!errors.Is(e,ErrAuthentication){t.Fatal("superseded code redeemed",e)}
 code:=ssoCode(t,replacement.RedirectURI)
 if _,e=s2.Exchange(ctx,town,code,verifier,town.redirect);!errors.Is(e,ErrAuthentication){t.Fatal("cross-client code redemption",e)}
 if _,e=s2.Exchange(ctx,c,code,verifier,c.redirect+"/other");!errors.Is(e,ErrAuthentication){t.Fatal("callback substitution",e)}
 if _,e=s2.Exchange(ctx,c,code,"Z"+verifier[1:],c.redirect);!errors.Is(e,ErrAuthentication){t.Fatal("invalid PKCE accepted",e)}
 // Two distinct backend instances race the identical authorization code.
 var wg sync.WaitGroup;results:=make(chan SSOExchange,2)
 for _,service:=range []*SSOManager{s,s2}{wg.Add(1);go func(m *SSOManager){defer wg.Done()
  out,e:=m.Exchange(ctx,c,code,verifier,c.redirect)
  if e==nil{results<-out}else if !errors.Is(e,ErrAuthentication){t.Errorf("exchange race: %v",e)}
 }(service)}
 wg.Wait();close(results)
 var exchanged SSOExchange;count:=0
 for x:=range results{exchanged=x;count++}
 if count!=1{t.Fatal("non-atomic redemption",count)}
 if exchanged.TokenType!="Bearer"||exchanged.Session.Method!="sso"||
  exchanged.Session.Subject.App!="doobtube"||exchanged.Session.Subject.ID==grant.Session.Subject.ID||
  !validID(exchanged.Session.Subject.ID)||!validID(exchanged.Session.ID){t.Fatal("wrong app scope",exchanged.Session)}
 if exchanged.Session.ExpiresAt.After(grant.Session.ExpiresAt)||exchanged.Session.IdleUntil.After(grant.Session.IdleUntil){t.Fatal("SSO outlived source",exchanged)}
 if _,e=s.Exchange(ctx,c,code,verifier,c.redirect);!errors.Is(e,ErrAuthentication){t.Fatal("code replay accepted",e)}
 raw,e:=json.Marshal(exchanged.Session)
 if e!=nil||strings.Contains(string(raw),email)||strings.Contains(string(raw),string(grant.Session.Subject.ID))||
  strings.Contains(string(raw),string(grant.Session.ID))||strings.Contains(string(raw),exchanged.AccessToken){t.Fatal("app response leaked authority")}
 data,e:=decodeToken(exchanged.AccessToken);if e!=nil{t.Fatal(e)};digest:=sha256.Sum256(data)
 var stored []byte
 if e=db.QueryRowContext(ctx,"SELECT token_digest FROM account420.sessions WHERE id=$1",exchanged.Session.ID).Scan(&stored);e!=nil||!bytes.Equal(stored,digest[:])||bytes.Equal(stored,data){t.Fatal("token stored in plaintext",e)}
 seen,e:=s2.Introspect(ctx,c,exchanged.AccessToken)
 if e!=nil||!seen.Active||seen.Method!="sso"||seen.Subject==nil||*seen.Subject!=exchanged.Session.Subject{t.Fatal("app introspection",seen,e)}
 seen,e=s.Introspect(ctx,town,exchanged.AccessToken)
 if e!=nil||seen.Active||seen.Subject!=nil{t.Fatal("cross-app session leaked",seen,e)}
 if seen,e=s.Introspect(ctx,c,grant.Token);e!=nil||seen.Active{t.Fatal("source token accepted in app",seen,e)}
 // Issuing a separate app SSO session does not reuse source/app tokens.
 townRequest,townVerifier:=ssoUnitRequest(t,town)
 townAuth,e:=s.Authorize(ctx,grant.Token,townRequest,true,binding);if e!=nil{t.Fatal(e)}
 other,e:=s2.Exchange(ctx,town,ssoCode(t,townAuth.RedirectURI),townVerifier,town.redirect)
 if e!=nil||other.Session.Subject.App!="420town"||other.Session.Subject.ID==exchanged.Session.Subject.ID{t.Fatal("second app not isolated",other,e)}
 if e=s.Revoke(ctx,c,exchanged.AccessToken);e!=nil{t.Fatal("per-app logout",e)}
 if state,e:=s2.Introspect(ctx,c,exchanged.AccessToken);e!=nil||state.Active{t.Fatal("revoked app session active",e)}
 if state,e:=s2.Introspect(ctx,town,other.AccessToken);e!=nil||!state.Active{t.Fatal("one app revoked another",e)}
 if _,e=source.Validate(ctx,grant.Token);e!=nil{t.Fatal("app logout revoked source",e)}
 // Independently expired central sessions invalidate all child sessions
 // even when the target app bearer itself is not expired.
 if _,e=db.ExecContext(ctx,"UPDATE account420.sessions SET issued_at=clock_timestamp()-interval '2 days',idle_until=clock_timestamp()-interval '1 second' WHERE id=$1",grant.Session.ID);e!=nil{t.Fatal(e)}
 if state,e:=s2.Introspect(ctx,town,other.AccessToken);e!=nil||state.Active{t.Fatal("expired central session did not invalidate child",e)}
 target,e:=NewSessionManager(a,"420town");if e!=nil{t.Fatal(e)}
 deniedSession(t,target,other.AccessToken)
 if e=source.PurgeExpired(ctx);e!=nil{t.Fatal("cleanup",e)}
 if state,e:=s2.Introspect(ctx,town,other.AccessToken);e!=nil||state.Active{t.Fatal("orphan app session survived cleanup",e)}
}
func TestSSOSourceLogoutRecoveryAndGlobalLogout(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t)
 a,mail,source:=ssoIntegrationAuth(t,db)
 s,e:=NewSSOManager(source,ssoIntegrationClients());if e!=nil{t.Fatal(e)}
 c,_:=s.client("doobtube");town,_:=s.client("420town")
 id,_:=newID();email:=id+"@example.org"
 sourceGrant:=mustIssueSession(t,source,freshEmail(t,a,mail,email).Proof)
 bind:=mustRandom(t)
 issue:=func(c ssoClient)SSOExchange{
  t.Helper();req,verifier:=ssoUnitRequest(t,c)
  auth,e:=s.Authorize(ctx,sourceGrant.Token,req,true,bind);if e!=nil{t.Fatal(e)}
  grant,e:=s.Exchange(ctx,c,ssoCode(t,auth.RedirectURI),verifier,c.redirect);if e!=nil{t.Fatal(e)}
  return grant
 }
 first:=issue(c);second:=issue(town)
 if e=s.LogoutAll(ctx,sourceGrant.Token);e!=nil{t.Fatal(e)}
 for _,v:=range []struct{c ssoClient;token string}{{c,first.AccessToken},{town,second.AccessToken}}{
  seen,e:=s.Introspect(ctx,v.c,v.token);if e!=nil||seen.Active{t.Fatal("global signout left active app",e)}
 }
 deniedSession(t,source,sourceGrant.Token)
 if _,e=s.Authorize(ctx,sourceGrant.Token,ssoUnitRequestOnly(t,c),true,bind);!errors.Is(e,ErrAuthentication){t.Fatal("signed out source authorized another app",e)}
 fresh:=mustIssueSession(t,source,freshEmail(t,a,mail,email).Proof)
 sourceGrant=fresh
 again:=issue(c)
 if state,e:=s.Introspect(ctx,c,again.AccessToken);e!=nil||!state.Active{t.Fatal("subsequent verified login blocked",e)}
 // A newer account revision from suspension invalidates both source and
 // child tokens without separately consulting target app-local state.
 if _,e=a.store.Transition(ctx,freshEmailAccountID(t,a,mail,email),1,Suspended);e!=nil{t.Fatal(e)}
 if state,e:=s.Introspect(ctx,c,again.AccessToken);e!=nil||state.Active{t.Fatal("suspended account retained SSO",e)}
}
func ssoUnitRequestOnly(t *testing.T,c ssoClient)SSORequest{r,_:=ssoUnitRequest(t,c);return r}
func freshEmailAccountID(t *testing.T,a *Auth,mail *testMailer,email string)AccountID{
 t.Helper()
 return freshEmail(t,a,mail,email).Proof.AccountID()
}
func TestSSOExpiredAndInvalidCodeNoSession(t *testing.T){
 ctx:=context.Background();db:=sessionDB(t)
 a,mail,source:=ssoIntegrationAuth(t,db)
 s,_:=NewSSOManager(source,ssoIntegrationClients())
 client,_:=s.client("doobtube")
 id,_:=newID();grant:=mustIssueSession(t,source,freshEmail(t,a,mail,id+"@example.org").Proof)
 request,verifier:=ssoUnitRequest(t,client)
 authorization,e:=s.Authorize(ctx,grant.Token,request,true,mustRandom(t));if e!=nil{t.Fatal(e)}
 code:=ssoCode(t,authorization.RedirectURI)
 b,_:=decodeToken(code);digest:=sha256.Sum256(b)
 if _,e=db.ExecContext(ctx,"UPDATE account420.sso_codes SET expires_at=clock_timestamp()-interval '1 second' WHERE code_digest=$1",digest[:]);e!=nil{t.Fatal(e)}
 if _,e=s.Exchange(ctx,client,code,verifier,client.redirect);!errors.Is(e,ErrAuthentication){t.Fatal("expired authorization code redeemed",e)}
 var count int
 if e=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.sessions WHERE app_id='doobtube' AND account_id=$1",freshEmailAccountID(t,a,mail,id+"@example.org")).Scan(&count);e!=nil||count!=0{t.Fatal("expired code created session",e,count)}
}
