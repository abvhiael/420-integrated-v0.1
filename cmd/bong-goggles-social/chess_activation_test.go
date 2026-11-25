package main

import (
 "testing"
 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

func TestBC33OperatorActivationPreservesCribbageAndFailsClosed(t *testing.T){
 if e:=configureChess("",nil,false,false,false);e!=nil{t.Fatal(e)}
 if e:=configureChess("disabled",nil,false,false,false);e!=nil{t.Fatal(e)}
 if e:=configureChess("public-play",nil,true,true,true);e==nil{t.Fatal("public mode accepted missing authority")}
 if e:=configureChess("restricted-acceptance",nil,true,true,true);e==nil{t.Fatal("missing authority")}
 s:=&social.ClassicSessions{Store:&social.Store{},Rooms:&social.ClassicRooms{}}
 if e:=configureCribbage("restricted-acceptance",s,true,true,true);e!=nil{t.Fatal(e)}
 baseline:=s.Rules("cribbage")
 original:=s.Bots["cribbage"]
 for _,dependency:=range [][3]bool{{false,true,true},{true,false,true},{true,true,false}}{
  if e:=configureChess("public-play",s,dependency[0],dependency[1],dependency[2]);e==nil{
   t.Fatal("accepted missing prerequisite",dependency)
  }
  if s.Rules("chess")!=nil||len(s.Bots)!=1{t.Fatal("partial activation")}
 }
 if e:=configureChess("public-play",s,true,true,true);e!=nil{t.Fatal(e)}
 if s.Rules("labyrinth-cribbage")!=nil||s.Rules("russian-cribbage")!=nil{t.Fatal("unqualified rules leaked")}
 if s.Rules("cribbage")!=baseline{t.Fatal("existing Cribbage changed")}
 if len(s.Bots)!=2||s.Bots["cribbage"].Easy==nil||original.Easy==nil{t.Fatal("existing bot policy lost")}
 v,h:=s.Rules("chess").Identity()
 if v!="v1.1"||len(h)!=64{
  t.Fatal("wrong immutable Chess identity",v,h)
 }
 for _,level:=range []string{"easy","medium","hard"}{
  policy:=s.Bots["chess"]
  if level=="easy"&&policy.Easy==nil||level=="medium"&&policy.Medium==nil||level=="hard"&&policy.Hard==nil{
   t.Fatal("missing private policy",level)
  }
 }
}
