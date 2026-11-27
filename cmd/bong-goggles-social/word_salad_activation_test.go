package main

import (
 "errors"
 "testing"

 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

func TestWordSaladRuntimeActivation(t *testing.T){
 s:=&social.ClassicSessions{Store:&social.Store{},Rooms:&social.ClassicRooms{}}
 if e:=configureCribbage("restricted-acceptance",s,true,true,true);e!=nil{t.Fatal(e)}
 if e:=configureChess("restricted-acceptance",s,true,true,true);e!=nil{t.Fatal(e)}
 cribbage,chess:=s.Rules("cribbage"),s.Rules("chess")
 unchanged:=func(t *testing.T){t.Helper();if s.Rules("scrabble")!=nil||s.Rules("cribbage")!=cribbage||s.Rules("chess")!=chess||len(s.Bots)!=2{t.Fatal("registration changed during disabled or failed activation")}}
 for _,mode:=range []string{"","disabled"}{
  if e:=configureWordSalad(mode,nil,false,false,false);e!=nil{t.Fatal(mode,e)}
  if e:=configureWordSalad(mode,s,true,true,true);e!=nil{t.Fatal(mode,e)};unchanged(t)
 }
 for _,mode:=range []string{"public-play","enabled","RESTRICTED-ACCEPTANCE","restricted-acceptance "}{
  if e:=configureWordSalad(mode,s,true,true,true);e==nil{t.Fatal("unsupported mode",mode)};unchanged(t)
 }
 for _,tc:=range []struct{name string;sessions *social.ClassicSessions;rooms,rules,communications bool}{
  {"missing session",nil,true,true,true},
  {"missing store",&social.ClassicSessions{Rooms:s.Rooms,Rules:s.Rules},true,true,true},
  {"missing room service",&social.ClassicSessions{Store:s.Store,Rules:s.Rules},true,true,true},
  {"room readiness",s,false,true,true},
  {"rules readiness",s,true,false,true},
  {"communications readiness",s,true,true,false},
 }{t.Run(tc.name,func(t *testing.T){if e:=configureWordSalad("restricted-acceptance",tc.sessions,tc.rooms,tc.rules,tc.communications);e==nil{t.Fatal("missing dependency accepted")};unchanged(t)})}
 for _,factory:=range []func()(*social.RulesAdapter,error){nil,func()(*social.RulesAdapter,error){return nil,social.ErrUnavailable},func()(*social.RulesAdapter,error){return nil,nil}}{
  if e:=configureWordSaladWithFactory("restricted-acceptance",s,true,true,true,factory);!errors.Is(e,social.ErrUnavailable){t.Fatal("invalid dictionary factory accepted",e)};unchanged(t)
 }
 expected,e:=social.NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 if e=configureWordSalad("production",s,true,true,true);e!=nil{t.Fatal(e)}
 actual:=s.Rules("scrabble");if actual==nil{t.Fatal("missing registered adapter")}
 v,h:=actual.Identity();ev,eh:=expected.Identity()
 if v!=ev||h!=eh||v!="v1"||len(h)!=64{t.Fatal("incorrect production identity",v,h)}
 if s.Rules("cribbage")!=cribbage||s.Rules("chess")!=chess||s.Rules("unregistered")!=nil||len(s.Bots)!=3{t.Fatal("existing rules or bots altered")}
 bots:=s.Bots["scrabble"];if bots.Easy==nil||bots.Medium==nil||bots.Hard==nil{t.Fatal("missing Word Salad strategies")}
}
