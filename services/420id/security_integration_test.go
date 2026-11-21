//go:build account420_integration

package account

import (
 "context"
 "database/sql"
 "errors"
 "os"
 "strings"
 "testing"
 "time"

 _ "github.com/lib/pq"
)

func TestAUTH12AccountRuntimeLeastPrivilegeAndMissingGrants(t *testing.T){
 ctx:=context.Background()
 source,mon,_,_,_:=auth11Setup(t)
 db:=source.auth.store.db
 id,e:=newID();if e!=nil{t.Fatal(e)}
 role:="auth12_account_"+strings.ReplaceAll(id,"-","")
 if _,e=db.ExecContext(ctx,"CREATE ROLE "+role+" NOLOGIN");e!=nil{t.Fatal(e)}
 t.Cleanup(func(){
  if _,e:=db.Exec("DROP OWNED BY "+role);e!=nil{t.Error("drop temporary grants",e)}
  if _,e:=db.Exec("DROP ROLE "+role);e!=nil{t.Error("drop temporary role",e)}
 })
 if _,e=db.ExecContext(ctx,"GRANT USAGE ON SCHEMA account420 TO "+role);e!=nil{t.Fatal(e)}
 probe,e:=sql.Open("postgres",os.Getenv("ACCOUNT420_TEST_DSN"));if e!=nil{t.Fatal(e)}
 probe.SetMaxOpenConns(1)
 t.Cleanup(func(){_ = probe.Close()})
 if _,e=probe.ExecContext(ctx,"SET ROLE "+role);e!=nil{t.Fatal(e)}
 store,e:=NewStore(probe,[]string{"420id","bong-goggles"});if e!=nil{t.Fatal(e)}
 session,e:=NewSessionManager(&Auth{store:store},"420id");if e!=nil{t.Fatal(e)}
 privacy,e:=NewMonetizationManager(session);if e!=nil{t.Fatal(e)}
 if e=privacy.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("schema-only startup accepted",e)}
 grants:=[]string{
  "GRANT SELECT,INSERT ON account420.monetization_consents TO "+role,
  "GRANT UPDATE(reward_opt_in,creator_opt_in,revision,updated_at) ON account420.monetization_consents TO "+role,
 }
 for _,stmt:=range grants{if _,e=db.ExecContext(ctx,stmt);e!=nil{t.Fatal(e)}}
 if e=privacy.ReadyRuntime(ctx);e!=nil{t.Fatal("scoped consent role rejected",e)}
 negative:=[]struct{grant,revoke string}{
  {"GRANT DELETE ON account420.monetization_consents TO "+role,"REVOKE DELETE ON account420.monetization_consents FROM "+role},
  {"GRANT UPDATE ON account420.monetization_consents TO "+role,"REVOKE UPDATE ON account420.monetization_consents FROM "+role},
  {"GRANT TRUNCATE ON account420.monetization_consents TO "+role,"REVOKE TRUNCATE ON account420.monetization_consents FROM "+role},
  {"GRANT UPDATE (account_id) ON account420.monetization_consents TO "+role,"REVOKE UPDATE (account_id) ON account420.monetization_consents FROM "+role},
 }
 for _,v:=range negative{
  if _,e=db.ExecContext(ctx,v.grant);e!=nil{t.Fatal(e)}
  if e=privacy.ReadyRuntime(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("unsafe consent grant accepted",v.grant,e)}
  if _,e=db.ExecContext(ctx,v.revoke);e!=nil{t.Fatal(e)}
 }
 missing:=[]struct{revoke,grant string}{
  {"REVOKE SELECT ON account420.monetization_consents FROM "+role,"GRANT SELECT ON account420.monetization_consents TO "+role},
  {"REVOKE INSERT ON account420.monetization_consents FROM "+role,"GRANT INSERT ON account420.monetization_consents TO "+role},
  {"REVOKE UPDATE (updated_at) ON account420.monetization_consents FROM "+role,"GRANT UPDATE (updated_at) ON account420.monetization_consents TO "+role},
 }
 for _,v:=range missing{
  if _,e=db.ExecContext(ctx,v.revoke);e!=nil{t.Fatal(e)}
  if e=privacy.ReadyRuntime(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("missing consent grant accepted",v.revoke,e)}
  if _,e=db.ExecContext(ctx,v.grant);e!=nil{t.Fatal(e)}
 }
 if e=privacy.ReadyRuntime(ctx);e!=nil{t.Fatal("restored restricted consent role rejected",e)}
 if e=mon.Ready(ctx);e!=nil{t.Fatal("original privileged operator lost migration access",e)}

 // These earlier modes used the PostgreSQL multi-privilege OR check.
 // Confirm incomplete SSO and wallet privileges now fail closed as well.
 sso,e:=NewSSOManager(session,auth11Clients()[:1]);if e!=nil{t.Fatal(e)}
 if e=sso.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("SSO missing privileges accepted",e)}
 if _,e=db.ExecContext(ctx,"GRANT SELECT ON account420.sso_codes TO "+role);e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"GRANT SELECT (sso_source_id) ON account420.sessions TO "+role);e!=nil{t.Fatal(e)}
 if e=sso.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("SSO partial role accepted",e)}
 if _,e=db.ExecContext(ctx,"GRANT INSERT,UPDATE,DELETE ON account420.sso_codes TO "+role);e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"GRANT INSERT (sso_source_id) ON account420.sessions TO "+role);e!=nil{t.Fatal(e)}
 if e=sso.Ready(ctx);e!=nil{t.Fatal("complete SSO grants rejected",e)}
 if _,e=db.ExecContext(ctx,"REVOKE DELETE ON account420.sso_codes FROM "+role);e!=nil{t.Fatal(e)}
 if e=sso.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("SSO missing DELETE accepted",e)}
 wallet,e:=NewWalletLinkManager(session,420,nil);if e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"GRANT SELECT,INSERT,UPDATE ON account420.wallet_links TO "+role);e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"GRANT SELECT,INSERT,UPDATE,DELETE ON account420.wallet_link_challenges TO "+role);e!=nil{t.Fatal(e)}
 if e=wallet.Ready(ctx);e!=nil{t.Fatal("complete wallet grants rejected",e)}
 if _,e=db.ExecContext(ctx,"REVOKE UPDATE ON account420.wallet_links FROM "+role);e!=nil{t.Fatal(e)}
 if e=wallet.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("wallet missing UPDATE accepted",e)}
 if _,e=db.ExecContext(ctx,"GRANT UPDATE ON account420.wallet_links TO "+role);e!=nil{t.Fatal(e)}
 if _,e=db.ExecContext(ctx,"REVOKE DELETE ON account420.wallet_link_challenges FROM "+role);e!=nil{t.Fatal(e)}
 if e=wallet.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("wallet missing DELETE accepted",e)}

 // Identity/Names display preferences are also a four-operation runtime
 // path. One SELECT grant must not be enough to pass its readiness gate.
 identity:=&IdentityNamesManager{sessions:session}
 if _,e=db.ExecContext(ctx,"GRANT SELECT ON account420.identity_names_preferences TO "+role);e!=nil{t.Fatal(e)}
 if e=identity.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("identity partial grants accepted",e)}
 if _,e=db.ExecContext(ctx,"GRANT INSERT,UPDATE,DELETE ON account420.identity_names_preferences TO "+role);e!=nil{t.Fatal(e)}
 if e=identity.Ready(ctx);e!=nil{t.Fatal("complete identity grants rejected",e)}
 if _,e=db.ExecContext(ctx,"REVOKE UPDATE ON account420.identity_names_preferences FROM "+role);e!=nil{t.Fatal(e)}
 if e=identity.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("identity missing UPDATE accepted",e)}
}

func TestAUTH12IntrospectionSerializesRevocationBeforePrivateRead(t *testing.T){
 ctx:=context.Background()
 source,mon,_,_,grant:=auth11Setup(t)
 opted,e:=mon.Set(ctx,grant.Token,true,true,0)
 if e!=nil||!opted.RewardOptIn{t.Fatal("consent setup",e)}
 sso,e:=NewSSOManager(source,auth11Clients()[:1]);if e!=nil{t.Fatal(e)}
 sso.monetization=mon
 client,e:=sso.client("bong-goggles");if e!=nil{t.Fatal(e)}
 request,verifier:=ssoUnitRequest(t,client)
 redirect,e:=sso.Authorize(ctx,grant.Token,request,true,mustRandom(t));if e!=nil{t.Fatal(e)}
 child,e:=sso.Exchange(ctx,client,ssoCode(t,redirect.RedirectURI),verifier,client.redirect);if e!=nil{t.Fatal(e)}
 tx,e:=source.auth.store.db.BeginTx(ctx,nil);if e!=nil{t.Fatal(e)}
 defer tx.Rollback()
 if _,e=tx.ExecContext(ctx,"UPDATE account420.sessions SET revoked_at=clock_timestamp() WHERE id=$1",grant.Session.ID);e!=nil{t.Fatal(e)}
 type result struct{state SSOIntrospection;err error}
 done:=make(chan result,1)
 go func(){v,e:=sso.Introspect(ctx,client,child.AccessToken);done<-result{v,e}}()
 select{
 case result:=<-done:t.Fatalf("introspection ignored uncommitted parent-session revocation: %+v",result)
 case <-time.After(120*time.Millisecond):
 }
 if e=tx.Commit();e!=nil{t.Fatal(e)}
 select{
 case result:=<-done:
  if result.err!=nil||result.state.Active||result.state.Monetization!=nil{
   t.Fatal("post-revocation private status remained visible",result)
  }
 case <-time.After(5*time.Second):t.Fatal("introspection did not release after parent commit")
 }
}
