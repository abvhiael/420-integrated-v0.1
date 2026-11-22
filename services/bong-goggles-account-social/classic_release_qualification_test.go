package social

import (
 "bytes"
 "encoding/json"
 "testing"
 "time"
)

// Seeded property coverage, not a Chess rules qualification: the module is
// confined to the test package and cannot activate production games.
func TestBC12DeterministicRulePropertyAndBoundedBotSimulation(t *testing.T){
 adapter:=bc07Adapter(t)
 policies,_,_,_:=bc08Policies()
 for i:=0;i<128;i++{
  var seed [32]byte
  for j:=range seed{seed[j]=byte(i*13+j*7)}
  initial,e:=adapter.initial(seed,2);if e!=nil{t.Fatal(i,e)}
  again,e:=adapter.initial(seed,2);if e!=nil||!bytes.Equal(initial,again){t.Fatal("seed replay drift",i,e)}
  state:=initial
  moves:=[]RuleTrace{}
  for turn:=0;turn<4;turn++{
   seat:=turn%2
   legal,e:=adapter.LegalActions(state,seat)
   if e!=nil||len(legal)!=2{t.Fatal("unexpected legal actions",i,turn,e)}
   choice:=legal[(i+turn)%len(legal)]
   next,_,_,_,e:=adapter.Apply(state,seat,choice)
   if e!=nil{t.Fatal("legal step",i,turn,e)}
   moves=append(moves,RuleTrace{Sequence:int64(turn+2),Seat:seat,
    Action:append(json.RawMessage(nil),choice...),BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
   state=next
  }
  recovered,e:=adapter.Replay(seed,2,moves)
  if e!=nil||!bytes.Equal(recovered,state){t.Fatal("deterministic 4-move replay divergence",i,e)}
  if _,_,_,_,e=adapter.Apply(state,0,json.RawMessage(`{"take":1}`));e==nil{
   t.Fatal("terminal match accepted extra move",i)
  }
  if i%16==0{
   for _,level:=range []string{"easy","medium","hard"}{
    match,e:=QualifyBotMatch(adapter,seed,[]string{level,level},policies)
    if e!=nil||len(match.Trace)!=4||len(match.Scores)!=2{t.Fatal("bot match did not terminate",level,e)}
   }
  }
 }
}
func TestBC12RuleAndViewFaultBudget(t *testing.T){
 adapter:=bc07Adapter(t)
 frame,e:=adapter.initial(bc07Seed(),2);if e!=nil{t.Fatal(e)}
 for _,bad:=range []string{
  `{"take":1,"winner":1}`,`{"take":100}`,`{"take":1,"take":2}`,
  `{"take":1,"wager":420}`,`{"take":"a"}`,`{"take":null}`}{
  if _,_,_,_,e=adapter.Apply(frame,0,json.RawMessage(bad));e==nil{t.Fatal("malformed/privileged action",bad)}
 }
 start:=time.Now()
 for i:=0;i<128;i++{
  if _,e=adapter.View(frame,i%2);e!=nil{t.Fatal("view isolation regression",e)}
 }
 if elapsed:=time.Since(start);elapsed>10*time.Second{t.Fatal("128 seat projections exceed 10s local budget",elapsed)}
}
