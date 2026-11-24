package social

import (
 "bytes"
 "encoding/json"
 "testing"
 "time"
)

func TestBC33ChessPolicies(t *testing.T){
 a,state:=bc321Adapter(t)
 policies:=NewChessBotPolicies()
 for _,level:=range []string{"easy","medium","hard"}{
  policy,e:=policies.policy(level);if e!=nil{t.Fatal(e)}
  limit,_,_:=botLimits(level)
  move,e:=a.ChooseMoveBounded(state,0,level,policy,limit,time.Time{});if e!=nil{t.Fatal(level,e)}
  again,e:=a.ChooseMoveBounded(state,0,level,policy,limit,time.Time{});if e!=nil||!bytes.Equal(move,again){t.Fatal(level,"nonrepeatable",e)}
  if _,_,_,_,e=a.Apply(state,0,move);e!=nil{t.Fatal(level,e)}
  if _,e=a.ChooseMove(state,1,level,policy);e==nil{t.Fatal("wrong seat")}
  view,e:=a.View(state,0);if e!=nil{t.Fatal(e)}
  opts,e:=a.LegalActions(state,0);if e!=nil{t.Fatal(e)}
  var object map[string]any
  if e=json.Unmarshal(view,&object);e!=nil{t.Fatal(e)}
  object["secretOpponent"]=123
  bad,_:=json.Marshal(object)
  if _,e=policy.ChooseMove(bad,level,opts,NewRuleBudget(limit));e==nil{t.Fatal("secret accepted")}
  if _,e=policy.ChooseMove(view,level,[]json.RawMessage{chessAction("move","e2e5")},NewRuleBudget(limit));e==nil{t.Fatal("illegal accepted")}
 }
}
func TestBC33ChessMate(t *testing.T){
 a,state:=bc321Adapter(t)
 for i,uci:=range []string{"f2f3","e7e5","g2g4"}{
  next,_,_,_,e:=a.Apply(state,i%2,chessAction("move",uci));if e!=nil{t.Fatal(e)};state=next
 }
 for _,level:=range []string{"medium","hard"}{
  policy,_:=NewChessBotPolicies().policy(level)
  move,e:=a.ChooseMove(state,1,level,policy);if e!=nil{t.Fatal(level,e)}
  var cmd chessCommand
  if !strictRuleJSON(move,&cmd)||cmd.UCI!="d8h4"{t.Fatal(level,string(move))}
  _,_,done,w,e:=a.Apply(state,1,move);if e!=nil||!done||w==nil||*w!=1{t.Fatal(level,e)}
 }
}
func TestBC33ChessReplay(t *testing.T){
 a,state:=bc321Adapter(t)
 trace:=[]RuleTrace{}
 policies:=NewChessBotPolicies()
 for i:=0;i<12;i++{
  f,e:=a.decode(state);if e!=nil{t.Fatal(e)};if f.Terminal{break}
  level:=[]string{"easy","medium","hard"}[i%3]
  policy,_:=policies.policy(level)
  limit,_,_:=botLimits(level)
  move,e:=a.ChooseMoveBounded(state,f.Turn,level,policy,limit,time.Time{});if e!=nil{t.Fatal(i,e)}
  next,_,_,_,e:=a.Apply(state,f.Turn,move);if e!=nil{t.Fatal(i,e)}
  trace=append(trace,RuleTrace{Sequence:int64(i+2),Seat:f.Turn,Action:move,BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
  state=next
 }
 replay,e:=a.Replay([32]byte{},2,trace);if e!=nil||!bytes.Equal(state,replay){t.Fatal("replay",e)}
}
