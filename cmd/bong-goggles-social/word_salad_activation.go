package main

import (
 "errors"
 social "github.com/420integrated/420-integrated/services/bong-goggles-account-social"
)
func configureWordSalad(mode string,sessions *social.ClassicSessions,rooms,rules,communications bool)error{
 switch mode{
 case "","disabled":return nil
 case "restricted-acceptance":
  if sessions==nil||sessions.Store==nil||sessions.Rooms==nil||!rooms||!rules||!communications{return errors.New("Word Salad requires authenticated room, session, replay and presence dependencies")}
  adapter,e:=social.NewProductionWordSaladRulesAdapter();if e!=nil{return e}
  prior:=sessions.Rules
  sessions.Rules=func(game string)social.ClassicRule{if game=="scrabble"{return adapter};if prior!=nil{return prior(game)};return nil}
  return nil
 default:return errors.New("unsupported SOCIAL420_WORD_SALAD_MODE")
 }
}
