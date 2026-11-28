package social

import "encoding/json"

// CheckersStateProtocol identifies the CK-1.2 public projection, not a
// qualified rules module. The shared session registry remains authoritative.
const CheckersStateProtocol = "bg-checkers-state-v1"
const CheckersRulesVersion = "v1"
const CheckersVariant = "english-draughts"

type CheckersProjection struct {
 Schema string `json:"schema"`
 GameID string `json:"gameId"`
 RulesVersion string `json:"rulesVersion"`
 Variant string `json:"variant"`
 Revision int64 `json:"revision"`
 Board []string `json:"board"`
 Phase string `json:"phase"`
 Turn *string `json:"turn"`
 Winner *string `json:"winner"`
 Continuation *int `json:"continuation"`
}

// DecodeCheckersProjection validates the shape of the versioned public state.
// It does not establish legal reachability, authenticate a seat or authorize moves.
func DecodeCheckersProjection(raw json.RawMessage)(CheckersProjection,error){
 var p CheckersProjection
 var fields map[string]json.RawMessage
 if len(raw)>8192||!strictRuleJSON(raw,&p)||json.Unmarshal(raw,&fields)!=nil||len(fields)!=10{return p,ErrInvalid}
 for _,k:=range []string{"schema","gameId","rulesVersion","variant","revision","board","phase","turn","winner","continuation"}{if _,ok:=fields[k];!ok{return p,ErrInvalid}}
 if string(fields["revision"])=="null"||p.Schema!=CheckersStateProtocol||p.GameID!="checkers"||p.RulesVersion!=CheckersRulesVersion||p.Variant!=CheckersVariant||p.Revision<0||p.Revision>9007199254740991||len(p.Board)!=64{return p,ErrInvalid}
 var cells []json.RawMessage
 if json.Unmarshal(fields["board"],&cells)!=nil{return p,ErrInvalid}
 red,black:=0,0
 for i,c:=range p.Board{
  if string(cells[i])=="null"{return p,ErrInvalid}
  switch c{case "":continue;case "r","R":red++;case "b","B":black++;default:return p,ErrInvalid}
  if (i/8+i%8)%2!=1{return p,ErrInvalid}
 }
 if red>12||black>12{return p,ErrInvalid}
 color:=func(s *string)bool{return s!=nil&&(*s=="red"||*s=="black")}
 switch p.Phase{
 case "active":
  if !color(p.Turn)||p.Winner!=nil{return p,ErrInvalid}
  if p.Continuation!=nil{
   i:=*p.Continuation
   if i<0||i>=64{return p,ErrInvalid}
   c:=p.Board[i]
   if (*p.Turn=="red"&&c!="r"&&c!="R")||(*p.Turn=="black"&&c!="b"&&c!="B"){return p,ErrInvalid}
  }
 case "finished":
  if p.Turn!=nil||p.Continuation!=nil||(p.Winner!=nil&&!color(p.Winner)){return p,ErrInvalid}
 default:return p,ErrInvalid
 }
 return p,nil
}
