//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "sync"
 "testing"
 "time"
)

func TestBC42WordSaladBotPostgres(t *testing.T){
 a,p:=saladBotTestPolicies(t)
 for i,level:=range []string{"easy","medium","hard"}{t.Run(level,func(t *testing.T){
  store,h,host,_:=bc06Fixture(t,[]string{"198.51.100.231","198.51.100.232","198.51.100.233"}[i])
  ctx:=context.Background()
  resolve:=func(game string)ClassicRule{if game=="scrabble"{return a};return nil}
  policies:=map[string]ClassicBotPolicies{"scrabble":p}
  h.Sessions.Rules=resolve;if e:=h.Sessions.EnableBots(policies);e!=nil{t.Fatal(e)}
  mode:=[]string{"live","async","untimed"}[i]
  room,e:=h.Rooms.CreateWithFormat(ctx,memberA,"scrabble","public",2,"11:classic-salad:"+mode);if e!=nil{t.Fatal(e)}
  status,room:=bc05Change(t,h,host,room.ID,room.Revision,1,"bot",map[string]any{"difficulty":level})
  if status!=200||room.Status!="ready"{t.Fatal(status,room)}
  match,e:=h.Sessions.Start(ctx,memberA,room.ID);if e!=nil{t.Fatal(e)}
  if *match.TurnSeat==0{
   if moved,e:=h.Sessions.RunBotTurn(ctx,match.ID);e!=nil||moved{t.Fatal("human turn consumed",e)}
   match,e=h.Sessions.Act(ctx,memberA,match.ID,ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:match.Sequence+1,Move:json.RawMessage(`{"type":"pass"}`)});if e!=nil{t.Fatal(e)}
  }
  before:=r6Record(t,store,match.ID)
  if before.TurnSeat==nil||*before.TurnSeat!=1{t.Fatal("not bot turn")}
  cold,e:=NewClassicSessions(store,h.Rooms,resolve);if e!=nil{t.Fatal(e)}
  if e=cold.EnableBots(policies);e!=nil{t.Fatal(e)}
  var wg sync.WaitGroup;results:=make(chan bool,2);errs:=make(chan error,2)
  for _,svc:=range []*ClassicSessions{h.Sessions,cold}{wg.Add(1);go func(s *ClassicSessions){defer wg.Done();m,e:=s.RunBotTurn(ctx,match.ID);results<-m;errs<-e}(svc)}
  wg.Wait();close(results);close(errs)
  for e:=range errs{if e!=nil{t.Fatal(e)}};count:=0;for m:=range results{if m{count++}}
  if count!=1{t.Fatal("concurrent workers",count)}
  after:=r6Record(t,store,match.ID)
  if after.Sequence!=before.Sequence+1||after.TurnSeat==nil||*after.TurnSeat!=0{t.Fatal("invalid bot turn transition",after.Sequence)}
  if mode=="untimed"{if after.Deadline!=nil{t.Fatal("untimed deadline invented")}}else{
   duration:=120*time.Second;if mode=="async"{duration=24*time.Hour}
   if after.Deadline==nil||time.Until(*after.Deadline)<duration-10*time.Second||time.Until(*after.Deadline)>duration+time.Second{t.Fatal("wrong deadline",after.Deadline)}
  }
  var raw json.RawMessage;if e=store.DB.QueryRow("SELECT action FROM bg_account_social.classic_rule_moves WHERE session_id=$1 AND sequence=$2",match.ID,after.Sequence).Scan(&raw);e!=nil{t.Fatal(e)}
  var m saladMove;if !strictRuleJSON(raw,&m)||(m.Type!="place"&&m.Type!="exchange"&&m.Type!="pass"){t.Fatal("invalid recorded action",string(raw))}
  if e=cold.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("cold replay",e)}
  view,e:=cold.Get(ctx,memberA,match.ID);if e!=nil||view.ViewerSeat!=0{t.Fatal("human view",e)}
  var v saladBotView;if !strictRuleJSON(view.PrivateView,&v){t.Fatal("private projection schema")}
  f,_:=a.decode(after.State);d,_:=saladDecode(f)
  for _,tile:=range v.Rack{for _,id:=range d.Racks[1]{if tile.ID==id{t.Fatal("opponent tile exposed")}}}
  terminal,e:=cold.Act(ctx,memberA,match.ID,ClassicSessionAction{RequestID:bc06ActionID(t),Action:"resign",ExpectedSequence:after.Sequence+1});if e!=nil||terminal.Status!="finished"{t.Fatal("terminal",e)}
  if moved,e:=cold.RunBotTurn(ctx,match.ID);e!=nil||moved{t.Fatal("terminal bot action",e)}
  if e=cold.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("terminal replay",e)}
 })}
}

// Real production dictionary, persisted human commands and server AI turns.
// The human test driver selects from its own seat projection through the
// same qualified policy, not a fabricated score, board or opponent response.
func TestBC42WordSaladAlternatingProductionTurns(t *testing.T){
 a,p:=saladBotTestPolicies(t)
 for i,level:=range []string{"easy","medium","hard"}{t.Run(level,func(t *testing.T){
  store,h,_,_:=bc06Fixture(t,[]string{"198.51.100.241","198.51.100.242","198.51.100.243"}[i])
  ctx:=context.Background()
  resolve:=func(game string)ClassicRule{if game=="scrabble"{return a};return nil}
  policies:=map[string]ClassicBotPolicies{"scrabble":p}
  h.Sessions.Rules=resolve;if e:=h.Sessions.EnableBots(policies);e!=nil{t.Fatal(e)}
  room,e:=h.Rooms.CreateWithFormat(ctx,memberA,"scrabble","private",2,"17:classic-salad:untimed");if e!=nil{t.Fatal(e)}
  room,e=h.Rooms.Change(ctx,memberA,room.ID,RoomChange{Action:"bot",Seat:1,ExpectedRevision:room.Revision,Difficulty:level});if e!=nil{t.Fatal(e)}
  match,e:=h.Sessions.startWithSeedSource(ctx,memberA,room.ID,"",func()([32]byte,error){return [32]byte{42},nil});if e!=nil{t.Fatal(e)}
  human,computer,words:=0,0,0
  totals:=make([]int64,2)
  svc:=h.Sessions
  for j:=0;j<600&&match.Status=="active";j++{
   before:=r6Record(t,store,match.ID)
   if before.TurnSeat==nil{t.Fatal("missing turn")}
   seat:=*before.TurnSeat
   if seat==0{
    move,e:=a.ChooseMove(before.State,seat,"hard",p.Hard);if e!=nil{t.Fatal(e)}
    var m saladMove;if !strictRuleJSON(move,&m){t.Fatal("invalid decision")};if m.Type=="place"{words++}
    cmd:=ClassicSessionAction{RequestID:bc06ActionID(t),Action:"move",ExpectedSequence:before.Sequence+1,Move:move}
    match,e=svc.Act(ctx,memberA,match.ID,cmd);if e!=nil{t.Fatal("human action",e)}
    human++
    retry,e:=svc.Act(ctx,memberA,match.ID,cmd);if e!=nil||retry.Sequence!=match.Sequence{t.Fatal("idempotent acknowledgement",e)}
   }else{
    if j%2==0{match,e=svc.RecoverWordSaladBot(ctx,memberA,match.ID)}else{
     var moved bool;moved,e=svc.RunBotTurn(ctx,match.ID);if e==nil&&!moved{t.Fatal("stalled computer")}
     if e==nil{match,e=svc.Get(ctx,memberA,match.ID)}
    }
    if e!=nil{t.Fatal("computer action",e)}
    computer++
   }
   previous,e:=a.decode(before.State);if e!=nil{t.Fatal(e)}
   persisted:=r6Record(t,store,match.ID)
   current,e:=a.decode(persisted.State);if e!=nil{t.Fatal(e)}
   ws1AuditScore(t,a,previous,current,seat,totals)
   if match.Sequence!=before.Sequence+1{t.Fatal("unexpected sequence",before.Sequence,match.Sequence)}
   if match.Status=="active"&&(match.TurnSeat==nil||*match.TurnSeat==seat){t.Fatal("turn failed to advance")}
   if j==5{svc,e=NewClassicSessions(store,h.Rooms,resolve);if e!=nil{t.Fatal(e)};if e=svc.EnableBots(policies);e!=nil{t.Fatal(e)}}
  }
  if match.Status!="finished"{t.Fatal("game did not naturally complete",match.Status,match.Sequence)}
  final:=r6Record(t,store,match.ID)
  frame,e:=a.decode(final.State);if e!=nil{t.Fatal(e)}
  data,e:=saladDecode(frame);if e!=nil{t.Fatal(e)}
  if !frame.Terminal||final.TurnSeat!=nil||(data.Ending!="out"&&data.Ending!="scoreless"){t.Fatal("invalid natural completion",data.Ending)}
  expected:=[]int{0};if frame.Scores[1]>frame.Scores[0]{expected=[]int{1}}else if frame.Scores[1]==frame.Scores[0]{expected=[]int{0,1}}
  if len(data.Winners)!=len(expected){t.Fatal("winner count",data.Winners,frame.Scores)}
  for k,w:=range expected{if data.Winners[k]!=w{t.Fatal("winner mismatch",data.Winners,frame.Scores)}}
  if len(expected)==1{if final.WinnerSeat==nil||*final.WinnerSeat!=expected[0]{t.Fatal("persisted winner mismatch")}}else if final.WinnerSeat!=nil{t.Fatal("tie has sole winner")}
  t.Logf("independent score audit: %v",totals)
  t.Logf("natural completion: %s scores=%v winners=%v",data.Ending,frame.Scores,data.Winners)
  if human<2||computer<2||words<1{t.Fatal("insufficient genuine alternating play",human,computer,words)}
  if e=svc.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("cold journal replay",e)}
  r6Counts(t,store,match.ID,[3]int{1+human+computer,human+computer,human})
  t.Logf("production dictionary: human=%d computer=%d human placements=%d final sequence=%d",human,computer,words,match.Sequence)
 })}
}

// Independently enumerate every maximal horizontal/vertical word on the
// resulting board, counting only runs touching newly occupied cells.
// Do not call place, Step, bot scoring, saladFinish or saladRackValue.
func ws1AuditScore(t *testing.T,a *RulesAdapter,before,after RuleFrame,actor int,totals []int64){
 t.Helper()
 p,mode,e:=saladVariant(before.Variant,before.SeatCount);if e!=nil{t.Fatal(e)}
 old,e:=saladDecode(before);if e!=nil{t.Fatal(e)}
 next,e:=saladDecode(after);if e!=nil{t.Fatal(e)}
 pack:=saladPack(p);premium:=saladPremium(p)
 rules:=a.module.(wordSaladRules)
 fresh:=map[int]bool{}
 for pos,c:=range old.Board{if next.Board[pos]!=c{t.Fatal("previous cell altered",pos)}}
 for pos:=range next.Board{if _,ok:=old.Board[pos];!ok{fresh[pos]=true}}
 var points int64
 for axis:=0;axis<2;axis++{
  for line:=0;line<p.size;line++{
   var sum,mult int64=0,1
   word:="";cells:=0;touch:=false
   flush:=func(){if cells>=2&&touch{if mode!="straight-greens"&&rules.cannabis[word]{mult*=2};points+=sum*mult};sum=0;mult=1;word="";cells=0;touch=false}
   for offset:=0;offset<p.size;offset++{
    pos:=line*p.size+offset;if axis==1{pos=offset*p.size+line}
    c,ok:=next.Board[pos];if !ok{flush();continue}
    symbol:=saladSymbols[pack[c.ID]];if symbol=="?"{symbol=c.Blank}
    word+=symbol;cells++
    v:=saladValues[pack[c.ID]]
    if fresh[pos]{touch=true;switch premium[pos]{case 1:v*=2;case 2:v*=3;case 3:v*=4;case 4,6:mult*=2;case 5:mult*=3}}
    sum+=v
   }
   flush()
  }
 }
 if len(fresh)==p.rack{if p.rack==7{points+=50}else{points+=60}}
 totals[actor]+=points
 if after.Terminal{
  if next.Ending!="out"&&next.Ending!="scoreless"{t.Fatal("unexpected finish",next.Ending)}
  for i,rack:=range next.Racks{
   if next.Ending=="out"&&i==actor{if len(rack)!=0||len(next.Bag)!=0{t.Fatal("invalid out finish")};continue}
   var deduction int64;for _,id:=range rack{deduction+=saladValues[pack[id]]}
   totals[i]-=deduction
   if next.Ending=="out"{totals[actor]+=deduction}
  }
 }
 for i,want:=range totals{if after.Scores[i]!=want{t.Fatalf("independent score audit seat=%d round=%d expected=%d actual=%d",i,after.Round,want,after.Scores[i])}}
}
