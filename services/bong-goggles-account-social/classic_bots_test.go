package social

import (
 "bytes"
 "encoding/json"
 "errors"
 "testing"
 "time"
)

type bc08Policy struct {
 choice int
 seen json.RawMessage
 calls int
 drift bool
 illegal bool
 unmetered bool
 overBudget bool
 mutate bool
}
func (p *bc08Policy)ChooseMove(view json.RawMessage,_ string,options []json.RawMessage,b *RuleBudget)(json.RawMessage,error){
 p.seen=append(p.seen[:0],view...)
 p.calls++
 if !p.unmetered{
  cost:=1
  if p.overBudget{cost=100001}
  if e:=b.Charge(cost);e!=nil{return nil,e}
 }
 if len(options)<2{return nil,ErrUnavailable}
 if p.mutate{
  options[0]=json.RawMessage(`{"take":999}`)
  view[0]='X'
 }
 if p.illegal{return json.RawMessage(`{"take":999}`),nil}
 choice:=p.choice
 if p.drift&&p.calls%2==0{choice=(choice+1)%2}
 return append(json.RawMessage(nil),options[choice]...),nil
}
func bc08Policies()(ClassicBotPolicies,*bc08Policy,*bc08Policy,*bc08Policy){
 easy,medium,hard:=&bc08Policy{choice:0},&bc08Policy{choice:1},&bc08Policy{choice:1}
 return ClassicBotPolicies{Easy:easy,Medium:medium,Hard:hard},easy,medium,hard
}
func TestBC08DeterministicBotVersusBotSimulation(t *testing.T){
 adapter:=bc07Adapter(t)
 p,easy,medium,hard:=bc08Policies()
 seed:=bc07Seed()
 first,e:=QualifyBotMatch(adapter,seed,[]string{"easy","hard"},p)
 if e!=nil{t.Fatal(e)}
 if len(first.Trace)!=4||first.Winner==nil||*first.Winner!=1||
  first.Scores[0]!=2||first.Scores[1]!=4{t.Fatal("bad bot-v-bot terminal outcome",first,e)}
 again,e:=QualifyBotMatch(adapter,seed,[]string{"easy","hard"},p)
 if e!=nil||!bytes.Equal(first.State,again.State)||!bytes.Equal(first.Trace[0].Action,again.Trace[0].Action){
  t.Fatal("same-seed bot decisions diverged",e)
 }
 if easy.calls==0||hard.calls==0{t.Fatal("AI levels not executed")}
 mixed,e:=QualifyBotMatch(adapter,seed,[]string{"medium","hard"},p)
 if e!=nil||mixed.Winner!=nil||mixed.Scores[0]!=4||mixed.Scores[1]!=4{t.Fatal("middle/hard tie fixture",mixed,e)}
 if medium.calls==0{t.Fatal("medium level not executed")}
 for _,bot:=range []*bc08Policy{easy,medium,hard}{
  if bytes.Contains(bot.seen,[]byte("seed"))||bytes.Contains(bot.seen,[]byte("private0"))||
   bytes.Contains(bot.seen,[]byte("private1"))||bytes.Contains(bot.seen,[]byte("rulesHash"))||
   !bytes.Contains(bot.seen,[]byte("mine")){
    t.Fatal("bot received state or opponent secrets",string(bot.seen))
  }
 }
 bad:=[]string{"novice","expert"}
 for _,level:=range bad{
  if _,e=QualifyBotMatch(adapter,seed,[]string{"easy",level},p);e==nil{t.Fatal("unknown policy difficulty",level)}
 }
}
func TestBC08RejectIllegalUnmeteredNondeterministicAndUnboundedBots(t *testing.T){
 adapter:=bc07Adapter(t)
 state,e:=adapter.initial(bc07Seed(),2);if e!=nil{t.Fatal(e)}
 cases:=[]struct{name string;policy *bc08Policy;limit int;deadline time.Time;wanted error}{
  {"illegal",&bc08Policy{illegal:true},100,time.Time{},ErrForbidden},
  {"unmetered",&bc08Policy{unmetered:true},100,time.Time{},ErrUnavailable},
  {"over budget",&bc08Policy{overBudget:true},100,time.Time{},ErrUnavailable},
  {"nondeterministic",&bc08Policy{drift:true},100,time.Time{},ErrUnavailable},
  {"expired deadline",&bc08Policy{},100,time.Now().Add(-time.Second),ErrUnavailable},
  {"zero budget",&bc08Policy{},0,time.Time{},ErrUnavailable},
 }
 for _,tc:=range cases{
  t.Run(tc.name,func(t *testing.T){
   _,err:=adapter.ChooseMoveBounded(state,0,"hard",tc.policy,tc.limit,tc.deadline)
   if !errors.Is(err,tc.wanted){t.Fatal("bot not rejected",err)}
  })
 }
 mutator:=&bc08Policy{choice:1,mutate:true}
 if _,e=adapter.ChooseMoveBounded(state,0,"easy",mutator,100,time.Time{});e!=nil{
  t.Fatal("copied input mutation must not corrupt original legal options",e)
 }
 legal,e:=adapter.LegalActions(state,0);if e!=nil||!bytes.Equal(legal[0],json.RawMessage(`{"take":1}`)){
  t.Fatal("mutated policy escaped isolation",e)
 }
 if _,e=QualifyBotMatch(adapter,bc07Seed(),[]string{"easy","hard"},
  ClassicBotPolicies{Easy:&bc08Policy{},Hard:&bc08Policy{}});e==nil{
  t.Fatal("incomplete policy set accepted")
 }
 if _,e=adapter.ChooseMove(state,1,"easy",&bc08Policy{});e==nil{
  t.Fatal("bot requested opponent's turn")
 }
}
func TestBC08BotSeatsMustUseValidControlAndDifficulty(t *testing.T){
 adapter:=bc07Adapter(t)
 seed:=bc07Seed()
 room:=ClassicRoom{GameID:"chess",SeatCount:2}
 seats:=[]ClassicSeat{{Index:0,Controller:"human",Subject:"11111111-1111-4111-8111-111111111111"},
  {Index:1,Controller:"bot",Difficulty:"medium"}}
 if _,_,e:=adapter.InitialWithSeed(seed,room,seats);e!=nil{t.Fatal("mixed human/bot rejected",e)}
 bad:=append([]ClassicSeat(nil),seats...)
 bad[1].Difficulty="expert"
 if _,_,e:=adapter.InitialWithSeed(seed,room,bad);e==nil{t.Fatal("unknown difficulty accepted")}
 bad[1].Difficulty="medium";bad[1].Subject=seats[0].Subject
 if _,_,e:=adapter.InitialWithSeed(seed,room,bad);e==nil{t.Fatal("bot with human identity accepted")}
 bad[1].Subject="";bad[0].Subject=""
 if _,_,e:=adapter.InitialWithSeed(seed,room,bad);e==nil{t.Fatal("anonymous human accepted")}
}
