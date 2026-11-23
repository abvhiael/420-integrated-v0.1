package social

import ("testing")

func TestBC05RoomSeatLimitsAndTeams(t *testing.T){
 if len(classicSeatLimits)!=25{t.Fatalf("not 25 canonical games: %d",len(classicSeatLimits))}
 for id,rangeSeats:=range classicSeatLimits{
  for n:=0;n<7;n++{
   want:=n>=rangeSeats[0]&&n<=rangeSeats[1]
   if classicSeatsValid(id,n)!=want{t.Fatalf("invalid seat contract %s: %d",id,n)}
  }
 }
 if !classicSeatsValid("labyrinth-cribbage",2)||!classicSeatsValid("labyrinth-cribbage",4)||
 !classicSeatsValid("russian-cribbage",2)||classicSeatsValid("russian-cribbage",3){t.Fatal("BC-2.1 room compatibility or historical key admission")}
 if classicSeatsValid("cross-country-chaos",4)||classicSeatsValid("roulette",2)||classicSeatsValid("cribbage",5){t.Fatal("unsupported/off-chain or over-cap title")}
 for _,id:=range []string{"labyrinth-cribbage","kaiser","tarabish","euchre","spades","rook","deux-cents"}{
  if classicTeam(id,4,0)!=0||classicTeam(id,4,1)!=1||classicTeam(id,4,2)!=0||classicTeam(id,4,3)!=1{t.Fatal("partner teams wrong",id)}
 }
 if classicTeam("mahjong",4,2)!=2||classicTeam("cribbage",2,1)!=1||classicTeam("canasta",2,1)!=1{t.Fatal("solo game team changed")}
 if _,e:=NewClassicRooms(nil);e==nil{t.Fatal("nil store granted room authority")}
 if _,e:=NewClassicRooms(&Store{});e==nil{t.Fatal("nil database granted room authority")}
}
