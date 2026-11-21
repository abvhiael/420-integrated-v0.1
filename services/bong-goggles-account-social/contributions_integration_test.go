//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "fmt"
 "net/http"
 "sync"
 "testing"
)
func xpSummary(t *testing.T,h *Handler,cookie *http.Cookie)XPSummary{
 t.Helper()
 r:=request(h,"GET","/v1/xp","",cookie)
 if r.Code!=200{t.Fatalf("XP endpoint failed %d: %s",r.Code,r.Body.String())}
 var xp XPSummary
 if e:=json.Unmarshal(r.Body.Bytes(),&xp);e!=nil{t.Fatal(e)}
 if xp.OnChain||xp.Redeemable||xp.PolicyVersion!=1||xp.Source!="bonggoggles-account-xp"{t.Fatal("XP claims wallet/redeemable authority",xp)}
 return xp
}
func xpPostBody(marker string)string{return fmt.Sprintf("A meaningful account-only community post %s",marker)}
func TestAUTH10AuthenticatedLedgerAndRevocation(t *testing.T){
 store,broker,_,h:=fixture(t)
 a:=login(t,h,broker,memberA)
 b:=login(t,h,broker,memberB)
 if w:=request(h,"GET","/v1/xp","",a);w.Code!=404{t.Fatal("disabled XP exposed",w.Code)}
 svc,e:=NewContributions(store);if e!=nil{t.Fatal(e)}
 if e=store.ReadyXP(context.Background());e!=nil{t.Fatal("migration/grant",e)}
 if e=h.EnableXP(svc);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/xp","");w.Code!=401{t.Fatal("anonymous XP disclosed",w.Code)}
 if w:=request(h,"POST","/v1/xp","{}",a);w.Code!=404{t.Fatal("user-injected XP accepted",w.Code)}
 marker,_:=newID()
 short:=request(h,"POST","/v1/posts",body(map[string]string{"body":"Tiny"}),a)
 if short.Code!=201{t.Fatal("valid short post rejected",short.Code)}
 post:=decodePost(t,request(h,"POST","/v1/posts",body(map[string]string{"body":xpPostBody(marker)}),a))
 first:=xpSummary(t,h,a)
 if first.Total!=5||first.TodayPosts!=1||first.Level!=1||first.ToNextLevel!=95{t.Fatal("initial XP",first)}
 if other:=xpSummary(t,h,b);other.Total!=0||other.Subject!=memberB{t.Fatal("cross-member balance disclosure",other)}
 // Identical payload is allowed as a post but earns no repeated XP.
 twice:=request(h,"POST","/v1/posts",body(map[string]string{"body":xpPostBody(marker)}),a)
 if twice.Code!=201{t.Fatal("duplicate post rejected",twice.Code)}
 if got:=xpSummary(t,h,a);got.Total!=5||got.TodayPosts!=1{t.Fatal("duplicate farming",got)}
 self:=request(h,"POST","/v1/posts/"+post.ID+"/comments",body(map[string]string{"body":"This is my own self-reply"}),a)
 if self.Code!=201{t.Fatal("self-reply should be allowed but unrewarded",self.Code)}
 if got:=xpSummary(t,h,a);got.Total!=5{t.Fatal("self-reply XP",got.Total)}
 reply:=request(h,"POST","/v1/posts/"+post.ID+"/comments",body(map[string]string{"body":"A thoughtful peer contribution"}),b)
 if reply.Code!=201{t.Fatal("valid peer comment",reply.Code,reply.Body.String())}
 if got:=xpSummary(t,h,b);got.Total!=2||got.TodayComments!=1{t.Fatal("peer comment XP",got)}
 if w:=request(h,"POST","/v1/posts",body(map[string]any{"body":xpPostBody("forged"),"xp":100000}),a);w.Code!=400{t.Fatal("client points accepted",w.Code)}
 if w:=request(h,"DELETE","/v1/posts/"+post.ID,"",a);w.Code!=200{t.Fatal("delete post",w.Code)}
 if got:=xpSummary(t,h,a);got.Total!=0||len(got.Events)<2{t.Fatal("post deletion not reversed",got)}
 if got:=xpSummary(t,h,b);got.Total!=0||len(got.Events)<2{t.Fatal("comment under deleted post not reversed",got)}
 if w:=request(h,"DELETE","/v1/posts/"+post.ID,"",a);w.Code!=404{t.Fatal("double deletion accepted",w.Code)}
 if got:=xpSummary(t,h,a);got.Total!=0{t.Fatal("double XP reversal",got.Total)}
 broker.mu.Lock();broker.tokens=map[string]string{};broker.mu.Unlock()
 if w:=request(h,"GET","/v1/xp","",a);w.Code!=401{t.Fatal("expired 420ID still read private XP",w.Code)}
}
func TestAUTH10ModerationReversalAndNoRestoreFarming(t *testing.T){
 store,broker,_,h:=fixture(t)
 svc,e:=NewContributions(store);if e!=nil{t.Fatal(e)}
 if e=h.EnableXP(svc);e!=nil{t.Fatal(e)}
 a:=login(t,h,broker,memberA);b:=login(t,h,broker,memberB)
 marker,_:=newID()
 post:=decodePost(t,request(h,"POST","/v1/posts",body(map[string]string{"body":xpPostBody(marker)}),a))
 comment:=request(h,"POST","/v1/posts/"+post.ID+"/comments",body(map[string]string{"body":"Useful peer review "+marker}),b)
 if comment.Code!=201{t.Fatal("peer comment",comment.Code)}
 beforeA,beforeB:=xpSummary(t,h,a),xpSummary(t,h,b)
 if beforeA.Total<5||beforeB.Total<2{t.Fatal("eligible content missing XP",beforeA,beforeB)}
 if e=store.Moderate(context.Background(),post.ID,"hide","legacy bypass","moderator");e!=ErrForbidden{
  t.Fatal("legacy moderation bypassed XP compensation",e)
 }
 if e=svc.Moderate(context.Background(),post.ID,"hide","spam review","moderator");e!=nil{t.Fatal(e)}
 afterA,afterB:=xpSummary(t,h,a),xpSummary(t,h,b)
 if afterA.Total!=beforeA.Total-5||afterB.Total!=beforeB.Total-2{t.Fatal("moderation failed to reverse both authors",afterA,afterB)}
 if e=svc.Moderate(context.Background(),post.ID,"hide","repeat review","moderator");e!=nil{t.Fatal(e)}
 if again:=xpSummary(t,h,b);again.Total!=afterB.Total{t.Fatal("repeated hide double-debited")}
 if e=svc.Moderate(context.Background(),post.ID,"restore","appeal upheld","moderator");e!=nil{t.Fatal(e)}
 if got:=xpSummary(t,h,a);got.Total!=afterA.Total{t.Fatal("restoration reissued previously revoked XP")}
 var entries int
 if e=store.DB.QueryRow(`SELECT count(*) FROM bg_account_social.contribution_xp_events WHERE source_kind='post' AND source_id=$1`,post.ID).Scan(&entries);e!=nil||entries!=2{t.Fatal("non-append-only reversal evidence",entries,e)}
}
func TestAUTH10ConcurrentDailyCapsAndUniqueSource(t *testing.T){
 store,_,_,_:=fixture(t)
 svc,e:=NewContributions(store);if e!=nil{t.Fatal(e)}
 subject,_:=newID()
 if e=store.EnsureMember(context.Background(),subject);e!=nil{t.Fatal(e)}
 const attempts=12
 var wg sync.WaitGroup
 results:=make(chan error,attempts)
 for i:=0;i<attempts;i++{
  wg.Add(1)
  go func(n int){defer wg.Done()
   _,e:=svc.PublishPost(context.Background(),subject,xpPostBody(fmt.Sprintf("unique-concurrent-%d",n)))
   results<-e
  }(i)
 }
 wg.Wait();close(results)
 for e:=range results{if e!=nil{t.Fatal("concurrent eligible post failed",e)}}
 summary,e:=svc.Summary(context.Background(),subject)
 if e!=nil{t.Fatal(e)}
 if summary.Total!=15||summary.TodayPosts!=3||summary.Level!=1{t.Fatal("daily XP cap bypassed",summary)}
 // A new member can create many identical posts but can receive only one
 // grant for that content, even if requests overlap on separate workers.
 second,_:=newID();if e=store.EnsureMember(context.Background(),second);e!=nil{t.Fatal(e)}
 same:="An entirely identical contribution that is not uniquely rewarded"
 duplicateErr:=make(chan error,8)
 for i:=0;i<8;i++{wg.Add(1);go func(){defer wg.Done();_,e:=svc.PublishPost(context.Background(),second,same);duplicateErr<-e}()}
 // verify after all concurrent transactions are finished
 wg.Wait();close(duplicateErr)
 for e:=range duplicateErr{if e!=nil{t.Fatal("duplicate post transaction failed",e)}}
 got,e:=svc.Summary(context.Background(),second)
 if e!=nil||got.Total!=5||got.TodayPosts!=1{t.Fatal("same-body duplicate farming",got,e)}
}
func TestAUTH10XPJournalRuntimeOnlySelectInsert(t *testing.T){
 store,_,_,_:=fixture(t)
 role:="bg_social_xp_least_privilege_test"
 if _,e:=store.DB.Exec("CREATE ROLE "+role+" NOLOGIN");e!=nil{t.Fatal(e)}
 if _,e:=store.DB.Exec("GRANT USAGE ON SCHEMA bg_account_social TO "+role);e!=nil{t.Fatal(e)}
 if _,e:=store.DB.Exec("GRANT SELECT,INSERT ON bg_account_social.contribution_xp_events TO "+role);e!=nil{t.Fatal(e)}
 var canRead,canAppend,canEdit,canErase bool
 e:=store.DB.QueryRow(`SELECT
 has_table_privilege($1,'bg_account_social.contribution_xp_events','SELECT'),
 has_table_privilege($1,'bg_account_social.contribution_xp_events','INSERT'),
 has_table_privilege($1,'bg_account_social.contribution_xp_events','UPDATE'),
 has_table_privilege($1,'bg_account_social.contribution_xp_events','DELETE')`,role).
 Scan(&canRead,&canAppend,&canEdit,&canErase)
 if e!=nil||!canRead||!canAppend||canEdit||canErase{t.Fatal("XP journal runtime privileges unsafe",canRead,canAppend,canEdit,canErase,e)}
}
