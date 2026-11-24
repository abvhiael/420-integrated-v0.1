package social

import "encoding/json"

// Three-valued result: exhausting a finite graph proves impossibility;
// finding a legal mating sequence proves possibility. A resource limit is
// never evidence of impossibility (nor of a successful mating sequence).
type chessMateReachability uint8
const (
 chessMateUnknown chessMateReachability=iota
 chessMateImpossible
 chessMatePossible
)
const chessMateSearchLimit=4096

// These material exclusions are sound, including the one-sided cases
// where the opponent has only pieces that cannot assist a mating net.
func chessMaterialCannotMate(p chessBoard,seat int)bool{
 own,other:=0,0
 ownKnights,otherKnights,otherHeavy:=0,0,0
 ownBishops,otherBishops:=byte(0),byte(0)
 for i,v:=range p.Squares{
  k:=chessKind(v);if k=='.'||k=='K'{continue}
  bit:=byte(1<<uint((i/8+i%8)%2))
  if chessColor(v)==seat{
   own++
   switch k{case 'P','R','Q':return false;case 'N':ownKnights++;case 'B':ownBishops|=bit}
  }else{
   other++
   switch k{case 'N':otherKnights++;case 'B':otherBishops|=bit;default:otherHeavy++}
  }
 }
 if own==0{return true}
 if own==1&&other==0{return true}
 return ownKnights==0&&ownBishops!=3&&otherKnights==0&&otherHeavy==0&&(ownBishops|otherBishops)!=3
}
type chessReachKey struct{
 Squares [64]byte
 Turn int
 Castle byte
 EP int
}
// Cooperative search, not minimax: either player may cooperate to reach
// mate. Counters are omitted because this graph tests mating possibility
// under legal board moves, not a particular draw-claim strategy.
func chessMateReach(p chessBoard,seat,limit int)chessMateReachability{
 if seat<0||seat>1||limit<1{return chessMateUnknown}
 if chessMaterialCannotMate(p,seat){return chessMateImpossible}
 key:=func(q chessBoard)chessReachKey{return chessReachKey{q.Squares,q.Turn,q.Castle,q.EP}}
 seen:=map[chessReachKey]bool{key(p):true}
 queue:=[]chessBoard{p}
 for i:=0;i<len(queue);i++{
  q:=queue[i]
  moves:=q.legal()
  if len(moves)==0{
   if q.Turn==1-seat&&q.check(q.Turn){return chessMatePossible}
   continue
  }
  if chessMaterialCannotMate(q,seat){continue}
  for _,m:=range moves{
   next:=q.apply(m)
   k:=key(next);if seen[k]{continue}
   if len(seen)>=limit{return chessMateUnknown}
   seen[k]=true;queue=append(queue,next)
  }
 }
 return chessMateImpossible
}
// A locked pawn barrier can have a tiny finite reachable graph even with
// substantial material. Avoid searching unrestricted middlegames at every
// validation: only enter this proof path if no non-king move is initially
// available for either colour. Search still considers ALL subsequent moves.
func chessLockedCandidate(p chessBoard)bool{
 for _,v:=range p.Squares{if v!='.'&&chessKind(v)!='K'&&chessKind(v)!='P'{return false}}
 for seat:=0;seat<2;seat++{
  q:=p;q.Turn=seat;if seat!=p.Turn{q.EP=-1}
  for _,m:=range q.legal(){if chessKind(q.Squares[m.From])!='K'{return false}}
 }
 return true
}
func chessDeadPosition(p chessBoard)bool{
 if chessMaterialCannotMate(p,0)&&chessMaterialCannotMate(p,1){return true}
 // Forced continuations and locked pawn positions are evaluated by actual
 // reachability rather than a material-only shortcut.
 if !chessLockedCandidate(p)&&len(p.legal())>1{return false}
 return chessMateReach(p,0,chessMateSearchLimit)==chessMateImpossible&&chessMateReach(p,1,chessMateSearchLimit)==chessMateImpossible
}
func chessAdjudicateLoss(p chessBoard,loser int)(*int,error){
 if loser<0||loser>1{return nil,ErrInvalid}
 winner:=1-loser
 if chessMaterialCannotMate(p,winner){return nil,nil}
 if chessLockedCandidate(p)||len(p.legal())<=1{
  switch chessMateReach(p,winner,chessMateSearchLimit){case chessMateImpossible:return nil,nil;case chessMatePossible:return &winner,nil;default:return nil,ErrUnavailable}
 }
 // Outside certified material exclusions and restricted reachability,
 // require a legal witness before recording an irreversible win.
 if chessMateReach(p,winner,chessMateSearchLimit)==chessMatePossible{return &winner,nil}
 return nil,ErrUnavailable
}
// Server-only reducer. No client action is registered for flag fall. The
// caller supplies a trusted elapsed-time measurement and current clock;
// BC-3.2.4 will persist those inputs atomically in the session journal.
func (a *RulesAdapter) adjudicateChessFlag(raw json.RawMessage,clock chessClock,elapsed int64)(json.RawMessage,chessClock,error){
 if a==nil||a.definition.GameID!="chess"{return nil,clock,ErrInvalid}
 f,e:=a.decode(raw);if e!=nil{return nil,clock,e}
 if f.Terminal{return nil,clock,ErrForbidden}
 next,flag,e:=clock.advance(f.Turn,elapsed,false,false);if e!=nil{return nil,clock,e}
 if !clock.Timed||!flag{return nil,clock,ErrInvalid}
 d,e:=chessDecode(f);if e!=nil{return nil,clock,e}
 winner,e:=chessAdjudicateLoss(d.Board,f.Turn);if e!=nil{return nil,clock,e}
 loser:=f.Turn
 if e=chessFinish(&f,&d,"flag-fall",winner);e!=nil{return nil,clock,e}
 d.Loser=&loser
 f.Data,e=json.Marshal(d);if e!=nil{return nil,clock,e}
 out,e:=a.encode(f);if e!=nil{return nil,clock,e}
 return out,next,nil
}
