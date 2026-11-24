package social

import (
 "encoding/json"
 "sort"
)

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
const chessMateWitnessLimit=12000

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
// Search for an actual cooperative mate with a deterministic beam ordered
// by proximity to the target king, checks and restricted escape squares.
// Unlike breadth-first enumeration, this reaches deep witnesses without
// retaining an exponentially growing frontier. Failure is not a proof.
func chessMateWitness(p chessBoard,seat int)bool{
 type candidate struct{board chessBoard;score int;order int}
 abs:=func(n int)int{if n<0{return -n};return n}
 score:=func(q chessBoard)int{
  king:=byte('k');if seat==1{king='K'}
  target:=0;for i,v:=range q.Squares{if v==king{target=i;break}}
  file,rank:=target%8,target/8
  edge:=file;if 7-file<edge{edge=7-file};if rank<edge{edge=rank};if 7-rank<edge{edge=7-rank}
  n:=-edge*12
  for _,d:=range chessAllDirs{t:=chessSquare(file+d[0],rank+d[1]);if t<0||q.attacked(t,seat){n+=8}}
  if q.check(1-seat){n+=25}
  for i,v:=range q.Squares{if chessColor(v)!=seat{continue};switch chessKind(v){
   case 'Q','R':n+=35-2*(abs(i%8-file)+abs(i/8-rank))
   case 'N','B':n+=15-abs(i%8-file)-abs(i/8-rank)
   case 'P':advance:=i/8;if seat==1{advance=7-advance};n+=advance*3
   case 'K':n-=abs(i%8-file)+abs(i/8-rank)
  }}
  return n
 }
 key:=func(q chessBoard)chessReachKey{return chessReachKey{q.Squares,q.Turn,q.Castle,q.EP}}
 seen:=map[chessReachKey]bool{key(p):true}
 frontier:=[]candidate{{board:p}}
 expanded:=0
 for depth:=0;depth<48&&len(frontier)>0&&expanded<chessMateWitnessLimit;depth++{
  next:=[]candidate{}
  for _,c:=range frontier{
   if expanded>=chessMateWitnessLimit{break};expanded++
   q:=c.board
   moves:=q.legal()
   if len(moves)==0{if q.Turn==1-seat&&q.check(q.Turn){return true};continue}
   if chessMaterialCannotMate(q,seat){continue}
   for _,m:=range moves{
    v:=q.apply(m);k:=key(v);if seen[k]{continue};seen[k]=true
    if v.Turn==1-seat&&v.check(v.Turn)&&len(v.legal())==0{return true}
    next=append(next,candidate{v,score(v),len(next)})
   }
  }
  sort.SliceStable(next,func(i,j int)bool{return next[i].score>next[j].score})
  if len(next)>32{next=next[:32]};frontier=next
 }
 return false
}
// Opening lines are constructive certificates, including their legal prefixes.
var chessOpeningMates = [2][][]string{
 {
  {"e2e4","f7f6","d2d4","g7g5","d1h5"},
  {"e2e4","e7e5","f1c4","a7a6","d1h5","a6a5","h5f7"},
  {"d2d4","d7d5","b1c3","h7h6","e2e4","d5e4","f1c4","a7a6","d1h5","a6a5","h5f7"},
  // Queen's Gambit Declined, including the former cutoff after 6.Nf3.
  {"d2d4","d7d5","c2c4","e7e6","b1c3","g8f6","c1g5","f8e7","e2e3","e8g8","g1f3",
   "f6g4","d1d3","g8h8","d3g6","f7f5","g6h7","h8h7","f3h4","g7g6","g5f6","h7h6",
   "f2f3","h6h5","a1d1","f5f4","f3g4","h5h6","g4g5","h6h5","f1e2","h5h4","a2a4",
   "a7a6","g2g3","h4h3","e2f1","h3g4","f1e2","f4f3","h2h3","g4h5","e2f3"},
 },
 {
  {"f2f3","e7e5","g2g4","d8h4"},
  {"e2e4","e7e5","h2h3","f8c5","a2a3","d8h4","a3a4","h4f2"},
 },
}

func chessOpeningMateWitness(p chessBoard,seat int)bool{
 if seat<0||seat>1{return false}
 for _,line:=range chessOpeningMates[seat]{
  position:=chessInitialBoard()
  matched:=position==p
  for _,uci:=range line{
   found:=false
   for _,m:=range position.legal(){
    if m.UCI()==uci{position=position.apply(m);found=true;break}
   }
   if !found{break}
   matched=matched||position==p
  }
  if matched&&position.Turn==1-seat&&position.check(position.Turn)&&len(position.legal())==0{return true}
 }
 return false
}
func chessAdjudicateLoss(p chessBoard,loser int)(*int,error){
 if loser<0||loser>1{return nil,ErrInvalid}
 winner:=1-loser
 if chessMaterialCannotMate(p,winner){return nil,nil}
 if chessOpeningMateWitness(p,winner){return &winner,nil}
 if chessLockedCandidate(p)||len(p.legal())<=1{
  switch chessMateReach(p,winner,chessMateSearchLimit){case chessMateImpossible:return nil,nil;case chessMatePossible:return &winner,nil}
  if chessMateWitness(p,winner){return &winner,nil};return nil,ErrUnavailable
 }
 // Outside certified material exclusions and restricted reachability,
 // require a legal witness before recording an irreversible win.
 if chessMateWitness(p,winner)||chessMateReach(p,winner,chessMateSearchLimit)==chessMatePossible{return &winner,nil}
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
