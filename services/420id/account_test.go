package account

import (
 "database/sql"
 "errors"
 "strings"
 "testing"

)

func TestIdentifiersAndConfiguration(t *testing.T) {
 for i:=0;i<100;i++{id,e:=newID();if e!=nil||!validID(id){t.Fatalf("invalid random ID %q: %v",id,e)}}
 for _,bad:=range []string{"","0x"+strings.Repeat("a",40),"../bong-goggles","00000000-0000-0000-0000-000000000000"}{if validID(bad){t.Fatal("accepted invalid ID")}}
 db:=new(sql.DB)
 for _,bad:=range [][]string{nil,{"BongGoggles"},{"bong-goggles","bong-goggles"},{"../app"}}{if _,e:=NewStore(db,bad);!errors.Is(e,ErrInvalid){t.Fatal("accepted bad configuration",bad,e)}}
 apps:=[]string{"bong-goggles"};s,e:=NewStore(db,apps);if e!=nil{t.Fatal(e)};apps[0]="evil";if s.allowed("evil")||!s.allowed("bong-goggles"){t.Fatal("mutable app approval")}
}
