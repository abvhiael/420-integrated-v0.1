package social

import (
 "encoding/json"
 "testing"
)

type chessBoundaryFixture struct{chessRuleCapacity}
func(chessBoundaryFixture) Definition()RuleDefinition{return RuleDefinition{GameID:"chess",Version:"v9999",Specification:"test-only chess boundary fixture"}}
func(chessBoundaryFixture) Initial([32]byte,int,*RuleBudget)(RuleFrame,error){return RuleFrame{},ErrInvalid}
func(chessBoundaryFixture) Legal(RuleFrame,int,*RuleBudget)([]json.RawMessage,error){return nil,ErrInvalid}
func(chessBoundaryFixture) Step(RuleFrame,int,json.RawMessage,*RuleBudget)(RuleFrame,error){return RuleFrame{},ErrInvalid}
func(chessBoundaryFixture) Validate(RuleFrame)error{return nil}
func(chessBoundaryFixture) View(RuleFrame,int)(json.RawMessage,error){return nil,ErrInvalid}
func(chessBoundaryFixture) NonTurnLegal(_ RuleFrame,_ int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(1);e!=nil{return nil,e};return []json.RawMessage{json.RawMessage(`{"type":"resign"}`)},nil
}
func TestBC32ChessCapacity(t *testing.T){
 a,e:=NewRulesAdapter(chessBoundaryFixture{});if e!=nil{t.Fatal(e)}
 if a.legalCapacity()!=1024||a.dataCapacity()!=14336||a.replayLimit()!=20000{t.Fatal("chess capacity")}
 a.definition.GameID="cribbage"
 if a.legalCapacity()!=128||a.dataCapacity()!=8192||a.replayLimit()!=512{t.Fatal("legacy limits changed")}
 a.definition.GameID="chess"
 f:=RuleFrame{Turn:0,SeatCount:2}
 if actions,e:=a.legal(f,1);e!=nil||len(actions)!=1{t.Fatal("non-turn resignation",e)}
 if _,e:=a.legal(f,2);e==nil{t.Fatal("invalid actor")}
 f.Terminal=true
 if _,e:=a.legal(f,1);e==nil{t.Fatal("terminal accepted")}
}
func TestBC32ChessNonTurnWhitelist(t *testing.T){
 for _,s:=range []string{`{"type":"resign"}`,`{"type":"accept-draw"}`,`{"type":"reject-draw"}`}{if !chessNonTurnAction(json.RawMessage(s)){t.Fatal(s)}}
 for _,s:=range []string{`{"type":"move"}`,`{"type":"resign","move":"e2e4"}`,`{"type":"resign","type":"move"}`,`null`,`{}`}{if chessNonTurnAction(json.RawMessage(s)){t.Fatal(s)}}
}
func TestBC32ChessRepetitionAndScores(t *testing.T){
 var board [64]byte;board[0]=6;board[63]=12
 key,e:=chessPositionKey(board,0,0,0);if e!=nil{t.Fatal(e)}
 other,_:=chessPositionKey(board,1,0,0);if key==other{t.Fatal("turn omitted")}
 other,_=chessPositionKey(board,0,1,0);if key==other{t.Fatal("castling omitted")}
 other,_=chessPositionKey(board,0,0,1);if key==other{t.Fatal("en passant omitted")}
 var h chessRepetition
 for i:=1;i<=151;i++{var n int;h,n,e=h.record(key,false);if e!=nil||n!=i{t.Fatal(i,n,e)}}
 if !h.valid(){t.Fatal("maximum invalid")}
 if _,_,e=h.record(key,false);e==nil{t.Fatal("unbounded")}
 h,n,e:=h.record(key,true);if e!=nil||n!=1||len(h.Positions)!=68{t.Fatal("reset")}
 scores,e:=chessResultScores(nil);if e!=nil||scores[0]!=1||scores[1]!=1{t.Fatal("draw")}
 w:=1;scores,e=chessResultScores(&w);if e!=nil||scores[0]!=0||scores[1]!=2{t.Fatal("win")}
}
func TestBC32ChessClockBoundary(t *testing.T){
 c,e:=newChessClock(60000,1000);if e!=nil{t.Fatal(e)}
 next,flag,e:=c.advance(0,59999,true,false);if e!=nil||flag||next.Remaining!=[2]int64{1001,60000}{t.Fatal(next,flag,e)}
 for _,elapsed:=range []int64{60000,60001}{next,flag,e=c.advance(0,elapsed,true,false);if e!=nil||!flag||next.Remaining!=[2]int64{0,60000}{t.Fatal(next,flag,e)}}
 next,flag,e=c.advance(0,1000,true,true);if e!=nil||flag||next.Remaining[0]!=59000{t.Fatal("terminal increment")}
 if _,_,e=c.advance(0,-1,true,false);e==nil{t.Fatal("negative elapsed")}
 if c.Remaining!=[2]int64{60000,60000}{t.Fatal("original mutated")}
}
