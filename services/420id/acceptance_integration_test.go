//go:build account420_integration

package account

import (
 "bytes"
 "context"
 "database/sql"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "testing"
)

func acceptRequest(h http.Handler,method,path,body,origin string,cookie *http.Cookie)*httptest.ResponseRecorder{
 r:=httptest.NewRequest(method,testOrigin+path,strings.NewReader(body))
 r.RemoteAddr="127.0.0.1:12345"
 if origin!=""{r.Header.Set("Origin",origin)}
 if method=="POST"{r.Header.Set("Content-Type","application/json")}
 if cookie!=nil{r.AddCookie(cookie)}
 w:=httptest.NewRecorder();h.ServeHTTP(w,r);return w
}
func jsonBody(t *testing.T,v any)string{t.Helper();b,e:=json.Marshal(v);if e!=nil{t.Fatal(e)};return string(b)}
func readResult(t *testing.T,w *httptest.ResponseRecorder,target any){t.Helper();if w.Code!=200{t.Fatalf("response %d: %s",w.Code,w.Body.String())};if e:=json.Unmarshal(w.Body.Bytes(),target);e!=nil{t.Fatal(e)}}
func TestAcceptanceHTTPAndBrowserIsolation(t *testing.T){
 ctx:=context.Background()
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN");if dsn==""{t.Fatal("disposable PostgreSQL required")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db.Close()
 var name string;if e=db.QueryRowContext(ctx,"SELECT current_database()").Scan(&name);e!=nil||name!="account420_test"{t.Fatal("unsafe test database",e)}
 if e=Migrate(ctx,db);e!=nil{t.Fatal(e)}
 store,e:=NewStore(db,[]string{"bong-goggles"});if e!=nil{t.Fatal(e)}
 mail:=&testMailer{};auth,e:=NewAuth(store,mail,testOrigin,testRP);if e!=nil{t.Fatal(e)}
 id,e:=newID();if e!=nil{t.Fatal(e)};email:=id+"@example.org"
 cfg:=AcceptanceConfig{Emails:[]string{email},RateKey:mustRandom(t)}
 h,e:=NewAcceptanceHandler(auth,cfg);if e!=nil{t.Fatal(e)}
 if _,e=NewAcceptanceHandler(auth,AcceptanceConfig{RateKey:cfg.RateKey});e==nil{t.Fatal("missing acceptance allowlist")}
 db2,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer db2.Close()
 store2,e:=NewStore(db2,[]string{"bong-goggles"});if e!=nil{t.Fatal(e)}
 auth2,e:=NewAuth(store2,&testMailer{},testOrigin,testRP);if e!=nil{t.Fatal(e)}
 h2,e:=NewAcceptanceHandler(auth2,cfg);if e!=nil{t.Fatal(e)}
 page:=acceptRequest(h,"GET","/","","",nil)
 if page.Code!=200||!strings.Contains(page.Body.String(),"does not start a BongGoggles")||page.Header().Get("Cache-Control")!="no-store"||!strings.Contains(page.Header().Get("Content-Security-Policy"),"frame-ancestors 'none'"){t.Fatal("unsafe acceptance page")}
 cookies:=page.Result().Cookies();if len(cookies)!=1||cookies[0].Name!=flowCookie||!cookies[0].Secure||!cookies[0].HttpOnly||cookies[0].SameSite!=http.SameSiteStrictMode||cookies[0].Domain!=""||cookies[0].Path!="/"{t.Fatal("unsafe flow cookie")}
 cookie:=cookies[0];other:=acceptRequest(h,"GET","/","","",nil).Result().Cookies()[0]
 post:=func(s http.Handler,path string,v any,c *http.Cookie)*httptest.ResponseRecorder{return acceptRequest(s,"POST",path,jsonBody(t,v),testOrigin,c)}
 for _,p:=range []string{"/acceptance.mjs","/browser.mjs","/acceptance.css"}{if got:=acceptRequest(h,"GET",p,"","",nil);got.Code!=200||got.Body.Len()==0{t.Fatal("asset unavailable",p)}}
 if got:=acceptRequest(h,"POST","/v1/email/start",jsonBody(t,map[string]string{"email":email}),"https://evil.example.org",cookie);got.Code!=403||got.Header().Get("Access-Control-Allow-Origin")!=""{t.Fatal("cross-origin accepted")}
 if got:=post(h,"/v1/email/start",map[string]string{"email":email},nil);got.Code!=403{t.Fatal("missing browser binding")}
 r:=httptest.NewRequest("POST","http://"+testRP+"/v1/email/start",strings.NewReader("{}"));r.Header.Set("X-Forwarded-Proto","https");w:=httptest.NewRecorder();h.ServeHTTP(w,r);if w.Code!=403{t.Fatal("untrusted proxy header")}
 r=httptest.NewRequest("GET","https://evil.example.org/",nil);w=httptest.NewRecorder();h.ServeHTTP(w,r);if w.Code!=403{t.Fatal("alternate host allowed")}
 if got:=acceptRequest(h,"POST","/v1/email/start?secret=unsafe","{}",testOrigin,cookie);got.Code!=400{t.Fatal("query allowed")}
 if got:=acceptRequest(h,"POST","/v1/email/start",`{"email":"one","Email":"two"}`,testOrigin,cookie);got.Code!=400{t.Fatal("duplicate body fields allowed")}
 if got:=acceptRequest(h,"POST","/v1/email/start",strings.Repeat("x",maxRequest+1),testOrigin,cookie);got.Code!=413{t.Fatal("oversize body allowed")}
 var start EmailStart
 readResult(t,post(h,"/v1/email/start",map[string]string{"email":"unapproved@example.org"},cookie),&start);if mail.secret!=""{t.Fatal("mail sent to unapproved recipient")}
 readResult(t,post(h,"/v1/email/start",map[string]string{"email":email},cookie),&start)
 if mail.email!=email||mail.secret==""{t.Fatal("approved mail not sent")}
 finish:=map[string]string{"challengeId":start.ChallengeID,"secret":mail.secret}
 if got:=post(h2,"/v1/email/finish",finish,other);got.Code!=401{t.Fatal("cross-browser challenge use")}
 // Valid proof crosses a process boundary, not a browser boundary.
 var verified struct{Verified bool;Registration *RegistrationOptions;Receipt string}
 readResult(t,post(h2,"/v1/email/finish",finish,cookie),&verified)
 if !verified.Verified||verified.Registration==nil||!validID(verified.Receipt){t.Fatal("email result incomplete")}
 if got:=post(h,"/v1/email/finish",finish,cookie);got.Code!=401{t.Fatal("email replay")}
 reg:=verified.Registration;challenge,e:=decodeToken(reg.Challenge);if e!=nil{t.Fatal(e)};handle,e:=decodeToken(reg.UserHandle);if e!=nil{t.Fatal(e)}
 key,cred:=testKey(t),mustRandom(t);regBody:=struct{ChallengeID string;RegistrationResponse}{reg.ChallengeID,registration(t,key,challenge,cred,0x4d)}
 if got:=post(h,"/v1/passkey/register",regBody,other);got.Code!=401{t.Fatal("cross-browser registration")}
 var registered struct{Registered bool;Receipt string}
 readResult(t,post(h,"/v1/passkey/register",regBody,cookie),&registered);if !registered.Registered||!validID(registered.Receipt){t.Fatal("missing registration receipt")}
 var options LoginOptions
 readResult(t,post(h2,"/v1/passkey/start",struct{}{},cookie),&options)
 ch,e:=decodeToken(options.Challenge);if e!=nil{t.Fatal(e)}
 loginBody:=struct{ChallengeID string;AssertionResponse}{options.ChallengeID,assertion(t,key,ch,cred,handle,0x0d,1,testOrigin,testRP)}
 if got:=post(h,"/v1/passkey/finish",loginBody,other);got.Code!=401{t.Fatal("cross-browser assertion")}
 var login struct{Verified bool;Receipt string}
 loginResponse:=post(h,"/v1/passkey/finish",loginBody,cookie);readResult(t,loginResponse,&login)
 if !login.Verified||!validID(login.Receipt)||len(loginResponse.Result().Cookies())!=0||bytes.Contains(loginResponse.Body.Bytes(),handle)||strings.Contains(loginResponse.Body.String(),"accountId"){t.Fatal("unauthorized session or missing receipt")}
 if got:=post(h2,"/v1/passkey/finish",loginBody,cookie);got.Code!=401{t.Fatal("assertion replay")}
 var count int;if e=db.QueryRowContext(ctx,"SELECT count(*) FROM account420.acceptance_receipts WHERE id IN ($1,$2,$3)",verified.Receipt,registered.Receipt,login.Receipt).Scan(&count);e!=nil||count!=3{t.Fatal("missing durable receipt evidence",e,count)}
 // Fill the same browser bucket through both process instances.
 // Other test operations consumed fewer than 30 requests.
 limited:=false
 for i:=0;i<31;i++{svc:=h;if i%2==0{svc=h2};got:=post(svc,"/v1/passkey/start",struct{}{},cookie);if got.Code==429{limited=true;break};if got.Code!=200{t.Fatal("unexpected rate-limit response",got.Code)}}
 if !limited{t.Fatal("multi-instance rate cap bypass")}
 if e=h.Purge(ctx);e!=nil{t.Fatal(e)}
 // The daily cap must survive cleanup and process changes. Use a fresh browser digest.
 if _,e=db.ExecContext(ctx,"INSERT INTO account420.acceptance_rate(scope,bucket,count) VALUES(\'mail-global-day\',floor(extract(epoch from clock_timestamp())/86400)::bigint,90) ON CONFLICT(scope,bucket) DO UPDATE SET count=90");e!=nil{t.Fatal(e)}
 if e=h.Purge(ctx);e!=nil{t.Fatal(e)}
 if e=h2.limit(ctx,mustRandom(t),"127.0.0.2:12345",true);e!=errLimited{t.Fatal("daily email cap not enforced after cleanup",e)}
}
