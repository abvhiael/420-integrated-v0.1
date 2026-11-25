package social

import (
 _ "embed"
 "strings"
 "crypto/sha256"
 "encoding/hex"
)

//go:embed word_salad_lexicon/english.txt
var wordSaladEnglish string
//go:embed word_salad_lexicon/cannabis.txt
var wordSaladCannabis string

func NewProductionWordSaladRulesAdapter()(*RulesAdapter,error){
 general:=strings.Fields(wordSaladEnglish)
 cannabis:=strings.Fields(wordSaladCannabis)
 if len(general)!=172823||len(cannabis)!=592{return nil,ErrUnavailable}
 return NewWordSaladRulesAdapter(general,cannabis)
}
func WordSaladDictionaryHashes()(string,string){
 g:=sha256.Sum256([]byte(wordSaladEnglish));c:=sha256.Sum256([]byte(wordSaladCannabis))
 return hex.EncodeToString(g[:]),hex.EncodeToString(c[:])
}
