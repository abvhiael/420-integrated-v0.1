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
  svc:=h.Sessions
  for j:=0;j<50&&match.Status=="active";j++{
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
   if match.Sequence!=before.Sequence+1{t.Fatal("unexpected sequence",before.Sequence,match.Sequence)}
   if match.Status=="active"&&(match.TurnSeat==nil||*match.TurnSeat==seat){t.Fatal("turn failed to advance")}
   if j==5{svc,e=NewClassicSessions(store,h.Rooms,resolve);if e!=nil{t.Fatal(e)};if e=svc.EnableBots(policies);e!=nil{t.Fatal(e)}}
  }
  if human<2||computer<2||words<1{t.Fatal("insufficient genuine alternating play",human,computer,words)}
  if e=svc.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("cold journal replay",e)}
  r6Counts(t,store,match.ID,[3]int{1+human+computer,human+computer,human})
  t.Logf("production dictionary: human=%d computer=%d human placements=%d final sequence=%d",human,computer,words,match.Sequence)
 })}
}
