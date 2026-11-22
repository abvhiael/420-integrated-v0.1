package social

import (
 "bytes"
 "encoding/json"
 "testing"
 "time"
)

func bc13Adapter(t *testing.T)*RulesAdapter{
 t.Helper()
 a,e:=NewCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 return a
}
func bc13Seed(n int)[32]byte{
 var seed [32]byte
 for i:=range seed{seed[i]=byte(n*17+i*3)}
 return seed
}
func bc13Choice(t *testing.T,a *RulesAdapter,state json.RawMessage,seat int,level string,p ClassicBotPolicies)json.RawMessage{
 t.Helper()
 policy,e:=p.policy(level);if e!=nil{t.Fatal(e)}
 limit,_,e:=botLimits(level);if e!=nil{t.Fatal(e)}
 action,e:=a.ChooseMoveBounded(state,seat,level,policy,limit,time.Now().Add(2*time.Second))
 if e!=nil{t.Fatalf("%s bot decision: %v",level,e)}
 legal,e:=a.LegalActions(state,seat);if e!=nil{t.Fatal(e)}
 found:=false
 for _,candidate:=range legal{if bytes.Equal(candidate,action){found=true}}
 if !found{t.Fatalf("%s chose a move not in human legal list",level)}
 return action
}
func TestBC13AllThreeStrategiesChooseOnlyHumanLegalMoves(t *testing.T){
 adapter:=bc13Adapter(t);p:=NewCribbageBotPolicies()
 if !p.complete(){t.Fatal("three policy registration incomplete")}
 variants:=[]int{2,3,4}
 var easyMedium,mediumHard,easyHard int
 for _,count:=range variants{
  for seedNum:=0;seedNum<40;seedNum++{
   state,e:=adapter.initial(bc13Seed(100*count+seedNum),count)
   if e!=nil{t.Fatal(e)}
   f:=cribFrame(t,adapter,state)
   actions:=make([]json.RawMessage,3)
   for i,level:=range []string{"easy","medium","hard"}{
    actions[i]=bc13Choice(t,adapter,state,f.Turn,level,p)
    twice:=bc13Choice(t,adapter,state,f.Turn,level,p)
    if !bytes.Equal(actions[i],twice){t.Fatalf("%s bot not deterministic",level)}
   }
   if !bytes.Equal(actions[0],actions[1]){easyMedium++}
   if !bytes.Equal(actions[1],actions[2]){mediumHard++}
   if !bytes.Equal(actions[0],actions[2]){easyHard++}
  }
 }
 if easyMedium==0||mediumHard==0||easyHard==0{
  t.Fatalf("difficulty decisions not genuinely distinct across 120 deals: easy/medium=%d medium/hard=%d easy/hard=%d",easyMedium,mediumHard,easyHard)
 }
 t.Logf("independent policy choices across deals: easy/medium %d, medium/hard %d, easy/hard %d",easyMedium,mediumHard,easyHard)
}
func TestBC13PrivateViewOnlyAndHostileInputRejection(t *testing.T){
 a:=bc13Adapter(t);p:=NewCribbageBotPolicies()
 for _,count:=range []int{2,3,4}{
  state,e:=a.initial(bc13Seed(count),count);if e!=nil{t.Fatal(e)}
  f:=cribFrame(t,a,state)
  legal,e:=a.LegalActions(state,f.Turn);if e!=nil{t.Fatal(e)}
  view,e:=a.View(state,f.Turn);if e!=nil{t.Fatal(e)}
  if bytes.Contains(view,[]byte(f.Seed))||
   bytes.Contains(view,[]byte("\"deck\""))||
   bytes.Contains(view,[]byte("\"crib\""))||
   bytes.Contains(view,[]byte("\"opponentHand\""))||
   bytes.Contains(view,[]byte("\"allHands\"")){t.Fatal("server leaked secret into bot view")}
  for _,level:=range []string{"easy","medium","hard"}{
   policy,e:=p.policy(level);if e!=nil{t.Fatal(e)}
   limit,_,_:=botLimits(level)
   before:=append([]byte(nil),view...)
   action,e:=policy.ChooseMove(view,level,legal,NewRuleBudget(limit))
   if e!=nil{t.Fatal("policy rejected legal own observation",level,e)}
   if !bytes.Equal(view,before){t.Fatal("bot mutated source view")}
   present:=false
   for _,l:=range legal{if bytes.Equal(l,action){present=true}}
   if !present{t.Fatal("policy used non-legal move")}
   if _,e=policy.ChooseMove(view,"expert",legal,NewRuleBudget(limit));e==nil{t.Fatal("level bypass")}
   if _,e=policy.ChooseMove(view,level,legal,NewRuleBudget(0));e==nil{t.Fatal("budget bypass")}
   var fields map[string]json.RawMessage
   if e=json.Unmarshal(view,&fields);e!=nil{t.Fatal(e)}
   for _,secret:=range []string{"opponentHand","allHands","deck","seed","engineState","crib","rulesHash"}{
    fields[secret]=json.RawMessage(`[0,1]`)
    tampered,_:=json.Marshal(fields)
    if _,e=policy.ChooseMove(tampered,level,legal,NewRuleBudget(limit));e==nil{t.Fatalf("%s accepted forbidden %s",level,secret)}
    delete(fields,secret)
   }
   if len(legal)>0{
    illegal:=append([]json.RawMessage(nil),legal...)
    illegal[0]=json.RawMessage(`{"type":"discard","cards":[51,51]}`)
    if _,e=policy.ChooseMove(view,level,illegal,NewRuleBudget(limit));e==nil{t.Fatal("invalid duplicate cards accepted")}
   }
  }
 }
}
func TestBC13MediumPrefersKnownPeggingPoints(t *testing.T){
 v:=cribbageBotView{
  GameID:"cribbage",Variant:"standard-2p",Round:1,Phase:"peg",Dealer:1,
  Turn:0,Seat:0,Scores:[]int64{10,10},
  Hand:[]int{cribCard(5,0),cribCard(9,1),cribCard(2,2)},
  CardCounts:[]int{3,3},Discarded:[]bool{true,true},
  Starter:cribCard(7,3),PegCount:10,PegPile:[]int{cribCard(10,0)},
  Pegged:[][]int{{},{}},SaidGo:[]bool{false,false},
 }
 view,e:=json.Marshal(v);if e!=nil{t.Fatal(e)}
 legal:=[]json.RawMessage{}
 for _,c:=range v.Hand{
  x:=c
  legal=append(legal,cribbageJsonAction(cribbageMove{Type:"play",Card:&x}))
 }
 policies:=NewCribbageBotPolicies()
 medium,e:=policies.Medium.ChooseMove(view,"medium",legal,NewRuleBudget(10000))
 if e!=nil{t.Fatal(e)}
 var chosen cribbageMove
 if !strictRuleJSON(medium,&chosen)||chosen.Card==nil||*chosen.Card!=cribCard(5,0){t.Fatal("medium ignored guaranteed 15",string(medium))}
}
func TestBC13MixedSeatSetupsAndFullBotMatches(t *testing.T){
 a:=bc13Adapter(t);policies:=NewCribbageBotPolicies()
 subjects:=[]string{
  "10000000-1111-4111-8111-111111111111",
  "20000000-2222-4222-8222-222222222222",
  "30000000-3333-4333-8333-333333333333",
  "40000000-4444-4444-8444-444444444444",
 }
 configs:=[][]string{
  {"easy","medium"},
  {"easy","medium","hard"},
  {"hard","medium","easy","hard"},
 }
 for _,levels:=range configs{
  n:=len(levels)
  variant,_:=cribbageVariantFor(n)
  room:=ClassicRoom{GameID:"cribbage",SeatCount:n}
  seats:=make([]ClassicSeat,n)
  for i,level:=range levels{
   seats[i]=ClassicSeat{Index:i,Controller:"bot",Difficulty:level,Team:variant.Teams[i]}
  }
  // The exact human/bot mix uses one authenticated human and the identical
  // rules adapter, rather than a separate or all-visible practice engine.
  seats[0]=ClassicSeat{Index:0,Controller:"human",Subject:subjects[0],Team:variant.Teams[0]}
  if _,_,e:=a.InitialWithSeed(bc13Seed(300+n),room,seats);e!=nil{t.Fatal("human/bot initial setup",n,e)}
  seats[0]=ClassicSeat{Index:0,Controller:"bot",Difficulty:levels[0],Team:variant.Teams[0]}
  result,e:=QualifyBotMatch(a,bc13Seed(500+n),levels,policies)
  if e!=nil{t.Fatalf("complete %d-seat mixed-difficulty match failed: %v",n,e)}
  if result.Winner==nil||len(result.Trace)==0||len(result.Trace)>a.replayLimit()||result.Scores[*result.Winner]<121{
   t.Fatal("invalid full-game result",n)
  }
  state,e:=a.Replay(bc13Seed(500+n),n,result.Trace)
  if e!=nil||!bytes.Equal(state,result.State){t.Fatal("trace replay failure",n,e)}
  t.Logf("%d-seat bot match: actions=%d, winner=%d, scores=%v",n,len(result.Trace),*result.Winner,result.Scores)
 }
}
