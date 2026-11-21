//go:build account420_integration

package appgateway

import (
 "bytes"
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "net/http/httptest"
 "os"
 "net/url"
 "strings"
 "sync"
 "testing"
 "time"

 _ "github.com/lib/pq"
)

func integrationDB(t *testing.T)*sql.DB{
 t.Helper()
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN")
 if !strings.Contains(dsn,"account420_test"){t.Skip("disposable PostgreSQL account420_test required")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)}
 t.Cleanup(func(){_ =db.Close()})
 if e=db.Ping();e!=nil{t.Fatal(e)}
 if e=Migrate(context.Background(),db);e!=nil{t.Fatal(e)}
 return db
}
type upstreamState struct{
 mu sync.Mutex
 active bool
 requests map[string]int
}
func (s *upstreamState) reply(t *testing.T,app string)transport{
 t.Helper()
 return transport(func(r *http.Request)(*http.Response,error){
  s.mu.Lock();defer s.mu.Unlock()
  if r.URL.Host!="auth.420integrated.org"||r.Method!="POST"{t.Error("unsafe SSO authority")}
  name,_,ok:=r.BasicAuth()
  if !ok||name!=app{t.Error("app credentials mismatch")}
  s.requests[r.URL.Path]++
  var body map[string]string
  if e:=json.NewDecoder(r.Body).Decode(&body);e!=nil{t.Error(e)}
  result:=map[string]any{}
  switch r.URL.Path{
  case "/v1/sso/token":
   if body["code"]!=strings.Repeat("C",43)||len(body["codeVerifier"])!=43||
    body["redirectUri"]!="https://town.420integrated.org/420id-api/auth/callback"{
    t.Error("invalid exchange binding")
   }
   result=map[string]any{"accessToken":strings.Repeat("T",43),"tokenType":"Bearer",
    "session":map[string]any{
     "id":"12345678-1234-4123-8123-123456789abc",
     "subject":map[string]string{"app":app,"sub":"23456789-1234-4234-8234-123456789abc"},
     "method":"sso","issuedAt":time.Now().UTC(),"expiresAt":time.Now().Add(time.Hour).UTC(),
     "idleUntil":time.Now().Add(30*time.Minute).UTC(),
    }}
  case "/v1/sso/introspect":
   if body["token"]!=strings.Repeat("T",43){t.Error("unknown token introspected")}
   if s.active{result=map[string]any{"active":true,
    "subject":map[string]string{"app":app,"sub":"23456789-1234-4234-8234-123456789abc"},
    "method":"sso","expiresAt":time.Now().Add(time.Hour).UTC(),
    "idleUntil":time.Now().Add(30*time.Minute).UTC(),
   }}else{result=map[string]any{"active":false}}
  case "/v1/sso/revoke":
   if body["token"]!=strings.Repeat("T",43){t.Error("wrong token revoked")}
   s.active=false;result=map[string]bool{"revoked":true}
  default:t.Errorf("unknown SSO confidential operation: %s",r.URL.Path)
  }
  raw,_:=json.Marshal(result)
  return &http.Response{StatusCode:200,Header:http.Header{"Content-Type":[]string{"application/json"}},Body:io.NopCloser(bytes.NewReader(raw))},nil
 })
}
func browserRequest(method,path,remote string)*http.Request{
 req:=httptest.NewRequest(method,"https://town.420integrated.org"+path,nil)
 req.TLS=nil;req.RemoteAddr=remote;req.Header.Set("X-Forwarded-Proto","https")
 return req
}
func TestAUTH13IsolatedDurableCrossInstanceSSOAndRevocation(t *testing.T){
 db:=integrationDB(t)
 state:=&upstreamState{active:true,requests:map[string]int{}}
 cfg:=sampleConfig("420town");cfg.DB=db
 cfg.Client=&http.Client{Transport:state.reply(t,"420town")}
 first,e:=New(cfg);if e!=nil{t.Fatal(e)}
 second,e:=New(cfg);if e!=nil{t.Fatal(e)}
 begin:=httptest.NewRecorder()
 first.ServeHTTP(begin,browserRequest("GET",APIPath+"auth/start","198.51.100.221:15001"))
 if begin.Code!=http.StatusSeeOther{t.Fatal("SSO initiation denied",begin.Code,begin.Body.String())}
 location,e:=url.Parse(begin.Header().Get("Location"));if e!=nil{t.Fatal(e)}
 if location.Host!="auth.420integrated.org"||location.Query().Get("app")!="420town"||
  location.Query().Get("code_challenge_method")!="S256"||location.Query().Get("code_challenge")==""{t.Fatal("invalid consent destination",location)}
 flowCookies:=begin.Result().Cookies()
 if len(flowCookies)!=1||flowCookies[0].Name!=CookieFlow||!flowCookies[0].Secure||!flowCookies[0].HttpOnly{
  t.Fatal("unsafe flow cookie",flowCookies)
 }
 callback:=APIPath+"auth/callback?code="+strings.Repeat("C",43)+"&state="+location.Query().Get("state")
 attempt:=browserRequest("GET",APIPath+"auth/callback?code="+strings.Repeat("C",43)+"&state="+strings.Repeat("E",43),"198.51.100.222:15001")
 attempt.AddCookie(flowCookies[0])
 refused:=httptest.NewRecorder()
 second.ServeHTTP(refused,attempt)
 if refused.Code!=401{t.Fatal("wrong browser state redeemed",refused.Code)}
 finish:=browserRequest("GET",callback,"198.51.100.222:15002")
 finish.AddCookie(flowCookies[0])
 accepted:=httptest.NewRecorder()
 second.ServeHTTP(accepted,finish)
 if accepted.Code!=303||accepted.Header().Get("Location")!="https://town.420integrated.org/"{t.Fatal("callback failed",accepted.Code,accepted.Body.String())}
 cookies:=accepted.Result().Cookies()
 if len(cookies)<2{t.Fatal("no independent session cookie",cookies)}
 var sessionCookie *http.Cookie
 for _,v:=range cookies{if v.Name==CookieSession{sessionCookie=v}}
 if sessionCookie==nil||!sessionCookie.HttpOnly||!sessionCookie.Secure||sessionCookie.SameSite!=http.SameSiteLaxMode{
  t.Fatal("app-only SSO cookie invalid")
 }
 // Neither the app-opaque bearer nor the central account ID crosses the
 // browser boundary: the only public identifier is the app-scoped subject.
 req:=browserRequest("GET",APIPath+"auth/session","198.51.100.223:15001");req.AddCookie(sessionCookie)
 verified:=httptest.NewRecorder()
 first.ServeHTTP(verified,req)
 if verified.Code!=200||!strings.Contains(verified.Body.String(),`"subject":"23456789-1234-4234-8234-123456789abc"`)||
  strings.Contains(verified.Body.String(),strings.Repeat("T",43))||
  strings.Contains(verified.Body.String(),`walletLinked`)||
  strings.Contains(verified.Body.String(),`"financialAuthority":true`){
  t.Fatal("unsafe public app session",verified.Code,verified.Body.String())
 }
 repeat:=browserRequest("GET",callback,"198.51.100.222:15003");repeat.AddCookie(flowCookies[0])
 replay:=httptest.NewRecorder();first.ServeHTTP(replay,repeat)
 if replay.Code!=401{t.Fatal("callback code/state replay accepted",replay.Code)}
 logout:=browserRequest("POST",APIPath+"auth/logout","198.51.100.224:15002")
 logout.AddCookie(sessionCookie);logout.Header.Set("Origin","https://town.420integrated.org")
 signedOut:=httptest.NewRecorder();first.ServeHTTP(signedOut,logout)
 if signedOut.Code!=200||!strings.Contains(signedOut.Body.String(),`"signedOut":true`){t.Fatal("logout denied",signedOut.Code,signedOut.Body.String())}
 again:=httptest.NewRecorder();second.ServeHTTP(again,req)
 if again.Code!=200||!strings.Contains(again.Body.String(),`"authenticated":false`){t.Fatal("revoked session still active",again.Body.String())}
 state.mu.Lock()
 defer state.mu.Unlock()
 if state.requests["/v1/sso/token"]!=1||state.requests["/v1/sso/revoke"]!=1||state.requests["/v1/sso/introspect"]<1{
  t.Fatal("missing confidential integration",state.requests)
 }
}
func TestAUTH13RealDatabaseGrantsAndMisconfiguration(t *testing.T){
 db:=integrationDB(t)
 ctx:=context.Background()
 role:="app420_auth13_temp"
 if _,e:=db.Exec("CREATE ROLE "+role+" NOLOGIN");e!=nil{t.Fatal(e)}
 t.Cleanup(func(){
  _,_=db.Exec("DROP OWNED BY "+role)
  if _,e:=db.Exec("DROP ROLE "+role);e!=nil{t.Error("drop fixture role",e)}
 })
 if _,e:=db.Exec("GRANT USAGE ON SCHEMA app420_sso TO "+role);e!=nil{t.Fatal(e)}
 other,e:=sql.Open("postgres",os.Getenv("ACCOUNT420_TEST_DSN"));if e!=nil{t.Fatal(e)}
 other.SetMaxOpenConns(1)
 t.Cleanup(func(){_ =other.Close()})
 if _,e=other.Exec("SET ROLE "+role);e!=nil{t.Fatal(e)}
 cfg:=sampleConfig("doobtube");cfg.DB=other
 g,e:=New(cfg);if e!=nil{t.Fatal(e)}
 if e=g.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("unauthorized app runtime accepted",e)}
 for _,s:=range []string{
  "GRANT SELECT,INSERT,DELETE ON app420_sso.login_flows,app420_sso.sessions TO "+role,
  "GRANT SELECT,INSERT,UPDATE,DELETE ON app420_sso.rate_buckets TO "+role,
 }{if _,e=db.Exec(s);e!=nil{t.Fatal(e)}}
 if e=g.Ready(ctx);e!=nil{t.Fatal("least privilege startup denied",e)}
 for _,change:=range []struct{stmt,undo string}{
  {"GRANT UPDATE ON app420_sso.sessions TO "+role,"REVOKE UPDATE ON app420_sso.sessions FROM "+role},
  {"GRANT TRUNCATE ON app420_sso.login_flows TO "+role,"REVOKE TRUNCATE ON app420_sso.login_flows FROM "+role},
 }{
  if _,e=db.Exec(change.stmt);e!=nil{t.Fatal(e)}
  if e=g.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("unsafe extra privilege accepted",change.stmt,e)}
  if _,e=db.Exec(change.undo);e!=nil{t.Fatal(e)}
 }
 if _,e=db.Exec("REVOKE INSERT ON app420_sso.sessions FROM "+role);e!=nil{t.Fatal(e)}
 if e=g.Ready(ctx);!errors.Is(e,ErrUnavailable){t.Fatal("missing session INSERT accepted",e)}
}
func TestAUTH13InvalidPeerAndOriginFailBeforeProvider(t *testing.T){
 db:=integrationDB(t)
 cfg:=sampleConfig("420town");cfg.DB=db
 g,e:=New(cfg);if e!=nil{t.Fatal(e)}
 tests:=[]struct{method,path,origin,remote string;want int}{
  {"GET",APIPath+"auth/start","","invalid peer",429},
  {"GET",APIPath+"auth/callback?state=bad&code=bad","","invalid peer",429},
  {"POST",APIPath+"auth/logout","https://evil.org","198.51.100.240:1512",403},
  {"GET",APIPath+"auth/session?url=https://evil.org","","198.51.100.240:1512",400},
 }
 for _,tc:=range tests{
  req:=browserRequest(tc.method,tc.path,tc.remote)
  if tc.origin!=""{req.Header.Set("Origin",tc.origin)}
  w:=httptest.NewRecorder();g.ServeHTTP(w,req)
  if w.Code!=tc.want{t.Fatal(tc.path,w.Code,tc.want)}
 }
}
