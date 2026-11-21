//go:build account420_integration

package social

import (
 "context"
 "database/sql"
 "errors"
 "fmt"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "testing"

 _ "github.com/lib/pq"
)

func TestAUTH12SocialRuntimeRejectsMissingAndForbiddenGrants(t *testing.T){
 store,_,_,_:=fixture(t)
 ctx:=context.Background()
 id,e:=newID();if e!=nil{t.Fatal(e)}
 role:="auth12_social_"+strings.ReplaceAll(id,"-","")
 if _,e=store.DB.ExecContext(ctx,"CREATE ROLE "+role+" NOLOGIN");e!=nil{t.Fatal(e)}
 t.Cleanup(func(){
  if _,e:=store.DB.Exec("DROP OWNED BY "+role);e!=nil{t.Error("drop temporary grants",e)}
  if _,e:=store.DB.Exec("DROP ROLE "+role);e!=nil{t.Error("drop temporary role",e)}
 })
 if _,e=store.DB.ExecContext(ctx,"GRANT USAGE ON SCHEMA bg_account_social TO "+role);e!=nil{t.Fatal(e)}
 probe,e:=sql.Open("postgres",os.Getenv("ACCOUNT420_TEST_DSN"));if e!=nil{t.Fatal(e)}
 probe.SetMaxOpenConns(1)
 t.Cleanup(func(){_ = probe.Close()})
 if _,e=probe.ExecContext(ctx,"SET ROLE "+role);e!=nil{t.Fatal(e)}
 subject,_:=NewStore(probe)
 if e=subject.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("no-grant startup accepted",e)}
 grants:=[]string{
  "GRANT SELECT, INSERT ON bg_account_social.members,bg_account_social.posts,bg_account_social.comments TO "+role,
  "GRANT INSERT ON bg_account_social.reports TO "+role,
  "GRANT UPDATE(display_name,bio) ON bg_account_social.members TO "+role,
  "GRANT UPDATE(deleted_at) ON bg_account_social.posts TO "+role,
  "GRANT SELECT,INSERT,DELETE ON bg_account_social.reactions,bg_account_social.follows,bg_account_social.blocks,bg_account_social.sessions,bg_account_social.login_flows TO "+role,
  "GRANT SELECT,INSERT,UPDATE,DELETE ON bg_account_social.rate_buckets TO "+role,
 }
 for _,stmt:=range grants{if _,e=store.DB.ExecContext(ctx,stmt);e!=nil{t.Fatal("base grants",e)}}
 if e=subject.ReadyRuntime(ctx);e!=nil{t.Fatal("least privilege startup denied",e)}
 missing:=[]struct{revoke,restore string}{
  {"REVOKE INSERT ON bg_account_social.members FROM "+role,"GRANT INSERT ON bg_account_social.members TO "+role},
  {"REVOKE DELETE ON bg_account_social.follows FROM "+role,"GRANT DELETE ON bg_account_social.follows TO "+role},
  {"REVOKE UPDATE (deleted_at) ON bg_account_social.posts FROM "+role,"GRANT UPDATE (deleted_at) ON bg_account_social.posts TO "+role},
 }
 for _,v:=range missing{
  if _,e=store.DB.ExecContext(ctx,v.revoke);e!=nil{t.Fatal(e)}
  if e=subject.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("missing grant accepted",v.revoke,e)}
  if _,e=store.DB.ExecContext(ctx,v.restore);e!=nil{t.Fatal(e)}
 }
 forbidden:=[]struct{grant,revoke string}{
  {"GRANT SELECT ON bg_account_social.reports TO "+role,"REVOKE SELECT ON bg_account_social.reports FROM "+role},
  {"GRANT UPDATE(hidden_at) ON bg_account_social.posts TO "+role,"REVOKE UPDATE(hidden_at) ON bg_account_social.posts FROM "+role},
  {"GRANT INSERT ON bg_account_social.moderation_events TO "+role,"REVOKE INSERT ON bg_account_social.moderation_events FROM "+role},
  {"GRANT UPDATE ON bg_account_social.comments TO "+role,"REVOKE UPDATE ON bg_account_social.comments FROM "+role},
  {"GRANT DELETE ON bg_account_social.posts TO "+role,"REVOKE DELETE ON bg_account_social.posts FROM "+role},
 }
 for _,v:=range forbidden{
  if _,e=store.DB.ExecContext(ctx,v.grant);e!=nil{t.Fatal(e)}
  if e=subject.ReadyRuntime(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("forbidden privilege accepted",v.grant,e)}
  if _,e=store.DB.ExecContext(ctx,v.revoke);e!=nil{t.Fatal(e)}
 }
 if e=subject.ReadyRuntime(ctx);e!=nil{t.Fatal("restored least-privilege grants rejected",e)}
}

func TestAUTH12SSOCallbackBruteForceBoundedBySocketIP(t *testing.T){
 _,_,_,h:=fixture(t)
 for i:=0;i<61;i++{
  req:=httptest.NewRequest("GET",
   "https://bonggoggles.420integrated.org/auth/callback?code=invalid&state=invalid",nil)
  req.RemoteAddr=fmt.Sprintf("198.51.100.84:%d",19000+i)
  req.Header.Set("X-Forwarded-Proto","https")
  w:=httptest.NewRecorder();h.ServeHTTP(w,req)
  expected:=http.StatusUnauthorized
  if i==60{expected=http.StatusTooManyRequests}
  if w.Code!=expected{t.Fatalf("callback attempt %d: %d, expected %d",i,w.Code,expected)}
 }
 req:=httptest.NewRequest("GET",
  "https://bonggoggles.420integrated.org/auth/callback?code=invalid&state=invalid",nil)
 req.RemoteAddr="spoofed-peer"
 req.Header.Set("X-Forwarded-Proto","https")
 w:=httptest.NewRecorder();h.ServeHTTP(w,req)
 if w.Code!=http.StatusTooManyRequests{t.Fatal("malformed network peer bypassed callback rate cap",w.Code)}
}
