package social

import (
 _ "embed"
 "strings"
 "crypto/sha256"
 "encoding/hex"
 "regexp"
)

//go:embed word_salad_lexicon/english.txt
var wordSaladEnglish string
//go:embed word_salad_lexicon/cannabis.txt
var wordSaladCannabis string

const wordSaladEnglishSHA256 = "77a8b7729436793e0094b68243ffb3ff0825332ceec5f427880138971d6135c4"
const wordSaladCannabisSHA256 = "dc75d44b8e612e2900d6d7c55c1f2c6c6c139e8ff610875fad1b1c0984c2a0a1"
const wordSaladEnglishCount = 172823
const wordSaladCannabisCount = 23934

// Conservative catalogue-noise exclusions, not a semantic cultivar classifier.
// Keep in sync with SOURCES.md; do not synthesize shorter words from rejected keys.
var wordSaladCatalogueNoise = regexp.MustCompile("TSHIRT|STICKERBUNDLE|GIFTCARD|CREWNECK|HOODIE|KEYCHAIN|TUMBLER|PHONECASE|BULKPACK|SHIP(S|PING)?(EARLY|LATE|MID|IN|NOW|FREE)|STRAINFEMPHOTO|STRAINAUTOFEM|STRAINSEEDS|SEEDPACK|PACKOF|SOLDOUT|PREORDER|ADDTOCART|FREESHIPPING|DISCOUNTCODE|SUBSCRIBE|COPYRIGHT|HTTPS|WWW")
func wordSaladRejectedCandidate(w string)bool{
 switch w{case "AAA","III","PPP","XXX":return true}
 return wordSaladCatalogueNoise.MatchString(w)
}
func wordSaladRawHash(raw string)string{
 h:=sha256.Sum256([]byte(raw));return hex.EncodeToString(h[:])
}
func wordSaladPinnedCorpus(raw,expected string,count int,cannabis bool)([]string,error){
 if wordSaladRawHash(raw)!=expected||!strings.HasSuffix(raw,"\n"){return nil,ErrUnavailable}
 keys:=strings.Split(strings.TrimSuffix(raw,"\n"),"\n")
 if len(keys)!=count{return nil,ErrUnavailable}
 for i,w:=range keys{
  if !saladWordOK(w)||i>0&&keys[i-1]>=w||cannabis&&wordSaladRejectedCandidate(w){return nil,ErrUnavailable}
 }
 return keys,nil
}
func NewProductionWordSaladRulesAdapter()(*RulesAdapter,error){
 general,e:=wordSaladPinnedCorpus(wordSaladEnglish,wordSaladEnglishSHA256,wordSaladEnglishCount,false);if e!=nil{return nil,e}
 cannabis,e:=wordSaladPinnedCorpus(wordSaladCannabis,wordSaladCannabisSHA256,wordSaladCannabisCount,true);if e!=nil{return nil,e}
 return NewWordSaladRulesAdapter(general,cannabis)
}
func WordSaladDictionaryHashes()(string,string){
 return wordSaladRawHash(wordSaladEnglish),wordSaladRawHash(wordSaladCannabis)
}
