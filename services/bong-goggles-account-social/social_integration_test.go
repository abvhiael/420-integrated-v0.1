//go:build account420_integration

package social

import (
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "net/http/httptest"
 "net/url"
 "os"
 "strings"
 "sync"
 "testing"
 "time"

 _ "github.com/lib/pq"
)
const memberA="10000000-1111-4111-8111-111111111111"
const memberB="20000000-2222-4222-8222-222222222222"

type fakeBroker struct{
 mu sync.Mutex
 codes map[string]string
 tokens map[string]string
 offline bool
}
func (b *fakeBroker) Authorize(state,challenge string)string{
 return "https://auth.420integrated.org/sso/authorize?state="+state+"&code_challenge="+challenge+"&code_challenge_method=S256"
}
func (b *fakeBroker) Exchange(_ context.Context,code,verifier string)(string,string,time.Time,error){
 if !tokenPattern.MatchString(code)||!tokenPattern.MatchString(verifier){return "","",time.Time{},ErrInvalid}
 b.mu.Lock();defer b.mu.Unlock()
 if b.offline||b.codes[code]==""{return "","",time.Time{},ErrUnavailable}
 data,e:=random32();if e!=nil{return "","",time.Time{},e}
 token:=encodeToken(data);b.tokens[token]=b.codes[code]
 return token,b.codes[code],time.Now().Add(time.Hour),nil
}
func (b *fakeBroker) Introspect(_ context.Context,token string)(string,bool,error){
 b.mu.Lock();defer b.mu.Unlock()
 if b.offline{return "",false,ErrUnavailable}
 user:=b.tokens[token]
 return user,user!="",nil
}
func (b *fakeBroker) Revoke(_ context.Context,token string)error{
 b.mu.Lock();defer b.mu.Unlock()
 if b.offline{return ErrUnavailable}
 delete(b.tokens,token);return nil
}
func fixture(t *testing.T)(*Store,*fakeBroker,*SignOn,*Handler){
 t.Helper()
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN");if dsn==""{t.Skip("requires PostgreSQL 16 test DSN")}
 db,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)}
 t.Cleanup(func(){db.Close()})
 if e=db.PingContext(context.Background());e!=nil{t.Fatal(e)}
 if e=Migrate(context.Background(),db);e!=nil{t.Fatal("migration",e)}
 store,e:=NewStore(db);if e!=nil{t.Fatal(e)}
 if e=store.Ready(context.Background());e!=nil{t.Fatal("missing grants",e)}
 broker:=&fakeBroker{codes:map[string]string{},tokens:map[string]string{}}
 key:=make([]byte,32);for i:=range key{key[i]=byte(i+1)}
 signOn,e:=NewSignOn(store,broker,key);if e!=nil{t.Fatal(e)}
 handler,e:=NewHandler(store,signOn,"https://bonggoggles.420integrated.org");if e!=nil{t.Fatal(e)}
 return store,broker,signOn,handler
}
func request(h *Handler,method,path,body string,cookies ...*http.Cookie)*httptest.ResponseRecorder{
 r:=httptest.NewRequest(method,"https://bonggoggles.420integrated.org"+path,strings.NewReader(body))
 r.Header.Set("X-Forwarded-Proto","https")
 if method!="GET"{r.Header.Set("Origin","https://bonggoggles.420integrated.org");r.Header.Set("Content-Type","application/json")}
 for _,cookie:=range cookies{r.AddCookie(cookie)}
 w:=httptest.NewRecorder();h.ServeHTTP(w,r);return w
}
func body(value any)string{data,_:=json.Marshal(value);return string(data)}
func login(t *testing.T,h *Handler,b *fakeBroker,subject string)*http.Cookie{
 t.Helper()
 data,e:=random32();if e!=nil{t.Fatal(e)}
 code:=encodeToken(data)
 b.mu.Lock();b.codes[code]=subject;b.mu.Unlock()
 start:=request(h,"GET","/auth/start","")
 if start.Code!=303{t.Fatal("start",start.Code,start.Body.String())}
 cookies:=start.Result().Cookies()
 if len(cookies)!=1||cookies[0].Name!=flowCookieName||!cookies[0].HttpOnly||!cookies[0].Secure||cookies[0].Domain!=""{t.Fatal("unsafe flow cookie")}
 target,e:=url.Parse(start.Header().Get("Location"));if e!=nil{t.Fatal(e)}
 if target.Host!="auth.420integrated.org"||target.Query().Get("code_challenge_method")!="S256"{t.Fatal("unsafe SSO redirect")}
 callback:=request(h,"GET","/auth/callback?state="+target.Query().Get("state")+"&code="+code,"",cookies[0])
 if callback.Code!=303||callback.Header().Get("Location")!="/social"{t.Fatal("callback",callback.Code,callback.Body.String())}
 for _,cookie:=range callback.Result().Cookies(){if cookie.Name==sessionCookieName{
  if !cookie.Secure||!cookie.HttpOnly||cookie.Domain!=""||cookie.Path!="/"{t.Fatal("unsafe app cookie")}
  return cookie
 }}
 t.Fatal("no session cookie");return nil
}
func decodePost(t *testing.T,r *httptest.ResponseRecorder)Post{
 t.Helper();var data struct{Post Post}
 if e:=json.Unmarshal(r.Body.Bytes(),&data);e!=nil{t.Fatal(e)}
 if !uuid.MatchString(data.Post.ID){t.Fatal("missing server ID")}
 return data.Post
}
func TestAccountSocialWalletIndependentLifecycle(t *testing.T){
 _,broker,_,h:=fixture(t)
 if w:=request(h,"GET","/v1/me","");w.Code!=401{t.Fatal("guest authenticated",w.Code)}
 cookie:=login(t,h,broker,memberA)
 me:=request(h,"GET","/v1/me","",cookie)
 if me.Code!=200||!strings.Contains(me.Body.String(),"\"walletRequired\":false")||strings.Contains(me.Body.String(),"walletAddress"){t.Fatal("wallet required",me.Body.String())}
 if w:=request(h,"PUT","/v1/me",body(map[string]string{"displayName":"Alex","bio":"Off-chain user"}),cookie);w.Code!=200{t.Fatal("profile",w.Code)}
 created:=request(h,"POST","/v1/posts",body(map[string]string{"body":"Hello from email login"}),cookie)
 if created.Code!=201{t.Fatal("create post",created.Code,created.Body.String())}
 post:=decodePost(t,created)
 if post.Author!=memberA{t.Fatal("client forged author")}
 if w:=request(h,"GET","/v1/feed","",cookie);w.Code!=200||!strings.Contains(w.Body.String(),post.ID){t.Fatal("feed missing",w.Code)}
 if w:=request(h,"POST","/v1/posts",body(map[string]string{"body":"test","author":memberB}),cookie);w.Code!=400{t.Fatal("author injection accepted",w.Code)}
 if w:=request(h,"POST","/v1/posts","{\"body\":\"first\",\"body\":\"second\"}",cookie);w.Code!=400{t.Fatal("duplicate JSON allowed",w.Code)}
 if w:=request(h,"POST","/v1/posts",body(map[string]string{"body":"\u202eInvisible"}),cookie);w.Code!=400{t.Fatal("bidi content accepted",w.Code)}
 if w:=request(h,"POST","/v1/posts/"+post.ID+"/comments",body(map[string]string{"body":"Nice post!"}),cookie);w.Code!=201{t.Fatal("comment",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/posts/"+post.ID+"/comments","",cookie);w.Code!=200||!strings.Contains(w.Body.String(),"Nice post!") {t.Fatal("comment read",w.Code)}
 if w:=request(h,"PUT","/v1/posts/"+post.ID+"/reaction","{}",cookie);w.Code!=200{t.Fatal("reaction",w.Code)}
 if w:=request(h,"DELETE","/v1/posts/"+post.ID+"/reaction","{}",cookie);w.Code!=200{t.Fatal("remove reaction",w.Code)}
 if w:=request(h,"POST","/v1/reports",body(map[string]string{"postId":post.ID,"reason":"spam"}),cookie);w.Code!=201{t.Fatal("report",w.Code)}
 if w:=request(h,"POST","/v1/reports",body(map[string]string{"postId":post.ID,"reason":"spam"}),cookie);w.Code!=409{t.Fatal("duplicate report",w.Code)}
 if w:=request(h,"DELETE","/v1/posts/"+post.ID,"",cookie);w.Code!=200{t.Fatal("own delete",w.Code)}
 if w:=request(h,"GET","/v1/feed","",cookie);w.Code!=200||strings.Contains(w.Body.String(),post.ID){t.Fatal("deleted post leaked")}
 broker.mu.Lock();broker.tokens=map[string]string{};broker.mu.Unlock()
 if w:=request(h,"GET","/v1/me","",cookie);w.Code!=401{t.Fatal("revoked AUTH-7 parent accepted",w.Code)}
}
func TestSocialBlockScopeAndBrowserCSRF(t *testing.T){
 store,broker,_,h:=fixture(t)
 one:=login(t,h,broker,memberA)
 two:=login(t,h,broker,memberB)
 post:=decodePost(t,request(h,"POST","/v1/posts",body(map[string]string{"body":"From A"}),one))
 if w:=request(h,"GET","/v1/feed","",two);w.Code!=200||!strings.Contains(w.Body.String(),post.ID){t.Fatal("missing community post")}
 if w:=request(h,"PUT","/v1/relationships/follow/"+memberA,"{}",two);w.Code!=200{t.Fatal("follow",w.Code)}
 if w:=request(h,"PUT","/v1/relationships/block/"+memberA,"{}",two);w.Code!=200{t.Fatal("block",w.Code)}
 var n int
 if e:=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.follows WHERE follower=$1 AND followed=$2",memberB,memberA).Scan(&n);e!=nil||n!=0{t.Fatal("block left follow",e)}
 if w:=request(h,"GET","/v1/feed","",two);w.Code!=200||strings.Contains(w.Body.String(),post.ID){t.Fatal("blocked post visible",w.Code)}
 if w:=request(h,"POST","/v1/posts/"+post.ID+"/comments",body(map[string]string{"body":"Blocked"}),two);w.Code!=404{t.Fatal("blocked comment",w.Code)}
 if w:=request(h,"PUT","/v1/relationships/follow/"+memberA,"{}",two);w.Code!=403{t.Fatal("block bypass follow",w.Code)}
 if w:=request(h,"DELETE","/v1/relationships/block/"+memberA,"{}",two);w.Code!=200{t.Fatal("unblock",w.Code)}
 if w:=request(h,"GET","/v1/feed","",two);w.Code!=200||!strings.Contains(w.Body.String(),post.ID){t.Fatal("unblock failed")}
 if w:=request(h,"DELETE","/v1/posts/"+post.ID,"",two);w.Code!=404{t.Fatal("foreign delete",w.Code)}
 req:=httptest.NewRequest("POST","https://bonggoggles.420integrated.org/v1/posts",strings.NewReader("{\"body\":\"CSRF\"}"))
 req.Header.Set("X-Forwarded-Proto","https");req.Header.Set("Origin","https://evil.invalid");req.Header.Set("Content-Type","application/json");req.AddCookie(one)
 w:=httptest.NewRecorder();h.ServeHTTP(w,req);if w.Code!=403{t.Fatal("cross-site write",w.Code)}
 req=httptest.NewRequest("GET","https://evil.invalid/v1/me",nil);req.Header.Set("X-Forwarded-Proto","https");req.AddCookie(one)
 w=httptest.NewRecorder();h.ServeHTTP(w,req);if w.Code!=403{t.Fatal("cross-host session leak",w.Code)}
 req=httptest.NewRequest("GET","https://bonggoggles.420integrated.org/v1/me",nil);req.TLS=nil;req.AddCookie(one)
 w=httptest.NewRecorder();h.ServeHTTP(w,req);if w.Code!=403{t.Fatal("insecure ingress",w.Code)}
}
func TestSSOCallbackOneUseAcrossWorkersAndFailureClosed(t *testing.T){
 _,broker,sso,h:=fixture(t)
 raw,_:=random32();code:=encodeToken(raw)
 broker.mu.Lock();broker.codes[code]=memberA;broker.mu.Unlock()
 dest,flow,e:=sso.Begin(context.Background());if e!=nil{t.Fatal(e)}
 u,_:=url.Parse(dest)
 state:=u.Query().Get("state")
 var wg sync.WaitGroup;responses:=make(chan error,2)
 for i:=0;i<2;i++{wg.Add(1);go func(){defer wg.Done();_,e:=sso.Finish(context.Background(),flow,state,code);responses<-e}()}
 wg.Wait();close(responses)
 passed,blocked:=0,0
 for e:=range responses{if e==nil{passed++}else if errors.Is(e,ErrForbidden){blocked++}else{t.Fatal(e)}}
 if passed!=1||blocked!=1{t.Fatal("SSO callback replay",passed,blocked)}
 _,flow2,e:=sso.Begin(context.Background());if e!=nil{t.Fatal(e)}
 if _,e=sso.Finish(context.Background(),flow2,state,code);!errors.Is(e,ErrForbidden){t.Fatal("unmatched state used")}
 user:=login(t,h,broker,memberB)
 broker.mu.Lock();broker.offline=true;broker.mu.Unlock()
 if w:=request(h,"GET","/v1/me","",user);w.Code!=503{t.Fatal("SSO outage did not fail closed",w.Code)}
}

func TestOffChainModerationAndDistributedRateLimits(t *testing.T){
 store,broker,_,handler:=fixture(t)
 cookie:=login(t,handler,broker,memberA)
 post:=decodePost(t,request(handler,"POST","/v1/posts",body(map[string]string{"body":"Reviewable post"}),cookie))
 if e:=store.Moderate(context.Background(),post.ID,"hide","community safety","reviewer-1");e!=nil{t.Fatal("moderation hide",e)}
 if w:=request(handler,"GET","/v1/feed","",cookie);w.Code!=200||strings.Contains(w.Body.String(),post.ID){t.Fatal("hidden post leaked",w.Code)}
 if w:=request(handler,"GET","/v1/posts/"+post.ID+"/comments","",cookie);w.Code!=404{t.Fatal("hidden comments readable",w.Code)}
 if w:=request(handler,"POST","/v1/posts/"+post.ID+"/comments",body(map[string]string{"body":"bypass"}),cookie);w.Code!=404{t.Fatal("commented on hidden post",w.Code)}
 if w:=request(handler,"PUT","/v1/posts/"+post.ID+"/reaction","{}",cookie);w.Code!=409{t.Fatal("reacted to hidden post",w.Code)}
 if e:=store.Moderate(context.Background(),post.ID,"restore","review complete","reviewer-2");e!=nil{t.Fatal("moderation restore",e)}
 if w:=request(handler,"GET","/v1/feed","",cookie);w.Code!=200||!strings.Contains(w.Body.String(),post.ID){t.Fatal("restored post not visible",w.Code)}
 var events int
 if e:=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.moderation_events WHERE post_id=$1",post.ID).Scan(&events);e!=nil||events!=2{t.Fatal("moderation history missing",events,e)}
 if e:=store.Moderate(context.Background(),post.ID,"promote","not allowed","reviewer");!errors.Is(e,ErrInvalid){t.Fatal("unapproved moderation operation")}
 principal:=make([]byte,32);principal[0]=0xaa
 for i:=0;i<3;i++{
  ok,e:=store.Allow(context.Background(),principal,"post",2)
  if e!=nil||ok!=(i<2){t.Fatal("distributed rate limit",i,ok,e)}
 }
}

func TestReportsRemainPrivateToSocialRuntimeRole(t *testing.T){
 store,_,_,_:=fixture(t)
 // Real PostgreSQL least-privilege exercise. Owner/migration access is not
 // transferred to the HTTP runtime role; public server cannot read reports
 // or change the moderation-hidden status of a post.
 db:=store.DB
 role:="bg_social_least_privilege_test"
 if _,e:=db.Exec("CREATE ROLE "+role+" NOLOGIN");e!=nil{t.Fatal("test role",e)}
 grants:=[]string{
  "GRANT USAGE ON SCHEMA bg_account_social TO "+role,
  "GRANT SELECT,INSERT ON bg_account_social.members,bg_account_social.posts,bg_account_social.comments TO "+role,
  "GRANT INSERT ON bg_account_social.reports TO "+role,
  "GRANT UPDATE(display_name,bio) ON bg_account_social.members TO "+role,
  "GRANT UPDATE(deleted_at) ON bg_account_social.posts TO "+role,
  "GRANT SELECT,INSERT,DELETE ON bg_account_social.reactions,bg_account_social.follows,bg_account_social.blocks,bg_account_social.sessions,bg_account_social.login_flows TO "+role,
  "GRANT SELECT,INSERT,UPDATE,DELETE ON bg_account_social.rate_buckets TO "+role,
 }
 for _,sqlStatement:=range grants{if _,e:=db.Exec(sqlStatement);e!=nil{t.Fatal("least privilege grant",e)}}
 var canReport,canReadReports,canDelete,canHide,canModerate bool
 e:=db.QueryRow("SELECT has_table_privilege($1,'bg_account_social.reports','INSERT'),"+
  "has_table_privilege($1,'bg_account_social.reports','SELECT'),"+
  "has_column_privilege($1,'bg_account_social.posts','deleted_at','UPDATE'),"+
  "has_column_privilege($1,'bg_account_social.posts','hidden_at','UPDATE'),"+
  "has_table_privilege($1,'bg_account_social.moderation_events','INSERT')",role).
  Scan(&canReport,&canReadReports,&canDelete,&canHide,&canModerate)
 if e!=nil{t.Fatal(e)}
 if !canReport||canReadReports||!canDelete||canHide||canModerate{
  t.Fatalf("runtime grants violate moderation isolation: report=%v read=%v delete=%v hide=%v audit=%v",
   canReport,canReadReports,canDelete,canHide,canModerate)
 }
}

func TestLoginRateLimiterIgnoresEphemeralSourcePort(t *testing.T){
 _,_,_,h:=fixture(t)
 for i:=0;i<31;i++{
  req:=httptest.NewRequest("GET","https://bonggoggles.420integrated.org/auth/start",nil)
  req.RemoteAddr=fmt.Sprintf("198.51.100.101:%d",20000+i)
  req.Header.Set("X-Forwarded-Proto","https")
  wr:=httptest.NewRecorder()
  h.ServeHTTP(wr,req)
  want:=http.StatusSeeOther
  if i==30{want=http.StatusTooManyRequests}
  if wr.Code!=want{t.Fatalf("login rate count %d returned %d (want %d)",i,wr.Code,want)}
 }
 // A missing or malformed socket identity cannot obtain another budget.
 req:=httptest.NewRequest("GET","https://bonggoggles.420integrated.org/auth/start",nil)
 req.RemoteAddr="untrusted"
 req.Header.Set("X-Forwarded-Proto","https")
 wr:=httptest.NewRecorder();h.ServeHTTP(wr,req)
 if wr.Code!=http.StatusTooManyRequests{t.Fatalf("invalid peer identity accepted: %d",wr.Code)}
}
