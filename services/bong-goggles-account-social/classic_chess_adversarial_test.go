package social

import (
 "bytes"
 "encoding/json"
 "testing"
 "time"
)

// Deterministic playouts use the actual policy and legal adapter at every ply;
// a short tactical opening provides a guaranteed complete AI checkmate for
// medium/hard while easy is exercised on every turn in independent playouts.
func TestBC37ChessPolicyAdversarialPlayout(t *testing.T){
 for _,level:=range []string{"easy","medium","hard"}{t.Run(level,func(t *testing.T){
  a,state:=bc321Adapter(t)
  policy,e:=NewChessBotPolicies().policy(level);if e!=nil{t.Fatal(e)}
  limit,_,_:=botLimits(level)
  trace:=[]RuleTrace{}
  for i:=0;i<24;i++{
   f,e:=a.decode(state);if e!=nil{t.Fatal(e)}
   if f.Terminal{break}
   opts,e:=a.LegalActions(state,f.Turn);if e!=nil{t.Fatal(e)}
   move,e:=a.ChooseMoveBounded(state,f.Turn,level,policy,limit,time.Time{});if e!=nil{t.Fatal(i,e)}
   legal:=false
   for _,candidate:=range opts{if bytes.Equal(candidate,move){legal=true;break}}
   if !legal{t.Fatal("policy returned an unlisted move",string(move))}
   before:=append([]byte(nil),state...)
   for _,bad:=range []string{`{"type":"move","uci":"a1a1"}`,`{"type":"move","uci":"e2e4","winner":0}`,`{"type":"move","uci":"e2e4","uci":"a1a1"}`}{
    if _,_,_,_,e=a.Apply(state,f.Turn,json.RawMessage(bad));e==nil{t.Fatal("malformed action accepted",bad)}
    if !bytes.Equal(before,state){t.Fatal("rejected action mutated state")}
   }
   next,_,done,winner,e:=a.Apply(state,f.Turn,move);if e!=nil{t.Fatal(i,e)}
   if e=a.ValidateSaved(next);e!=nil{t.Fatal("saved validation",e)}
   frame,e:=a.decode(next);if e!=nil{t.Fatal(e)}
   if done{
    want,e:=chessResultScores(winner);if e!=nil||frame.Scores[0]!=want[0]||frame.Scores[1]!=want[1]{t.Fatal("terminal scoring")}
   }else if frame.Scores[0]!=0||frame.Scores[1]!=0{t.Fatal("premature scoring")}
   trace=append(trace,RuleTrace{Sequence:int64(i+2),Seat:f.Turn,Action:move,BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
   state=next
  }
  replay,e:=a.Replay([32]byte{},2,trace);if e!=nil||!bytes.Equal(replay,state){t.Fatal("cold replay mismatch",e)}
  trace[len(trace)-1].AfterHash=RuleHash([]byte("tampered"))
  if _,e=a.Replay([32]byte{},2,trace);e==nil{t.Fatal("accepted corrupted trace")}
 })}
}
func TestBC37ChessCompleteAI(t *testing.T){
 for _,level:=range []string{"medium","hard"}{t.Run(level,func(t *testing.T){
  a,state:=bc321Adapter(t)
  for i,uci:=range []string{"f2f3","e7e5","g2g4"}{
   next,_,done,_,e:=a.Apply(state,i%2,chessAction("move",uci));if e!=nil||done{t.Fatal(i,e)};state=next
  }
  policy,_:=NewChessBotPolicies().policy(level)
  move,e:=a.ChooseMove(state,1,level,policy);if e!=nil{t.Fatal(e)}
  next,_,done,winner,e:=a.Apply(state,1,move)
  if e!=nil||!done||winner==nil||*winner!=1{t.Fatal("AI failed to complete mate",string(move),e)}
  frame,e:=a.decode(next);if e!=nil||frame.Scores[0]!=0||frame.Scores[1]!=2{t.Fatal("AI score",frame,e)}
  if _,e=a.ChooseMove(next,0,level,policy);e==nil{t.Fatal("terminal bot move")}
 })}
}
