package social

import (
 "bytes"
 "encoding/json"
 "strings"
 "testing"
 "time"
)

func bc23Choice(t *testing.T,a *RulesAdapter,state json.RawMessage,level string,p ClassicBotPolicies)json.RawMessage{
 t.Helper()
 f,e:=a.decode(state);if e!=nil{t.Fatal(e)}
 policy,e:=p.policy(level);if e!=nil{t.Fatal(e)}
 limit,_,e:=botLimits(level);if e!=nil{t.Fatal(e)}
 move,e:=a.ChooseMoveBounded(state,f.Turn,level,policy,limit,time.Time{})
 if e!=nil{t.Fatalf("%s Labyrinth decision phase=%s: %v",level,f.Phase,e)}
 legal,e:=a.LegalActions(state,f.Turn);if e!=nil{t.Fatal(e)}
 found:=false
 for _,item:=range legal{if bytes.Equal(item,move){found=true;break}}
 if !found{t.Fatal("bot used an action not permitted for its own human seat")}
 return move
}
func TestBC23FastShowMatchesAuthoritativeSevenCardScoring(t *testing.T){
 // The accelerated EV evaluator must NEVER diverge from server scoring.
 for n:=0;n<1400;n++{
  shuffled,e:=cribbageShuffle(labSeed(byte(n)), "bc23-score-"+string(rune(n)))
  if e!=nil{t.Fatal(e)}
  for _,crib:=range []bool{false,true}{
   want,e:=labyrinthCountShow(shuffled[:6],shuffled[6],crib);if e!=nil{t.Fatal(e)}
   got:=labyrinthBotShowScore(shuffled[:6],shuffled[6],crib)
   if got!=want.Total{t.Fatalf("non-authoritative bot EV score n=%d crib=%v got=%d want=%d",n,crib,got,want.Total)}
  }
 }
 for _,tc:=range []struct{hand []int;starter int;crib bool}{
  {[]int{0,1,2,3,4,5},6,false},
  {[]int{0,1,2,3,4,5},13,false},
  {[]int{0,1,2,3,4,5},6,true},
  {[]int{0,1,2,3,4,5},13,true},
  {[]int{2,15,28,3,16,43},7,false},
 }{
  want,e:=labyrinthCountShow(tc.hand,tc.starter,tc.crib)
  if e!=nil||labyrinthBotShowScore(tc.hand,tc.starter,tc.crib)!=want.Total{
   t.Fatal("approved 6/7 suit and run multiplicity fixture diverged",tc,e)
  }
 }
}
func TestBC23StrategiesAllVariantsDeterministicLegalAndDistinct(t *testing.T){
 a:=labAdapter(t);policies:=NewLabyrinthCribbageBotPolicies()
 if !policies.complete(){t.Fatal("missing difficulty implementation")}
 variants:=[]struct{n int;id string}{
  {2,"labyrinth-2p"},{3,"labyrinth-3p"},
  {4,"labyrinth-4p-partners"},{4,"labyrinth-4p-individual"},
 }
 easyMedium,mediumHard,easyHard:=0,0,0
 for j,config:=range variants{t.Run(config.id,func(t *testing.T){
  counts:=0
  for seedIndex:=0;seedIndex<14;seedIndex++{
   state,e:=a.initialConfigured(labSeed(byte(30+seedIndex+j*23)),config.n,config.id)
   if e!=nil{t.Fatal(e)}
   f,e:=a.decode(state);if e!=nil{t.Fatal(e)}
   legal,e:=a.LegalActions(state,f.Turn);if e!=nil{t.Fatal(e)}
   expected:=7;if config.n==2{expected=84}else if config.n==3{expected=28}
   if len(legal)!=expected{t.Fatal("bad Labyrinth discard count",len(legal),expected)}
   choices:=make([]json.RawMessage,3)
   for i,level:=range []string{"easy","medium","hard"}{
    choice:=bc23Choice(t,a,state,level,policies)
    again:=bc23Choice(t,a,state,level,policies)
    if !bytes.Equal(choice,again){t.Fatal("seed-independent nondeterministic choice",level)}
    var move cribbageMove
    if !strictRuleJSON(choice,&move)||move.Type!="discard"||len(move.Cards)!=func()int{
     if config.n==2{return 3};if config.n==3{return 2};return 1
    }(){t.Fatal("illegal discard shape",level,string(choice))}
    choices[i]=choice
   }
   if !bytes.Equal(choices[0],choices[1]){easyMedium++;counts++}
   if !bytes.Equal(choices[1],choices[2]){mediumHard++;counts++}
   if !bytes.Equal(choices[0],choices[2]){easyHard++;counts++}
  }
  if counts==0{t.Fatal("all three difficulty decisions identical over variants",config.id)}
 })}
 if easyMedium==0||mediumHard==0||easyHard==0{
  t.Fatalf("bots are not genuinely differentiated: easy/medium=%d medium/hard=%d easy/hard=%d",easyMedium,mediumHard,easyHard)
 }
 t.Logf("difficulty disagreement across 56 deals: easy/medium=%d medium/hard=%d easy/hard=%d",easyMedium,mediumHard,easyHard)
}
func TestBC23RejectHiddenAndForgedViewsActionsAndBudget(t *testing.T){
 a:=labAdapter(t);policies:=NewLabyrinthCribbageBotPolicies()
 for _,config:=range []struct{count int;variant string}{
  {2,"labyrinth-2p"},{3,"labyrinth-3p"},
  {4,"labyrinth-4p-partners"},{4,"labyrinth-4p-individual"},
 }{
  state,e:=a.initialConfigured(labSeed(byte(40+config.count)),config.count,config.variant)
  if e!=nil{t.Fatal(e)}
  f,e:=a.decode(state);if e!=nil{t.Fatal(e)}
  view,e:=a.View(state,f.Turn);if e!=nil{t.Fatal(e)}
  legal,e:=a.LegalActions(state,f.Turn);if e!=nil{t.Fatal(e)}
  before:=append([]byte(nil),view...)
  var fields map[string]json.RawMessage
  if e=json.Unmarshal(view,&fields);e!=nil{t.Fatal(e)}
  for _,level:=range []string{"easy","medium","hard"}{
   policy,e:=policies.policy(level);if e!=nil{t.Fatal(e)}
   limit,_,_:=botLimits(level)
   valid,e:=policy.ChooseMove(view,level,legal,NewRuleBudget(limit))
   if e!=nil{t.Fatalf("policy denied valid view %s: %v",level,e)}
   found:=false
   for _,item:=range legal{if bytes.Equal(item,valid){found=true}}
   if !found||!bytes.Equal(before,view){t.Fatal("policy changed private view or forged its legal move")}
   if _,e=policy.ChooseMove(view,"expert",legal,NewRuleBudget(limit));e==nil{t.Fatal("wrong level accepted")}
   if _,e=policy.ChooseMove(view,level,legal,NewRuleBudget(0));e==nil{t.Fatal("zero compute budget accepted")}
   for _,secret:=range []string{"deck","seed","rulesHash","engineState","initialState","crib","allHands","opponentHand"}{
    fields[secret]=json.RawMessage(`[1,2,3]`)
    forged,_:=json.Marshal(fields)
    if _,e=policy.ChooseMove(forged,level,legal,NewRuleBudget(limit));e==nil{
     t.Fatalf("%s accepted leaked %s on %s",level,secret,config.variant)
    }
    delete(fields,secret)
   }
   forged:=append([]json.RawMessage(nil),legal...)
   forged[0]=json.RawMessage(`{"type":"discard","cards":[0,0,0]}`)
   if _,e=policy.ChooseMove(view,level,forged,NewRuleBudget(limit));e==nil{t.Fatal("duplicate physical cards accepted")}
   forged[0]=json.RawMessage(`{"type":"discard","cards":[51,50,49]}`)
   if _,e=policy.ChooseMove(view,level,forged,NewRuleBudget(limit));e==nil{t.Fatal("foreign/incorrect discard admitted")}
   forged[0]=json.RawMessage(`{"type":"play","card":0}`)
   if _,e=policy.ChooseMove(view,level,forged,NewRuleBudget(limit));e==nil{t.Fatal("wrong-phase action accepted")}
   if _,e=policy.ChooseMove(view,level,nil,NewRuleBudget(limit));e==nil{t.Fatal("empty legal list accepted")}
   if _,e=policy.ChooseMove(json.RawMessage(`{"gameId":"cribbage"}`),level,legal,NewRuleBudget(limit));e==nil{t.Fatal("standard Cribbage view admitted")}
  }
 }
 if _,e:=NewCribbageRulesAdapter();e!=nil{t.Fatal("standard policy definition broken",e)}
 // A caller cannot pass deadline-expired work to the authoritative adapter.
 state,e:=a.initial(labSeed(55),2);if e!=nil{t.Fatal(e)}
 if _,e=a.ChooseMoveBounded(state,1,"hard",policies.Hard,100000,time.Now().Add(-time.Second));e==nil{
  t.Fatal("deadline disabled by Labyrinth bot")
 }
}
func TestBC23MediumHardTakeCertainFifteenAndImmediate241(t *testing.T){
 v:=cribbageBotView{
  GameID:"labyrinth-cribbage",Variant:"labyrinth-2p",
  Round:1,Phase:"peg",Dealer:1,Turn:0,Seat:0,Scores:[]int64{239,230},
  Hand:[]int{cribCard(5,0),cribCard(9,1),cribCard(2,2)},
  CardCounts:[]int{3,5},Discarded:[]bool{true,true},
  Starter:cribCard(7,3),PegCount:10,PegPile:[]int{cribCard(10,1)},
  Pegged:[][]int{{},{cribCard(10,1)}},SaidGo:[]bool{false,false},
 }
 raw,e:=json.Marshal(v);if e!=nil{t.Fatal(e)}
 legal:=[]json.RawMessage{}
 for _,card:=range v.Hand{
  c:=card;legal=append(legal,cribbageJsonAction(cribbageMove{Type:"play",Card:&c}))
 }
 for _,level:=range []string{"medium","hard"}{
  policies:=NewLabyrinthCribbageBotPolicies()
  policy,_:=policies.policy(level)
  move,e:=policy.ChooseMove(raw,level,legal,NewRuleBudget(100000))
  if e!=nil{t.Fatal("policy denied tactical opportunity",level,e)}
  var selected cribbageMove
  if !strictRuleJSON(move,&selected)||selected.Card==nil||*selected.Card!=cribCard(5,0){
   t.Fatal("bot failed guaranteed 241-point pegging win",level,string(move))
  }
 }
 // Dealer's teammate owns the crib in partnerships; individual play does not.
 pair,_:=labyrinthVariantFor(4,"labyrinth-4p-partners")
 solo,_:=labyrinthVariantFor(4,"labyrinth-4p-individual")
 v.Seat=2;v.Dealer=0
 if !labyrinthBotOwnCrib(v,pair)||labyrinthBotOwnCrib(v,solo){
  t.Fatal("individual and partnership crib benefits incorrectly conflated")
 }
}

func TestBC23FullBotAndMixedHumanMatchesEveryFormat(t *testing.T){
 a:=labAdapter(t);policies:=NewLabyrinthCribbageBotPolicies()
 scenarios:=[]struct{variant string;levels []string}{
  {"labyrinth-2p",[]string{"easy","hard"}},
  {"labyrinth-3p",[]string{"medium","easy","hard"}},
  {"labyrinth-4p-partners",[]string{"hard","medium","easy","medium"}},
  {"labyrinth-4p-individual",[]string{"hard","medium","easy","hard"}},
 }
 for caseIndex,c:=range scenarios{
  t.Run(c.variant,func(t *testing.T){
   for _,mixHuman:=range []bool{false,true}{
    n:=len(c.levels)
    seats:=make([]ClassicSeat,n)
    format:="";if c.variant=="labyrinth-4p-individual"{format="individual"}
    for i,level:=range c.levels{
     seats[i]=ClassicSeat{Index:i,Controller:"bot",Difficulty:level,
      Team:classicRoomTeam("labyrinth-cribbage",n,i,format)}
    }
    if mixHuman{seats[0].Controller="human";seats[0].Difficulty=""
     seats[0].Subject="10000000-1111-4111-8111-111111111111"}
    seed:=labSeed(byte(91+caseIndex*5))
    room:=ClassicRoom{GameID:"labyrinth-cribbage",SeatCount:n}
    state,_,e:=a.InitialWithSeed(seed,room,seats);if e!=nil{t.Fatal("mixed seats invalid",e)}
    trace:=[]RuleTrace{}
    sawBot:=map[int]bool{};sawHuman:=false;sawShow:=false
    for step:=0;step<a.replayLimit();step++{
     f,e:=a.decode(state);if e!=nil{t.Fatal("frame",step,e)}
     if f.Terminal{
      if f.Winner==nil||f.Scores[*f.Winner]<241||len(trace)==0||!sawShow{
       t.Fatal("bot match failed to finish",n,trace,f)
      }
      if mixHuman&&!sawHuman{t.Fatal("human did not get a legal turn")}
      if len(sawBot)!=n-func()int{if mixHuman{return 1};return 0}(){
       t.Fatal("missing bot seat decisions",sawBot)
      }
      replay,e:=a.ReplayConfigured(seed,n,c.variant,trace)
      if e!=nil||!bytes.Equal(state,replay){t.Fatal("mixed autonomous game not replayable",e)}
      if c.variant=="labyrinth-4p-individual"{
       if _,e=a.Replay(seed,n,trace);e==nil{t.Fatal("individual was mis-replayed as partnership")}
      }
      t.Logf("%s human=%v, moves=%d, winner=%d, scores=%v",c.variant,mixHuman,len(trace),*f.Winner,f.Scores)
      return
     }
     legal,e:=a.LegalActions(state,f.Turn)
     if e!=nil||len(legal)==0{t.Fatal("no canonical legal moves",step,e)}
     chosen:=legal[0]
     if seats[f.Turn].Controller=="bot"{
      chosen=bc23Choice(t,a,state,seats[f.Turn].Difficulty,policies)
      sawBot[f.Turn]=true
     }else{sawHuman=true}
     next,_,_,_,e:=a.Apply(state,f.Turn,chosen);if e!=nil{t.Fatal("human/bot legal move rejected",e)}
     after,e:=a.decode(next);if e!=nil{t.Fatal(e)}
     d,e:=cribbageDecode(after);if e!=nil{t.Fatal(e)}
     if len(d.LastShow)>0{sawShow=true}
     trace=append(trace,RuleTrace{Sequence:int64(len(trace)+2),Seat:f.Turn,Action:chosen,
      BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
     state=next
    }
    t.Fatal("bot match hit bounded replay cap",c.variant,mixHuman)
   }
  })
 }
}
func TestBC23PolicyHasNoOpponentCardKnowledge(t *testing.T){
 a:=labAdapter(t);policies:=NewLabyrinthCribbageBotPolicies()
 state,e:=a.initial(labSeed(33),2);if e!=nil{t.Fatal(e)}
 frame,e:=a.decode(state);if e!=nil{t.Fatal(e)}
 view,e:=a.View(state,frame.Turn);if e!=nil{t.Fatal(e)}
 for _,term:=range []string{`"deck"`,`"seed"`,`"crib"`,`"kept"`,`"allHands"`} {
  if strings.Contains(string(view),term){t.Fatal("server leaked private state",term)}
 }
 legal,e:=a.LegalActions(state,frame.Turn);if e!=nil{t.Fatal(e)}
 policy,e:=policies.policy("hard");if e!=nil{t.Fatal(e)}
 before:=append([]byte{},view...)
 first,e:=policy.ChooseMove(view,"hard",legal,NewRuleBudget(100000));if e!=nil{t.Fatal(e)}
 second,e:=policy.ChooseMove(view,"hard",legal,NewRuleBudget(100000));if e!=nil{t.Fatal(e)}
 if !bytes.Equal(first,second)||!bytes.Equal(before,view){t.Fatal("model used non-public inputs or mutated view")}
}
