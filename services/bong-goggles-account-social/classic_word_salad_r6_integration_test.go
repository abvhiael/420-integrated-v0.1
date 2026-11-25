//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "reflect"
 "strings"
 "sync"
 "testing"
 "time"
)

func r6Start(t *testing.T,h *Handler,mode string)ClassicSessionView{
 t.Helper();ctx:=context.Background()
 room,e:=h.Rooms.CreateWithFormat(ctx,memberA,"scrabble","public",2,"17:classic-salad:"+mode);if e!=nil{t.Fatal(e)}
 room,e=h.Rooms.Change(ctx,memberB,room.ID,RoomChange{Action:"join",Seat:1,ExpectedRevision:room.Revision});if e!=nil{t.Fatal(e)}
 match,e:=h.Sessions.Start(ctx,memberA,room.ID);if e!=nil{t.Fatal(e)};return match
}
func r6Record(t *testing.T,s *Store,id string)classicSessionRecord{
 t.Helper();r,e:=scanClassicSession(s.DB.QueryRow("SELECT "+classicSessionFields+" FROM bg_account_social.classic_sessions WHERE id=$1",id));if e!=nil{t.Fatal(e)};return r
}
func r6Counts(t *testing.T,s *Store,id string,want [3]int){
 t.Helper();var got [3]int
 e:=s.DB.QueryRow("SELECT (SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1),(SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1),(SELECT count(*) FROM bg_account_social.classic_session_commands WHERE session_id=$1)",id).Scan(&got[0],&got[1],&got[2]);if e!=nil||got!=want{t.Fatal("journal counts",got,want,e)}
}
func r6Opening(t *testing.T,a *RulesAdapter,r classicSessionRecord)json.RawMessage{
 t.Helper();f,e:=a.decode(r.State);if e!=nil{t.Fatal(e)};d,e:=saladDecode(f);if e!=nil{t.Fatal(e)}
 p,_,_:=saladVariant(f.Variant,f.SeatCount);pack:=saladPack(p)
 for _,i:=range d.Racks[f.Turn]{for _,j:=range d.Racks[f.Turn]{if i==j{continue}
  for _,vertical:=range []bool{false,true}{
   for _,b1:=range r6BlankOptions(pack[i]){for _,b2:=range r6BlankOptions(pack[j]){
    mid:=p.size/2;y,x:=mid,mid+1;if vertical{y,x=mid+1,mid}
    raw,_:=json.Marshal(saladMove{Type:"place",Tiles:[]saladPlacement{{Row:&mid,Col:&mid,ID:&i,Blank:b1},{Row:&y,Col:&x,ID:&j,Blank:b2}}})
    if _,_,_,_,e=a.Apply(r.State,f.Turn,raw);e==nil{return raw}
   }}
  }
 }}
 t.Fatal("no legal opening");return nil
}
func r6BlankOptions(symbol int)[]string{if symbol!=41{return []string{""}};out:=[]string{};for c:='A';c<='Z';c++{out=append(out,string(c))};return out}
func r6Resolver(t *testing.T,h *Handler)*RulesAdapter{
 t.Helper()
 // Exhaustive two-tile fixture makes every dealt rack usable; the actual
 // service, adapter, transactions and journal remain production code.
 set:=map[string]bool{};for _,x:=range saladSymbols[:41]{for _,y:=range saladSymbols[:41]{set[x+y]=true}}
 words:=[]string{};for w:=range set{words=append(words,w)}
 a,e:=NewWordSaladRulesAdapter(words,[]string{"BONG"});if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="scrabble"{return a};return nil};return a
}
func TestBC42WordSaladConcurrentIntegrity(t *testing.T){
 store,h,_,_:=bc06Fixture(t,"198.51.100.219");a:=r6Resolver(t,h);ctx:=context.Background();match:=r6Start(t,h,"live")
 before:=r6Record(t,store,match.ID);subjects:=[]string{memberA,memberB};actor:=*before.TurnSeat
 move:=r6Opening(t,a,before)
 command:=func()ClassicSessionAction{return ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:2,Move:move}}
 wrong:=command();if _,e:=h.Sessions.Act(ctx,subjects[1-actor],match.ID,wrong);!errors.Is(e,ErrForbidden){t.Fatal("wrong seat",e)}
 timeout:=command();timeout.Move=json.RawMessage(`{"type":"timeout"}`);if _,e:=h.Sessions.Act(ctx,subjects[actor],match.ID,timeout);!errors.Is(e,ErrInvalid){t.Fatal("client timeout",e)}
 if !reflect.DeepEqual(before,r6Record(t,store,match.ID)){t.Fatal("rejection changed snapshot")}
 for i,subject:=range subjects{
  view,e:=h.Sessions.Get(ctx,subject,match.ID);if e!=nil{t.Fatal(e)}
  var v struct{Rack []struct{ID int}}
  if e=json.Unmarshal(view.PrivateView,&v);e!=nil{t.Fatal(e)}
  f,_:=a.decode(before.State);d,_:=saladDecode(f)
  ids:=[]int{};for _,x:=range v.Rack{ids=append(ids,x.ID)}
  if view.ViewerSeat!=i||!reflect.DeepEqual(ids,d.Racks[i])||strings.Contains(string(view.PrivateView),`"seed"`)||strings.Contains(string(view.PrivateView),`"racks"`){t.Fatal("rack privacy",i)}
 }
 if _,e:=h.Sessions.Get(ctx,extraThird,match.ID);!errors.Is(e,ErrNotFound){t.Fatal("outsider access",e)}
 // Independent transport instances contend on the same database locks.
 other,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)}
 services:=[]*ClassicSessions{h.Sessions,other};commands:=[]ClassicSessionAction{command(),command()}
 type result struct{i int;v ClassicSessionView;e error};results:=make(chan result,2);gate:=make(chan struct{});var wg sync.WaitGroup
 for i:=range services{wg.Add(1);go func(i int){defer wg.Done();<-gate;v,e:=services[i].Act(ctx,subjects[actor],match.ID,commands[i]);results<-result{i,v,e}}(i)}
 close(gate);wg.Wait();close(results)
 var accepted result;good,conflict:=0,0
 for r:=range results{if r.e==nil{good++;accepted=r}else if errors.Is(r.e,ErrConflict){conflict++}else{t.Fatal(r.e)}}
 if good!=1||conflict!=1||accepted.v.Sequence!=2{t.Fatal("concurrent placement",good,conflict)}
 after:=r6Record(t,store,match.ID);r6Counts(t,store,match.ID,[3]int{2,1,1})
 retry,e:=other.Act(ctx,subjects[actor],match.ID,commands[accepted.i]);if e!=nil||!reflect.DeepEqual(retry,accepted.v){t.Fatal("duplicate response",e)}
 stale:=command();if _,e=other.Act(ctx,subjects[1-actor],match.ID,stale);!errors.Is(e,ErrConflict){t.Fatal("stale",e)}
 altered:=commands[accepted.i];altered.Move=json.RawMessage(`{"type":"pass"}`);if _,e=other.Act(ctx,subjects[actor],match.ID,altered);!errors.Is(e,ErrConflict){t.Fatal("altered duplicate",e)}
 if !reflect.DeepEqual(after,r6Record(t,store,match.ID)){t.Fatal("retry/stale mutation")}
 for _,subject:=range subjects{v1,e:=h.Sessions.Get(ctx,subject,match.ID);if e!=nil{t.Fatal(e)};v2,e:=other.Get(ctx,subject,match.ID);if e!=nil||!reflect.DeepEqual(v1,v2){t.Fatal("restart active view",e)}}
 if e=other.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
 resign:=ClassicSessionAction{RequestID:bc06ActionID(t),Action:"resign",ExpectedSequence:3}
 terminal,e:=other.Act(ctx,subjects[actor],match.ID,resign);if e!=nil||terminal.Status!="finished"{t.Fatal("resign",e)}
 cold,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)}
 v,e:=cold.Get(ctx,subjects[actor],match.ID);if e!=nil||!reflect.DeepEqual(v,terminal){t.Fatal("terminal recovery",e)}
 if e=cold.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
 rejected:=command();rejected.ExpectedSequence=4;if _,e=cold.Act(ctx,subjects[1-actor],match.ID,rejected);!errors.Is(e,ErrConflict){t.Fatal("terminal write",e)}
 r6Counts(t,store,match.ID,[3]int{3,2,2})
}

// The operator test connection can inject journal faults; serving roles
// retain their insert-only journal privileges. A scoped CHECK rejects only
// this session's next private replay insert, after snapshot/public writes.
func TestBC42WordSaladJournalRollbackAndCorruption(t *testing.T){
 store,h,_,_:=bc06Fixture(t,"198.51.100.220");a:=r6Resolver(t,h);ctx:=context.Background();match:=r6Start(t,h,"untimed")
 before:=r6Record(t,store,match.ID);subjects:=[]string{memberA,memberB};actor:=*before.TurnSeat
 if !uuid.MatchString(match.ID){t.Fatal("invalid fixture ID")}
 constraint:="r6_test_reject_"+strings.ReplaceAll(match.ID,"-","")
 ddl:=fmt.Sprintf("ALTER TABLE bg_account_social.classic_rule_moves ADD CONSTRAINT %s CHECK (session_id <> '%s'::uuid)",constraint,match.ID)
 if _,e:=store.DB.Exec(ddl);e!=nil{t.Fatal(e)}
 drop:=func(){if _,e:=store.DB.Exec("ALTER TABLE bg_account_social.classic_rule_moves DROP CONSTRAINT IF EXISTS "+constraint);e!=nil{t.Error(e)}}
 t.Cleanup(drop)
 cmd:=ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:2,Move:r6Opening(t,a,before)}
 if _,e:=h.Sessions.Act(ctx,subjects[actor],match.ID,cmd);e==nil||!strings.Contains(e.Error(),constraint){t.Fatal("journal injection did not fail",e)}
 if !reflect.DeepEqual(before,r6Record(t,store,match.ID)){t.Fatal("rollback snapshot")}
 r6Counts(t,store,match.ID,[3]int{1,0,0});drop()
 if _,e:=h.Sessions.Act(ctx,subjects[actor],match.ID,cmd);e!=nil{t.Fatal("retry after rollback",e)}
 after:=r6Record(t,store,match.ID);r6Counts(t,store,match.ID,[3]int{2,1,1})
 var hash string;if e:=store.DB.QueryRow("SELECT after_hash FROM bg_account_social.classic_rule_moves WHERE session_id=$1 AND sequence=2",match.ID).Scan(&hash);e!=nil{t.Fatal(e)}
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_rule_moves SET after_hash=$2 WHERE session_id=$1 AND sequence=2",match.ID,strings.Repeat("0",64));e!=nil{t.Fatal(e)}
 restore:=func(){if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_rule_moves SET after_hash=$2 WHERE session_id=$1 AND sequence=2",match.ID,hash);e!=nil{t.Error(e)}};t.Cleanup(restore)
 cold,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)}
 next:=ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:3,Move:json.RawMessage(`{"type":"pass"}`)}
 for _,svc:=range []*ClassicSessions{h.Sessions,cold}{
  if e=svc.VerifyRules(ctx,match.ID);!errors.Is(e,ErrUnavailable){t.Fatal("corrupt audit",e)}
  if _,e=svc.Get(ctx,subjects[actor],match.ID);!errors.Is(e,ErrUnavailable){t.Fatal("corrupt read",e)}
  if _,e=svc.Act(ctx,subjects[1-actor],match.ID,next);!errors.Is(e,ErrUnavailable){t.Fatal("corrupt write",e)}
 }
 restore()
 original:=cold.Rules
 different,e:=NewWordSaladRulesAdapter([]string{"AT"},[]string{"KUSH"});if e!=nil{t.Fatal(e)}
 for _,resolver:=range []ClassicRuleResolver{func(string)ClassicRule{return different},func(string)ClassicRule{return nil}}{
  cold.Rules=resolver
  if _,e=cold.Get(ctx,subjects[actor],match.ID);!errors.Is(e,ErrUnavailable){t.Fatal("unavailable dictionary read",e)}
  if _,e=cold.Act(ctx,subjects[1-actor],match.ID,next);!errors.Is(e,ErrUnavailable){t.Fatal("unavailable dictionary write",e)}
 }
 cold.Rules=original
 if e=cold.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("restore",e)}
 if !reflect.DeepEqual(after,r6Record(t,store,match.ID)){t.Fatal("corruption attempts mutated snapshot")}
 r6Counts(t,store,match.ID,[3]int{2,1,1})
}
