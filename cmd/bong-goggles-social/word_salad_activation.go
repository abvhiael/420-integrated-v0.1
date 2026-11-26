package main

import (
 "errors"
 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)
func configureWordSalad(mode string,sessions *social.ClassicSessions,rooms,rules,communications bool)error{
 return configureWordSaladWithFactory(mode,sessions,rooms,rules,communications,social.NewProductionWordSaladRulesAdapter)
}
// Explicit factory seam permits startup failure qualification without modifying embedded assets.
func configureWordSaladWithFactory(mode string,sessions *social.ClassicSessions,rooms,rules,communications bool, factory func()(*social.RulesAdapter,error))error{
 switch mode{
 case "","disabled":return nil
 case "restricted-acceptance":
  if sessions==nil||sessions.Store==nil||sessions.Rooms==nil||!rooms||!rules||!communications{return errors.New("Word Salad requires authenticated room, session, replay and presence dependencies")}
  if factory==nil{return social.ErrUnavailable}
  adapter,e:=factory();if e!=nil{return e};if adapter==nil{return social.ErrUnavailable}
  bots,e:=social.NewWordSaladBotPolicies(adapter);if e!=nil{return e}
  prior,priorBots:=sessions.Rules,sessions.Bots
  sessions.Rules=func(game string)social.ClassicRule{if game=="scrabble"{return adapter};if prior!=nil{return prior(game)};return nil}
  policies:=make(map[string]social.ClassicBotPolicies,len(priorBots)+1)
  for game,p:=range priorBots{policies[game]=p};policies["scrabble"]=bots
  if e=sessions.EnableBots(policies);e!=nil{sessions.Rules=prior;sessions.Bots=priorBots;return e}
  return nil
 default:return errors.New("unsupported SOCIAL420_WORD_SALAD_MODE")
 }
}
