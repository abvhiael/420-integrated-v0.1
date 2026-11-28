package social

import (
 "encoding/json"
 "testing"
)

func TestCheckersFoundationProjection(t *testing.T){
 board:=make([]string,64)
 for i:=range board{if (i/8+i%8)%2==1{if i<24{board[i]="b"}else if i>=40{board[i]="r"}}}
 turn:="black"
 p:=CheckersProjection{Schema:CheckersStateProtocol,GameID:"checkers",RulesVersion:CheckersRulesVersion,Variant:CheckersVariant,Board:board,Phase:"active",Turn:&turn}
 raw,e:=json.Marshal(p);if e!=nil{t.Fatal(e)}
 if _,e:=DecodeCheckersProjection(raw);e!=nil{t.Fatal(e)}
 if !classicSeatsValid("checkers",2)||classicSeatsValid("checkers",3)||classicSeatsValid("checkers",4){t.Fatal("invalid Checkers registration")}
 for _,mutate:=range []func(*CheckersProjection){
  func(p *CheckersProjection){p.Schema="v2"},
  func(p *CheckersProjection){p.Revision=-1},
  func(p *CheckersProjection){p.Board=nil},
  func(p *CheckersProjection){p.Board[0]="b"},
  func(p *CheckersProjection){i:=40;p.Continuation=&i},
  func(p *CheckersProjection){p.Phase="finished"},
 }{
  var bad CheckersProjection
  if e:=json.Unmarshal(raw,&bad);e!=nil{t.Fatal(e)}
  mutate(&bad);data,_:=json.Marshal(bad)
  if _,e:=DecodeCheckersProjection(data);e==nil{t.Fatal("accepted malformed Checkers projection")}
 }
}
