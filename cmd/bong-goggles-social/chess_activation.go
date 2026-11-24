package main

import (
 "errors"
 "crypto/sha256"
 "encoding/hex"
 "fmt"

 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)

// BC-3.3: activate only the independently version-pinned orthodox adapter
// behind the same authenticated room/session/journal/presence preconditions.
// Both explicit operator modes retain identical authenticated rules and policy boundaries.
func configureChess(mode string,sessions *social.ClassicSessions,rooms,rules,communications bool)error{
 switch mode{
 case "","disabled":return nil
 case "restricted-acceptance","public-play":
  if sessions==nil||sessions.Store==nil||sessions.Rooms==nil||
    !rooms||!rules||!communications{return errors.New("BC-3.3 requires authenticated room/session/replay/presence dependencies")}
  adapter,e:=social.NewChessRulesAdapter()
  if e!=nil{return fmt.Errorf("BC-3.3 compiled Chess engine: %w",e)}
  v,h:=adapter.Identity()
  expected:=sha256.Sum256([]byte("chess\nv1.1\nbc-chess-standard@1.1.0;orthodox;seat-0-white;seat-1-black;uci;san;exact-repetition;half-point-units;material-only-dead-position-and-flag-fall;resignation-is-loss"))
  if v!="v1.1"||h!=hex.EncodeToString(expected[:]){
   return errors.New("BC-3.3 frozen orthodox rules identity mismatch")
  }
  oldRules,oldBots:=sessions.Rules,sessions.Bots
  sessions.Rules=func(game string)social.ClassicRule{
   if game=="chess"{return adapter}
   if oldRules!=nil{return oldRules(game)}
   return nil
  }
  policies:=make(map[string]social.ClassicBotPolicies,len(oldBots)+1)
  for game,p:=range oldBots{policies[game]=p}
  policies["chess"]=social.NewChessBotPolicies()
  if e=sessions.EnableBots(policies);e!=nil{
   sessions.Rules=oldRules;sessions.Bots=oldBots
   return fmt.Errorf("BC-3.3 qualified Easy/Medium/Hard policies: %w",e)
  }
  return nil
 default:return errors.New("unsupported SOCIAL420_CHESS_MODE")
 }
}
