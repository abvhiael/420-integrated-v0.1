package social

import (
 "bytes"
 "encoding/json"
 "testing"
)

func bc321Adapter(t *testing.T)(*RulesAdapter,json.RawMessage){
 t.Helper();a,e:=NewChessRulesAdapter();if e!=nil{t.Fatal(e)}
 state,e:=a.initial([32]byte{},2);if e!=nil{t.Fatal(e)}
 return a,state
}
func TestBC321ChessAdapter(t *testing.T){
 a,state:=bc321Adapter(t)
 v,h:=a.Identity();if v!="v1.0"||len(h)!=64||a.Manifest().Specification!=chessRuleSpecification{t.Fatal("identity")}
 if _,e:=a.initial([32]byte{},3);e==nil{t.Fatal("three seats")}
 opts,e:=a.LegalActions(state,0);if e!=nil{t.Fatal(e)}
 moves:=0;for _,raw:=range opts{var cmd chessCommand;if !strictRuleJSON(raw,&cmd){t.Fatal(raw)};if cmd.Type=="move"{moves++}}
 if moves!=20{t.Fatal("starting legal moves",moves)}
 for _,raw:=range []string{`{"type":"move","uci":"e2e5"}`,`{"type":"move","uci":"e2e4","score":2}`,`{"type":"move","uci":"e2e4","uci":"e2e3"}`}{if _,_,_,_,e=a.Apply(state,0,json.RawMessage(raw));e==nil{t.Fatal("accepted",raw)}}
 if _,_,_,_,e=a.Apply(state,1,chessAction("move","e7e5"));e==nil{t.Fatal("out of turn")}
 next,turn,done,_,e:=a.Apply(state,0,chessAction("move","e2e4"));if e!=nil||turn!=1||done{t.Fatal(turn,done,e)}
 f,e:=a.decode(next);if e!=nil{t.Fatal(e)};d,e:=chessDecode(f);if e!=nil||d.Board.Squares[28]!='P'||d.Board.Squares[12]!='.'||d.LastSAN!="e4"||d.Board.EP!=20{t.Fatal(d,e)}
 for seat:=0;seat<2;seat++{view,e:=a.View(next,seat);if e!=nil||bytes.Contains(view,[]byte("repetition"))||bytes.Contains(view,[]byte("seed")){t.Fatal(string(view),e)}}
 if _,e:=a.View(next,2);e==nil{t.Fatal("invalid viewer")}
 f.Scores[0]=2;bad,_:=json.Marshal(f);if a.ValidateSaved(bad)==nil{t.Fatal("forged score")}
 f.Scores[0]=0;d.Board.Castle=255;f.Data,_=json.Marshal(d);bad,_=json.Marshal(f);if a.ValidateSaved(bad)==nil{t.Fatal("invalid board")}
}
func TestBC321ChessReplayAndTerminal(t *testing.T){
 a,state:=bc321Adapter(t);trace:=[]RuleTrace{}
 for i,uci:=range []string{"f2f3","e7e5","g2g4","d8h4"}{
  move:=chessAction("move",uci)
  next,_,done,winner,e:=a.Apply(state,i%2,move);if e!=nil{t.Fatal(i,e)}
  trace=append(trace,RuleTrace{Sequence:int64(i+2),Seat:i%2,Action:move,BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
  if i==3{if !done||winner==nil||*winner!=1{t.Fatal("mate")}}else if done{t.Fatal("early finish")}
  state=next
 }
 f,e:=a.decode(state);if e!=nil||f.Scores[0]!=0||f.Scores[1]!=2{t.Fatal(f,e)}
 d,e:=chessDecode(f);if e!=nil||d.LastSAN!="Qh4#"||d.Reason!="checkmate"{t.Fatal(d,e)}
 if _,_,_,_,e=a.Apply(state,0,chessAction("resign",""));e==nil{t.Fatal("terminal mutation")}
 replay,e:=a.Replay([32]byte{},2,trace);if e!=nil||!bytes.Equal(replay,state){t.Fatal("replay",e)}
 trace[1].AfterHash="forged";if _,e=a.Replay([32]byte{},2,trace);e==nil{t.Fatal("corrupt trace")}
}
func TestBC321ChessNonTurnLifecycle(t *testing.T){
 a,state:=bc321Adapter(t)
 next,_,done,winner,e:=a.Apply(state,1,chessAction("resign",""));if e!=nil||!done||winner==nil||*winner!=0{t.Fatal(done,winner,e)}
 if a.ValidateSaved(next)!=nil{t.Fatal("resigned invalid")}
 if _,_,_,_,e=a.Apply(state,1,chessAction("accept-draw",""));e==nil{t.Fatal("no offer")}
 state,_,_,_,e=a.Apply(state,0,chessAction("move","e2e4"));if e!=nil{t.Fatal(e)}
 state,_,_,_,e=a.Apply(state,1,chessAction("move-offer","e7e5"));if e!=nil{t.Fatal(e)}
 if _,_,_,_,e=a.Apply(state,1,chessAction("accept-draw",""));e==nil{t.Fatal("own offer")}
 next,_,done,winner,e=a.Apply(state,0,chessAction("accept-draw",""));if e!=nil||!done||winner!=nil{t.Fatal(done,winner,e)}
 f,e:=a.decode(next);if e!=nil||f.Scores[0]!=1||f.Scores[1]!=1{t.Fatal(f,e)}
}
func TestBC321ChessPerft(t *testing.T){
 var perft func(chessBoard,int)int
 perft=func(p chessBoard,d int)int{if d==0{return 1};n:=0;for _,m:=range p.legal(){n+=perft(p.apply(m),d-1)};return n}
 for i,want:=range []int{20,400,8902,197281}{if n:=perft(chessInitialBoard(),i+1);n!=want{t.Fatalf("depth %d got %d want %d",i+1,n,want)}}
}
