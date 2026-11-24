package social

import (
 "crypto/sha256"
 "encoding/binary"
 "encoding/json"
 "sort"
 "fmt"
)

type chessBotPolicy struct{ level string }

func NewChessBotPolicies() ClassicBotPolicies {
 return ClassicBotPolicies{Easy:chessBotPolicy{"easy"},Medium:chessBotPolicy{"medium"},Hard:chessBotPolicy{"hard"}}
}

// Only the human-visible projection is accepted. No frame, seed, journal,
// credentials or opponent policy is available to the search.
type chessBotView struct {
 GameID string
 Ruleset string
 Seat int
 Color string
 WhiteSeat int
 BlackSeat int
 Board string
 Turn int
 Phase string
 Round int
 Scores []int64
 Winner *int
 Terminal bool
 Reason string
 LastMove string
 LastSAN string
 Castling byte
 EnPassant int
 Halfmove int
 Check bool
 DrawOffer int
 Timing *chessTimedState
}
func chessBotPosition(raw json.RawMessage)(chessBoard,error){
 var v chessBotView
 var p chessBoard
 if !strictRuleJSON(raw,&v)||v.GameID!="chess"||v.Ruleset!=chessProductRuleset||
 v.Seat<0||v.Seat>1||v.Turn!=v.Seat||v.Phase!="play"||v.Terminal||v.Winner!=nil||
 v.WhiteSeat!=0||v.BlackSeat!=1||len(v.Board)!=64||len(v.Scores)!=2||
 v.Scores[0]!=0||v.Scores[1]!=0||v.Reason!=""||v.DrawOffer< -1||v.DrawOffer>1||
 (v.Seat==0&&v.Color!="white")||(v.Seat==1&&v.Color!="black"){return p,ErrInvalid}
 copy(p.Squares[:],v.Board)
 p.Turn=v.Turn;p.Castle=v.Castling;p.EP=v.EnPassant;p.Half=v.Halfmove;p.Full=v.Round
 if !chessBoardValid(p)||p.check(p.Turn)!=v.Check{return p,ErrInvalid}
 return p,nil
}
func chessBotValue(k byte)int{
 switch chessKind(k){case 'P':return 100;case 'N':return 320;case 'B':return 330;case 'R':return 500;case 'Q':return 900}
 return 0
}
func chessBotAbs(n int)int{if n<0{return -n};return n}
func chessBotEval(p chessBoard)int{
 score:=0
 for i,k:=range p.Squares{
  c:=chessColor(k);if c<0{continue}
  center:=14-chessBotAbs(2*(i%8)-7)-chessBotAbs(2*(i/8)-7)
  value:=chessBotValue(k)
  switch chessKind(k){
  case 'N','B':value+=center*3
  case 'P':rank:=i/8;if c==1{rank=7-rank};value+=rank*7+center
  case 'Q','R':value+=center
  }
  if c==p.Turn{score+=value}else{score-=value}
 }
 return score
}
func chessBotOrder(p chessBoard,moves []chessMove){
 sort.SliceStable(moves,func(i,j int)bool{
  value:=func(m chessMove)int{
   n:=10*chessBotValue(p.Squares[m.To])+10*chessBotValue(m.Promotion)
   if m.Special=='e'{n+=1000}
   if n>0{n-=chessBotValue(p.Squares[m.From])}
   return n
  }
  return value(moves[i])>value(moves[j])
 })
}
// Fixed node limits keep both deterministic invocations independent of
// wall-clock scheduling. The shared budget still enforces its deadline.
func chessBotSearch(p chessBoard,depth,ply,alpha,beta int,nodes *int,b *RuleBudget)(int,bool){
 if *nodes<=0||b.Charge(1)!=nil{return 0,false}
 *nodes--
 var moves []chessMove
 if depth==0{moves=p.legalLimited(true)}else{moves=p.legal()}
 if len(moves)==0{if p.check(p.Turn){return -100000+ply,true};return 0,true}
 if chessDeadPosition(p)||p.Half>=150{return 0,true}
 if depth==0{return chessBotEval(p),true}
 chessBotOrder(p,moves)
 best:=-100001
 for _,m:=range moves{
  v,ok:=chessBotSearch(p.apply(m),depth-1,ply+1,-beta,-alpha,nodes,b)
  if !ok{return 0,false};v=-v
  if v>best{best=v};if v>alpha{alpha=v};if alpha>=beta{break}
 }
 return best,true
}
func (policy chessBotPolicy)ChooseMove(raw json.RawMessage,level string,legal []json.RawMessage,b *RuleBudget)(json.RawMessage,error){
 if level!=policy.level||(level!="easy"&&level!="medium"&&level!="hard")||len(legal)==0||len(legal)>1024{return nil,ErrInvalid}
 if e:=b.Charge(1);e!=nil{return nil,e}
 p,e:=chessBotPosition(raw);if e!=nil{return nil,e}
 moves:=p.legal()
 allowed:=map[string]chessMove{};for _,m:=range moves{allowed[m.UCI()]=m}
 candidates:=[]chessMove{};actions:=map[string]json.RawMessage{}
 var draw json.RawMessage
 for _,a:=range legal{
  var cmd chessCommand
  if !strictRuleJSON(a,&cmd){return nil,ErrInvalid}
  switch cmd.Type{
  case "move","move-offer","claim-draw":
   if cmd.Type=="claim-draw"&&cmd.UCI==""{draw=a;continue}
   m,ok:=allowed[cmd.UCI];if !ok{return nil,ErrInvalid}
   if cmd.Type=="claim-draw"{draw=a;continue}
   if cmd.Type=="move"{if actions[cmd.UCI]!=nil{return nil,ErrInvalid};actions[cmd.UCI]=a;candidates=append(candidates,m)}
  case "accept-draw":if cmd.UCI!=""{return nil,ErrInvalid};draw=a
  case "reject-draw","resign":if cmd.UCI!=""{return nil,ErrInvalid}
  default:return nil,ErrInvalid
  }
 }
 if len(candidates)==0{return nil,ErrUnavailable}
 result:=func(m chessMove)json.RawMessage{return append(json.RawMessage(nil),actions[m.UCI()]...)}
 if level=="easy"{h:=sha256.Sum256([]byte(p.Squares[:]));return result(candidates[binary.BigEndian.Uint64(h[:8])%uint64(len(candidates))]),nil}
 chessBotOrder(p,candidates)
 chosen:=candidates[0];best:=-100001
 maxDepth,nodes:=2,1200
 if level=="hard"{maxDepth,nodes=4,4500}
 // Only completed iterations can change the selection. Incomplete deeper
 // searches leave the previous legal result intact.
 for depth:=1;depth<=maxDepth;depth++{
  roundBest:=-100001;roundMove:=chosen;complete:=true
  for _,m:=range candidates{
   v,ok:=chessBotSearch(p.apply(m),depth-1,1,-100001,-roundBest,&nodes,b)
   if !ok{complete=false;break};v=-v
   if v>roundBest{roundBest=v;roundMove=m}
  }
  if !complete{
   if b.expired(){return nil,fmt.Errorf("%w: chess search deadline",ErrUnavailable)}
   break
  };chosen,best=roundMove,roundBest
  if best>99000{break}
 }
 if b.expired(){return nil,fmt.Errorf("%w: chess search deadline",ErrUnavailable)}
 if draw!=nil&&best< -150&&best> -100001{return append(json.RawMessage(nil),draw...),nil}
 return result(chosen),nil
}
var _ RuleDecisionPolicy=chessBotPolicy{}
