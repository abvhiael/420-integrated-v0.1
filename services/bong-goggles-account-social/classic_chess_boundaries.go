package social

import (
 "encoding/json"
 "encoding/hex"
)

// Chess uses 2 integer units per point. Never infer a draw from an unfinished game.
func chessResultScores(winner *int) ([]int64,error) {
 if winner==nil{return []int64{1,1},nil}
 if *winner<0||*winner>1{return nil,ErrInvalid}
 scores:=[]int64{0,0};scores[*winner]=2;return scores,nil
}

// Only explicit lifecycle actions may bypass the active-seat restriction.
// Unknown fields and move payloads cannot be smuggled through this path.
func chessNonTurnAction(raw json.RawMessage)bool{
 var command struct{Type string `json:"type"`}
 if !strictRuleJSON(raw,&command){return false}
 return command.Type=="resign"||command.Type=="accept-draw"||command.Type=="reject-draw"
}

// Exact position identity: 64 four-bit pieces plus side, castling and legal
// en-passant file (0 means unavailable). No truncated hash collisions.
// Piece codes: empty 0, white 1..6, black 7..12.
type chessPositionIdentity [34]byte
func chessPositionKey(board [64]byte,turn,castle,ep byte)(chessPositionIdentity,error){
 var key chessPositionIdentity
 if turn>1||castle>15||ep>8{return key,ErrInvalid}
 for i,p:=range board{
  if p>12{return key,ErrInvalid}
  key[i/2]|=p<<uint((i%2)*4)
 }
 key[32]=turn|(castle<<1);key[33]=ep
 return key,nil
}
// At most 151 positions since the last irreversible move (75-move limit).
// Hex is stable JSON, 10,268 bytes maximum, below the chess data allowance.
// Caller resets on pawn move, capture or permanent loss of castling rights.
type chessRepetition struct{Positions string `json:"positions"`}
func (h chessRepetition) record(key chessPositionIdentity,reset bool)(chessRepetition,int,error){
 if !h.valid(){return h,0,ErrInvalid}
 if reset{h.Positions=""}
 if len(h.Positions)>=151*68{return h,0,ErrInvalid}
 encoded:=hex.EncodeToString(key[:]);h.Positions+=encoded
 count:=0
 for i:=0;i<len(h.Positions);i+=68{if h.Positions[i:i+68]==encoded{count++}}
 return h,count,nil
}
func (h chessRepetition) valid()bool{
 if len(h.Positions)%68!=0||len(h.Positions)>151*68{return false}
 decoded,e:=hex.DecodeString(h.Positions);if e!=nil||hex.EncodeToString(decoded)!=h.Positions{return false}
 for i:=0;i<len(decoded);i+=34{
  for _,v:=range decoded[i:i+32]{if v&15>12||v>>4>12{return false}}
  if decoded[i+32]>31||decoded[i+33]>8{return false}
 }
 return true
}

// All quantities are integer milliseconds. The authoritative transaction
// supplies elapsed time; this reducer never reads a wall clock or accepts a
// client timestamp. Only accepted moves add increment. The session journal
// must persist the server measurement before this can be used for live play.
type chessClock struct{
 Remaining [2]int64 `json:"remaining"`
 Increment int64 `json:"increment"`
 Timed bool `json:"timed"`
}
const chessMaxClockMillis int64=1<<50
func newChessClock(initial,increment int64)(chessClock,error){
 if initial<0||initial>3600000||increment<0||increment>30000||(initial==0&&increment!=0){return chessClock{},ErrInvalid}
 return chessClock{Remaining:[2]int64{initial,initial},Increment:increment,Timed:initial>0},nil
}
func (c chessClock) advance(active int,elapsed int64,acceptedMove,terminal bool)(chessClock,bool,error){
 if active<0||active>1||elapsed<0||c.Increment<0||c.Increment>30000{return c,false,ErrInvalid}
 for _,v:=range c.Remaining{if v<0||v>chessMaxClockMillis{return c,false,ErrInvalid}}
 if !c.Timed{
  if c.Remaining!=[2]int64{}||c.Increment!=0{return c,false,ErrInvalid}
  return c,false,nil
 }
 if elapsed>=c.Remaining[active]{c.Remaining[active]=0;return c,true,nil}
 c.Remaining[active]-=elapsed
 if acceptedMove&&!terminal{
  if c.Remaining[active]>chessMaxClockMillis-c.Increment{return c,false,ErrInvalid}
  c.Remaining[active]+=c.Increment
 }
 return c,false,nil
}

// Embeddable only in the compiled chess module; legacy games keep their
// original capacities. 1024 permits move/offer/claim forms of each legal move.
type chessRuleCapacity struct{}
func (chessRuleCapacity) ChessLegalCapacity()int{return 1024}
func (chessRuleCapacity) ChessDataCapacity()int{return 14336}
func (chessRuleCapacity) MaxReplayActions()int{return 20000}
