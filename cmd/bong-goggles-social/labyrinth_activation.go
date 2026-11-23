package main

import (
 "errors"
 "fmt"

 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

// BC-2.5: activate only the independently version-pinned 325-point adapter
// behind the same authenticated room/session/journal/presence preconditions.
// Never accept a browser-selected ruleset or automatically expose public Play.
func configureLabyrinth(mode string,sessions *social.ClassicSessions,rooms,rules,communications bool)error{
 switch mode{
 case "","disabled":return nil
 case "restricted-acceptance":
  if sessions==nil||sessions.Store==nil||sessions.Rooms==nil||
    !rooms||!rules||!communications{return errors.New("BC-2.5 requires authenticated room/session/replay/presence dependencies")}
  adapter,e:=social.NewLabyrinthCribbageRulesAdapter()
  if e!=nil{return fmt.Errorf("BC-2.5 compiled Labyrinth engine: %w",e)}
  v,h:=adapter.Identity()
  if v!="v2.0"||h!="9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791"{
   return errors.New("BC-2.5 frozen 325-point rules identity mismatch")
  }
  oldRules,oldBots:=sessions.Rules,sessions.Bots
  sessions.Rules=func(game string)social.ClassicRule{
   if game=="labyrinth-cribbage"{return adapter}
   if oldRules!=nil{return oldRules(game)}
   return nil
  }
  policies:=make(map[string]social.ClassicBotPolicies,len(oldBots)+1)
  for game,p:=range oldBots{policies[game]=p}
  policies["labyrinth-cribbage"]=social.NewLabyrinthCribbageBotPolicies()
  if e=sessions.EnableBots(policies);e!=nil{
   sessions.Rules=oldRules;sessions.Bots=oldBots
   return fmt.Errorf("BC-2.5 qualified Easy/Medium/Hard policies: %w",e)
  }
  return nil
 default:return errors.New("unsupported SOCIAL420_LABYRINTH_MODE")
 }
}
