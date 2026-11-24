package social

import (
 "bytes"
 "errors"
 "strings"
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

func TestBC33ComparativeStrength(t *testing.T){
 // Compare actual policies on a deterministic opening suite. Independent
 // deeper reference search scores each selected move, not policy metadata.
 a,state:=bc321Adapter(t)
 totals:=map[string]int{}
 for i,uci:=range []string{"e2e4","e7e5","g1f3","b8c6","f1c4","g8f6","d2d3","f8c5"}{
  f,e:=a.decode(state);if e!=nil{t.Fatal(e)}
  d,e:=chessDecode(f);if e!=nil{t.Fatal(e)}
  for _,level:=range []string{"easy","medium","hard"}{
   policy,_:=NewChessBotPolicies().policy(level)
   limit,_,_:=botLimits(level)
   raw,e:=a.ChooseMoveBounded(state,f.Turn,level,policy,limit,time.Time{});if e!=nil{t.Fatal(e)}
   var cmd chessCommand;if !strictRuleJSON(raw,&cmd){t.Fatal(string(raw))}
   found:=false
   for _,m:=range d.Board.legal(){if m.UCI()!=cmd.UCI{continue};found=true
    nodes:=40000
    score,ok:=chessBotSearch(d.Board.apply(m),2,1,-100001,100001,&nodes,NewRuleBudget(100000))
    if !ok{t.Fatal("reference budget")};totals[level]-=score
   }
   if !found{t.Fatal("non-board action in opening",cmd)}
  }
  next,_,_,_,e:=a.Apply(state,i%2,chessAction("move",uci));if e!=nil{t.Fatal(e)};state=next
 }
 t.Logf("opening suite reference scores: %+v",totals)
 if totals["medium"]<=totals["easy"]||totals["hard"]<=totals["medium"]{t.Fatal("difficulty ordering not established",totals)}
}

func TestBC33DeadlineAndDeterministicBudget(t *testing.T){
 a,state:=bc321Adapter(t)
 policy:=NewChessBotPolicies().Hard
 for _,limit:=range []int{1,20,100,100000}{
  first,e:=a.ChooseMoveBounded(state,0,"hard",policy,limit,time.Time{});if e!=nil{t.Fatal(limit,e)}
  second,e:=a.ChooseMoveBounded(state,0,"hard",policy,limit,time.Time{});if e!=nil||!bytes.Equal(first,second){t.Fatal(limit,e)}
 }
 _,e:=a.ChooseMoveBounded(state,0,"hard",policy,100000,time.Now().Add(-time.Second))
 if !errors.Is(e,ErrUnavailable)||!strings.Contains(e.Error(),"deadline"){t.Fatal("missing deadline diagnosis",e)}
}
func TestBC33LegalExistenceMatchesFullGenerator(t *testing.T){
 p:=chessInitialBoard()
 for i:=0;i<300;i++{
  all:=p.legal();first:=p.legalLimited(true)
  if (len(all)==0)!=(len(first)==0){t.Fatal("terminal mismatch",i)}
  if len(all)==0{p=chessInitialBoard();continue}
  if first[0]!=all[0]{t.Fatal("move ordering mismatch",i)}
  p=p.apply(all[(i*17+3)%len(all)])
 }
}
