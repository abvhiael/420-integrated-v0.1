package main

import (
 "errors"
 "fmt"

 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

// BC-1.5: opt in only to the independently qualified, frozen Cribbage
// adapter. Other Classics stay without a runnable rule resolver. The caller
// validates the existing room/session/rule/presence DB grants before this
// registration; no HTTP request or user-provided game manifest can enable it.
func configureCribbage(mode string, sessions *social.ClassicSessions, rooms, rules, communications bool) error {
 switch mode {
 case "", "disabled":
  return nil
 case "restricted-acceptance":
  if sessions==nil||sessions.Store==nil||sessions.Rooms==nil||
   !rooms||!rules||!communications{return errors.New("BC-1.5 requires qualified room, session, rule replay, and authenticated communications services")}
  adapter,err:=social.NewCribbageRulesAdapter()
  if err!=nil{return fmt.Errorf("BC-1.5 Cribbage rule adapter: %w",err)}
  version,hash:=adapter.Identity()
  if version!="v1.0"||hash!="6f13bd77568efc5d0836eaa61458ca0cc2c500d1db2d9c38e228b1c668f71e24"{
   return errors.New("BC-1.5 frozen Cribbage identity mismatch")
  }
  // Keep every unrelated game unavailable rather than falling back to a
  // different, older or incomplete ruleset on a restarted server.
  sessions.Rules=func(game string)social.ClassicRule{
   if game=="cribbage"{return adapter}
   return nil
  }
  if err=sessions.EnableBots(map[string]social.ClassicBotPolicies{
   "cribbage":social.NewCribbageBotPolicies(),
  });err!=nil{
   sessions.Rules=nil
   return fmt.Errorf("BC-1.5 qualified Cribbage computer players: %w",err)
  }
  return nil
 default:
  return errors.New("unsupported SOCIAL420_CRIBBAGE_MODE")
 }
}
