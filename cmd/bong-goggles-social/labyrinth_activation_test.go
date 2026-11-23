package main

import (
 "testing"
 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

func TestBC25OperatorActivationPreservesCribbageAndFailsClosed(t *testing.T){
 if e:=configureLabyrinth("",nil,false,false,false);e!=nil{t.Fatal(e)}
 if e:=configureLabyrinth("disabled",nil,false,false,false);e!=nil{t.Fatal(e)}
 if e:=configureLabyrinth("public-play",nil,true,true,true);e==nil{t.Fatal("unrestricted mode allowed")}
 if e:=configureLabyrinth("restricted-acceptance",nil,true,true,true);e==nil{t.Fatal("missing authority")}
 s:=&social.ClassicSessions{Store:&social.Store{},Rooms:&social.ClassicRooms{}}
 if e:=configureCribbage("restricted-acceptance",s,true,true,true);e!=nil{t.Fatal(e)}
 baseline:=s.Rules("cribbage")
 original:=s.Bots["cribbage"]
 for _,dependency:=range [][3]bool{{false,true,true},{true,false,true},{true,true,false}}{
  if e:=configureLabyrinth("restricted-acceptance",s,dependency[0],dependency[1],dependency[2]);e==nil{
   t.Fatal("accepted missing prerequisite",dependency)
  }
  if s.Rules("labyrinth-cribbage")!=nil||len(s.Bots)!=1{t.Fatal("partial activation")}
 }
 if e:=configureLabyrinth("restricted-acceptance",s,true,true,true);e!=nil{t.Fatal(e)}
 if s.Rules("chess")!=nil||s.Rules("russian-cribbage")!=nil{t.Fatal("unqualified rules leaked")}
 if s.Rules("cribbage")!=baseline{t.Fatal("existing Cribbage changed")}
 if len(s.Bots)!=2||s.Bots["cribbage"].Easy==nil||original.Easy==nil{t.Fatal("existing bot policy lost")}
 v,h:=s.Rules("labyrinth-cribbage").Identity()
 if v!="v2.0"||h!="9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791"{
  t.Fatal("wrong immutable 325-point identity",v,h)
 }
 for _,level:=range []string{"easy","medium","hard"}{
  policy:=s.Bots["labyrinth-cribbage"]
  if level=="easy"&&policy.Easy==nil||level=="medium"&&policy.Medium==nil||level=="hard"&&policy.Hard==nil{
   t.Fatal("missing private policy",level)
  }
 }
}
