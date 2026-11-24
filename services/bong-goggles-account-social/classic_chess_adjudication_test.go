package social

import (
 "encoding/json"
 "testing"
)

func bc322Position(white,black map[int]byte,turn,half int)chessBoard{
 p:=chessBoard{Turn:turn,EP:-1,Half:half,Full:100}
 for i:=range p.Squares{p.Squares[i]='.'}
 for i,v:=range white{p.Squares[i]=v}
 for i,v:=range black{p.Squares[i]=v}
 return p
}
func TestBC322OpeningMatingWitnesses(t *testing.T){
 for seat:=0;seat<2;seat++{
  p:=chessInitialBoard()
  if !chessOpeningMateWitness(p,seat){t.Fatalf("opening witness for %d",seat)}
  winner,e:=chessAdjudicateLoss(p,1-seat);if e!=nil||winner==nil||*winner!=seat{t.Fatal(winner,e)}
 }
}
func TestBC322DeadAndMatePrecedence(t *testing.T){
 mate:=bc322Position(map[int]byte{46:'K',54:'Q'},map[int]byte{63:'k'},1,150)
 reason,w:=chessAutomatic(mate,5);if reason!="checkmate"||w==nil||*w!=0{t.Fatal(reason,w)}
 stale:=bc322Position(map[int]byte{46:'K',53:'Q'},map[int]byte{63:'k'},1,0)
 reason,w=chessAutomatic(stale,1);if reason!="stalemate"||w!=nil{t.Fatal(reason,w)}
 bare:=bc322Position(map[int]byte{0:'K'},map[int]byte{63:'k'},0,0)
 if !chessDeadPosition(bare){t.Fatal("bare kings")}
 twoKnights:=bc322Position(map[int]byte{46:'K',45:'N',53:'N'},map[int]byte{63:'k'},0,0)
 if chessMaterialCannotMate(twoKnights,0){t.Fatal("two knights can mate")}
 sameBishops:=bc322Position(map[int]byte{0:'K',2:'B'},map[int]byte{63:'k',61:'b'},0,0)
 if !chessDeadPosition(sameBishops){t.Fatal("same-color bishop complex")}
}
func TestBC322LockedPawnBarrier(t *testing.T){
 p:=bc322Position(map[int]byte{0:'K'},map[int]byte{63:'k'},0,0)
 // Alternating interlocked files: no capture or pawn advance is possible,
 // and neither king can cross the opposing pawn attack barrier.
 for f:=0;f<8;f++{if f%2==0{p.Squares[24+f]='P';p.Squares[32+f]='p'}else{p.Squares[16+f]='P';p.Squares[24+f]='p'}}
 if !chessBoardValid(p){t.Fatal("invalid fixture")}
 // Test the actual graph, not just the candidate predicate. If this
 // particular formation opens, it must not be certified dead.
 for seat:=0;seat<2;seat++{
  got:=chessMateReach(p,seat,1)
  if got==chessMateImpossible&&!chessMaterialCannotMate(p,seat){t.Fatal("cutoff treated as exhaustion")}
 }
}
func TestBC322RepetitionClaims(t *testing.T){
 a,state:=bc321Adapter(t)
 if _,_,_,_,e:=a.Apply(state,0,chessAction("claim-draw",""));e==nil{t.Fatal("premature claim")}
 cycle:=[]string{"g1f3","g8f6","f3g1","f6g8"}
 var e error
 for i:=0;i<7;i++{state,_,_,_,e=a.Apply(state,i%2,chessAction("move",cycle[i%4]));if e!=nil{t.Fatal(i,e)}}
 f,e:=a.decode(state);if e!=nil{t.Fatal(e)};before,e:=chessDecode(f);if e!=nil{t.Fatal(e)}
 claim,_,done,w,e:=a.Apply(state,1,chessAction("claim-draw","f6g8"));if e!=nil||!done||w!=nil{t.Fatal(done,w,e)}
 f,e=a.decode(claim);if e!=nil{t.Fatal(e)};after,e:=chessDecode(f);if e!=nil||before.Board!=after.Board||after.ClaimMove!="f6g8"{t.Fatal("intended move committed",e)}
 for i:=7;i<16;i++{var done bool;state,_,done,w,e=a.Apply(state,i%2,chessAction("move",cycle[i%4]));if e!=nil||done!=(i==15)||w!=nil{t.Fatal(i,done,w,e)}}
 f,e=a.decode(state);if e!=nil{t.Fatal(e)};after,e=chessDecode(f);if e!=nil||after.Reason!="fivefold"{t.Fatal(after.Reason,e)}
}
func TestBC322FlagAuthority(t *testing.T){
 a,state:=bc321Adapter(t)
 c,e:=newChessClock(60000,0);if e!=nil{t.Fatal(e)}
 if _,_,e=a.adjudicateChessFlag(state,c,59999);e==nil{t.Fatal("early flag")}
 if _,_,_,_,e=a.Apply(state,0,json.RawMessage(`{"type":"flag-fall"}`));e==nil{t.Fatal("client flag")}
 out,next,e:=a.adjudicateChessFlag(state,c,60000);if e!=nil||next.Remaining[0]!=0{t.Fatal(next,e)}
 f,e:=a.decode(out);if e!=nil||!f.Terminal||f.Winner==nil||*f.Winner!=1{t.Fatal(f,e)}
 if _,_,e=a.adjudicateChessFlag(out,next,60001);e==nil{t.Fatal("duplicate flag")}
}
