package main

import (
 "testing"
 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

func TestBC15CribbageOperatorActivationIsIndependentAndFailClosed(t *testing.T){
 if err:=configureCribbage("disabled",nil,false,false,false);err!=nil{t.Fatal(err)}
 if err:=configureCribbage("",nil,false,false,false);err!=nil{t.Fatal(err)}
 if err:=configureCribbage("public-play",nil,true,true,true);err==nil{t.Fatal("unknown unrestricted activation accepted")}
 if err:=configureCribbage("restricted-acceptance",nil,true,true,true);err==nil{t.Fatal("missing session registry accepted")}
 s:=&social.ClassicSessions{Store:&social.Store{},Rooms:&social.ClassicRooms{}}
 for _,missing:=range [][3]bool{{false,true,true},{true,false,true},{true,true,false}}{
  if err:=configureCribbage("restricted-acceptance",s,missing[0],missing[1],missing[2]);err==nil{
   t.Fatalf("unsafe dependency bypass %+v",missing)
  }
  if s.Rules!=nil||len(s.Bots)!=0{t.Fatal("partial registration after failed prerequisites")}
 }
 if err:=configureCribbage("restricted-acceptance",s,true,true,true);err!=nil{t.Fatal(err)}
 if s.Rules==nil||len(s.Bots)!=1||s.Rules("chess")!=nil||s.Rules("russian-cribbage")!=nil{
  t.Fatal("unqualified game registered")
 }
 rule:=s.Rules("cribbage")
 if rule==nil{t.Fatal("Cribbage rule missing")}
 version,hash:=rule.Identity()
 if version!="v1.0"||hash!="6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24"{
  t.Fatalf("frozen rules identity changed %s %s",version,hash)
 }
 for _,level:=range []string{"easy","medium","hard"}{
  if _,err:=s.Bots["cribbage"].policy(level);err!=nil{t.Fatal("level missing",level,err)}
 }
}
