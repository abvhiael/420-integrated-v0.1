package social

import (
 "encoding/hex"
 "encoding/json"
 "strings"
)

const chessProductRuleset = "bc-chess-standard@1.0.0"
const chessRuleSpecification = chessProductRuleset+";orthodox;seat-0-white;seat-1-black;uci;san;exact-repetition;half-point-units;FIDE-2023"
type chessRules struct{chessRuleCapacity}
type chessRuleData struct{
 Board chessBoard `json:"board"`
 Repetition chessRepetition `json:"repetition"`
 LastMove string `json:"lastMove"`
 LastSAN string `json:"lastSAN"`
 Offer int `json:"offer"`
 Reason string `json:"reason"`
 Loser *int `json:"loser,omitempty"`
 ClaimMove string `json:"claimMove,omitempty"`
}
type chessCommand struct{
 Type string `json:"type"`
 UCI string `json:"uci,omitempty"`
}
// Identify the actual versioned Chess adapter, even when a fixture shares its
// catalogue identifier.
func isClassicChess(rule ClassicRule) bool {
 adapter,ok:=rule.(*RulesAdapter)
 if !ok||adapter==nil{return false}
 _,ok=adapter.module.(chessRules)
 return ok
}
func NewChessRulesAdapter()(*RulesAdapter,error){return NewRulesAdapter(chessRules{})}
func(chessRules) Definition()RuleDefinition{return RuleDefinition{GameID:"chess",Version:"v1.0",Specification:chessRuleSpecification}}
func(chessRules) ValidateSeats(room ClassicRoom,seats []ClassicSeat)error{
 if room.GameID!="chess"||room.SeatCount!=2||len(seats)!=2||seats[0].Index!=0||seats[1].Index!=1{return ErrInvalid}
 if seats[0].Controller=="human"&&seats[1].Controller=="human"&&seats[0].Subject==seats[1].Subject{return ErrInvalid}
 return nil
}
func(chessRules) Initial(_ [32]byte,count int,b *RuleBudget)(RuleFrame,error){
 if count!=2{return RuleFrame{},ErrInvalid}
 if e:=b.Charge(64);e!=nil{return RuleFrame{},e}
 d:=chessRuleData{Board:chessInitialBoard(),Offer:-1}
 key,e:=d.Board.identity();if e!=nil{return RuleFrame{},e}
 d.Repetition,_,e=d.Repetition.record(key,false);if e!=nil{return RuleFrame{},e}
 raw,e:=json.Marshal(d)
 return RuleFrame{SeatCount:2,Round:1,Phase:"play",Turn:0,Scores:[]int64{0,0},Data:raw},e
}
func chessDecode(f RuleFrame)(chessRuleData,error){
 var d chessRuleData
 if !strictRuleJSON(f.Data,&d){return d,ErrInvalid}
 return d,nil
}
func chessAction(kind,uci string)json.RawMessage{raw,_:=json.Marshal(chessCommand{kind,uci});return raw}
func chessOccurrences(h chessRepetition,key chessPositionIdentity)int{
 k:=hex.EncodeToString(key[:]);n:=0
 for i:=0;i+68<=len(h.Positions);i+=68{if h.Positions[i:i+68]==k{n++}}
 return n
}
func chessNext(d chessRuleData,m chessMove)(chessRuleData,int,error){
 old:=d.Board;d.LastMove=m.UCI();d.LastSAN=old.san(m);d.Board=old.apply(m);d.Offer=-1
 key,e:=d.Board.identity();if e!=nil{return d,0,e}
 h,n,e:=d.Repetition.record(key,d.Board.Half==0||old.Castle!=d.Board.Castle);d.Repetition=h
 return d,n,e
}
func chessFinish(f *RuleFrame,d *chessRuleData,reason string,winner *int)error{
 scores,e:=chessResultScores(winner);if e!=nil{return e}
 f.Terminal=true;f.Phase="finished";f.Turn=-1;f.Winner=winner;f.Scores=scores;d.Reason=reason;d.Offer=-1
 return nil
}
func chessAutomatic(p chessBoard,repeats int)(string,*int){
 if len(p.legal())==0{if p.check(p.Turn){w:=1-p.Turn;return "checkmate",&w};return "stalemate",nil}
 if chessDeadPosition(p){return "dead-position",nil}
 if repeats>=5{return "fivefold",nil}
 if p.Half>=150{return "75-move",nil}
 return "",nil
}
func chessClaim(d chessRuleData)bool{
 k,e:=d.Board.identity();return e==nil&&(d.Board.Half>=100||chessOccurrences(d.Repetition,k)>=3)
}
func chessLifecycle(d chessRuleData,seat int)[]json.RawMessage{
 out:=[]json.RawMessage{chessAction("resign","")}
 if d.Offer==1-seat{out=append(out,chessAction("accept-draw",""),chessAction("reject-draw",""))}
 return out
}
func(r chessRules) NonTurnLegal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(1);e!=nil{return nil,e}
 if f.Terminal||seat<0||seat>1||seat==f.Turn{return nil,ErrForbidden}
 if e:=r.Validate(f);e!=nil{return nil,e};d,e:=chessDecode(f);if e!=nil{return nil,e}
 return chessLifecycle(d,seat),nil
}
func(r chessRules) Legal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(128);e!=nil{return nil,e}
 if f.Terminal||seat<0||seat>1||seat!=f.Turn{return nil,ErrForbidden}
 if e:=r.Validate(f);e!=nil{return nil,e};d,e:=chessDecode(f);if e!=nil{return nil,e}
 out:=chessLifecycle(d,seat)
 if chessClaim(d){out=append(out,chessAction("claim-draw",""))}
 for _,m:=range d.Board.legal(){
  if e=b.Charge(8);e!=nil{return nil,e}
  out=append(out,chessAction("move",m.UCI()))
  // Both players must have moved before an agreement can conclude.
  if d.Board.Full>1||seat==1{out=append(out,chessAction("move-offer",m.UCI()))}
  // Intended move is evaluated without committing it.
  if d.Board.Half>=99||len(d.Repetition.Positions)>=4*68{
   old:=d.Board;q:=old.apply(m);key,err:=q.identity();if err!=nil{return nil,err}
   if q.Half>=100||(old.Castle==q.Castle&&q.Half!=0&&chessOccurrences(d.Repetition,key)>=2){
    out=append(out,chessAction("claim-draw",m.UCI()))
   }
  }
 }
 return out,nil
}
func(r chessRules) Step(f RuleFrame,seat int,raw json.RawMessage,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(128);e!=nil{return RuleFrame{},e}
 if f.Terminal||seat<0||seat>1{return RuleFrame{},ErrForbidden}
 var cmd chessCommand;if !strictRuleJSON(raw,&cmd){return RuleFrame{},ErrInvalid}
 d,e:=chessDecode(f);if e!=nil{return RuleFrame{},e}
 var allowed []json.RawMessage
 if seat==f.Turn{allowed,e=r.Legal(f,seat,b)}else{allowed,e=r.NonTurnLegal(f,seat,b)}
 if e!=nil{return RuleFrame{},e}
 chosen,e:=canonicalRuleAction(raw);if e!=nil{return RuleFrame{},e}
 found:=false
 for _,item:=range allowed{canon,_:=canonicalRuleAction(item);if string(canon)==string(chosen){found=true;break}}
 if !found{return RuleFrame{},ErrInvalid}
 switch cmd.Type{
 case "resign":
  winner,err:=chessAdjudicateLoss(d.Board,seat);if err!=nil{return RuleFrame{},err}
  d.Loser=&seat
  e=chessFinish(&f,&d,"resigned",winner)
 case "accept-draw":e=chessFinish(&f,&d,"agreement",nil)
 case "reject-draw":d.Offer=-1
 case "claim-draw":d.ClaimMove=cmd.UCI;e=chessFinish(&f,&d,"claimed-draw",nil)
 case "move","move-offer":
  for _,m:=range d.Board.legal(){if m.UCI()!=cmd.UCI{continue}
   var repeats int;d,repeats,e=chessNext(d,m);if e!=nil{return RuleFrame{},e}
   f.Turn=d.Board.Turn;f.Round=d.Board.Full
   if cmd.Type=="move-offer"{d.Offer=seat}
   reason,winner:=chessAutomatic(d.Board,repeats);if reason!=""{e=chessFinish(&f,&d,reason,winner)}
   break
  }
 default:return RuleFrame{},ErrInvalid
 }
 if e!=nil{return RuleFrame{},e}
 f.Data,e=json.Marshal(d);return f,e
}
func chessBoardValid(p chessBoard)bool{
 if p.Turn<0||p.Turn>1||p.Castle>15||p.EP< -1||p.EP>=64||p.Half<0||p.Half>150||p.Full<1||p.Full>10000{return false}
 kings,pawns,pieces:=[2]int{},[2]int{},[2]int{}
 for i,v:=range p.Squares{
  if v=='.'{continue};if !strings.ContainsRune("PNBRQKpnbrqk",rune(v)){return false};c:=chessColor(v);pieces[c]++
  if chessKind(v)=='K'{kings[c]++};if chessKind(v)=='P'{pawns[c]++;if i/8==0||i/8==7{return false}}
 }
 for c:=0;c<2;c++{if kings[c]!=1||pawns[c]>8||pieces[c]>16{return false}}
 for i,s:=range []int{7,0,63,56}{if p.Castle&(1<<uint(i))!=0{rook,king:=byte('R'),byte('K');home:=4;if i>=2{rook,king,home='r','k',60};if p.Squares[s]!=rook||p.Squares[home]!=king{return false}}}
 if p.EP>=0{
  rank,delta,pawn:=5,-8,byte('p');if p.Turn==1{rank,delta,pawn=2,8,'P'}
  if p.EP/8!=rank||p.Half!=0||p.Squares[p.EP]!='.'||p.Squares[p.EP+delta]!=pawn||p.Squares[p.EP-delta]!='.'{return false}
 }
 return !p.check(1-p.Turn)
}
func(chessRules) Validate(f RuleFrame)error{
 d,e:=chessDecode(f);if e!=nil{return e}
 p:=d.Board
 if f.SeatCount!=2||f.Variant!=""||len(f.Scores)!=2||f.Round!=p.Full||!chessBoardValid(p)||!d.Repetition.valid()||len(d.Repetition.Positions)<68||len(d.Repetition.Positions)/68>p.Half+1||d.Offer< -1||d.Offer>1{return ErrInvalid}
 k,e:=p.identity();if e!=nil||!strings.HasSuffix(d.Repetition.Positions,hex.EncodeToString(k[:])){return ErrInvalid}
 if len(d.LastMove)>5||len(d.LastSAN)>16||(d.LastMove=="")!=(d.LastSAN==""){return ErrInvalid}
 if d.LastMove==""&&p!=chessInitialBoard(){return ErrInvalid}
 if d.LastMove!=""{
  m:=d.LastMove
  if len(m)<4||m[0]<'a'||m[0]>'h'||m[2]<'a'||m[2]>'h'||m[1]<'1'||m[1]>'8'||m[3]<'1'||m[3]>'8'||(len(m)==5&&!strings.ContainsRune("qrbn",rune(m[4]))){return ErrInvalid}
 }
 reason,winner:=chessAutomatic(p,chessOccurrences(d.Repetition,k))
 if !f.Terminal{
  if d.Loser!=nil||d.ClaimMove!=""||f.Phase!="play"||f.Turn!=p.Turn||f.Winner!=nil||f.Scores[0]!=0||f.Scores[1]!=0||d.Reason!=""||reason!=""||(d.Offer!=-1&&d.Offer==p.Turn){return ErrInvalid}
 }else{
  if f.Phase!="finished"||f.Turn!=-1||d.Offer!=-1{return ErrInvalid}
  scores,e:=chessResultScores(f.Winner);if e!=nil||scores[0]!=f.Scores[0]||scores[1]!=f.Scores[1]{return ErrInvalid}
  if reason!=""{
   if d.Reason!=reason||(winner==nil)!=(f.Winner==nil)||(winner!=nil&&*winner!=*f.Winner){return ErrInvalid}
  }else{
   switch d.Reason{
   case "agreement":if f.Winner!=nil||d.Loser!=nil||d.ClaimMove!=""||p.Full<2{return ErrInvalid}
   case "claimed-draw":
    if f.Winner!=nil||d.Loser!=nil{return ErrInvalid}
    if d.ClaimMove==""{if !chessClaim(d){return ErrInvalid}}else{
     valid:=false
     for _,m:=range p.legal(){if m.UCI()!=d.ClaimMove{continue};q:=p.apply(m);key,err:=q.identity();if err!=nil{return err};valid=q.Half>=100||(p.Castle==q.Castle&&q.Half!=0&&chessOccurrences(d.Repetition,key)>=2)}
     if !valid{return ErrInvalid}
    }
   case "resigned","flag-fall":
    if d.Loser==nil||*d.Loser<0||*d.Loser>1||d.ClaimMove!=""||(d.Reason=="flag-fall"&&*d.Loser!=p.Turn){return ErrInvalid}
    w,err:=chessAdjudicateLoss(p,*d.Loser);if err!=nil||(w==nil)!=(f.Winner==nil)||(w!=nil&&*w!=*f.Winner){return ErrInvalid}
   default:return ErrInvalid
   }
  }
 }
 return nil
}
func(r chessRules) View(f RuleFrame,seat int)(json.RawMessage,error){
 if seat<0||seat>1{return nil,ErrForbidden}
 if e:=r.Validate(f);e!=nil{return nil,e};d,e:=chessDecode(f);if e!=nil{return nil,e}
 color:="white";if seat==1{color="black"}
 return json.Marshal(map[string]any{"gameId":"chess","ruleset":chessProductRuleset,"seat":seat,"color":color,"whiteSeat":0,"blackSeat":1,"board":string(d.Board.Squares[:]),"turn":f.Turn,"phase":f.Phase,"round":f.Round,"scores":f.Scores,"winner":f.Winner,"terminal":f.Terminal,"reason":d.Reason,"lastMove":d.LastMove,"lastSAN":d.LastSAN,"castling":d.Board.Castle,"enPassant":d.Board.EP,"halfmove":d.Board.Half,"check":d.Board.check(d.Board.Turn),"drawOffer":d.Offer})
}
var _ RuleModule=chessRules{}
var _ RuleSeatPolicy=chessRules{}
var _ RuleChessCapacity=chessRules{}
var _ RuleChessNonTurn=chessRules{}
var _ RuleReplayCapacity=chessRules{}
