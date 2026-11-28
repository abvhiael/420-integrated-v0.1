package social

import (
 _ "embed"
 "strings"
 "crypto/sha256"
 "encoding/hex"
 "regexp"
 "sync"
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
var legacySaladOnce sync.Once
var legacySaladAdapter *RulesAdapter
var legacySaladError error
func NewLegacyProductionWordSaladRulesAdapter()(*RulesAdapter,error){legacySaladOnce.Do(func(){legacySaladAdapter,legacySaladError=buildLegacyProductionWordSalad()});return legacySaladAdapter,legacySaladError}
func buildLegacyProductionWordSalad()(*RulesAdapter,error){
 general,e:=wordSaladPinnedCorpus(wordSaladEnglish,wordSaladEnglishSHA256,wordSaladEnglishCount,false);if e!=nil{return nil,e}
 cannabis,e:=wordSaladPinnedCorpus(wordSaladCannabis,wordSaladCannabisSHA256,wordSaladCannabisCount,true);if e!=nil{return nil,e}
 a,e:=NewWordSaladRulesAdapter(general,cannabis);if e!=nil{return nil,e};r:=a.module.(wordSaladRules);r.production=true;return NewRulesAdapter(r)
}
func WordSaladDictionaryHashes()(string,string){
 return wordSaladRawHash(wordSaladEnglish),wordSaladRawHash(wordSaladCannabis)
}

// Editorial supplement: colloquial English, profanity and adult slang are
// ordinary words, not automatically cannabis bonus words. Preserve the
// original pinned corpora for historical sessions. A changed union receives
// its own rules hash through NewWordSaladRulesAdapter.
const wordSaladColloquial = "ARSE ARSEHOLE ASS ASSHOLE ASSHOLES BADASS BALLSACK BASTARD BASTARDS BITCH BITCHES BOLLOCKS BONER BONERS BOOB BOOBS BOOBIE BOOBIES BULLSHIT BUTTHOLE BUTTPLUG BUTTPLUGS CHODE CHODES CLIT COCK COCKS COCKSUCKER COCKSUCKERS CRAP CUM CUMMING CUNT CUNTS DICK DICKS DICKHEAD DICKHEADS DILDO DILDOS DOUCHE DOUCHEBAG DOUCHEBAGS DUMBASS FART FARTED FARTING FARTS FUCK FUCKED FUCKER FUCKERS FUCKING FUCKS FUCKWIT GODDAMN HANDJOB HANDJOBS HELL HORNY JACKASS JACKOFF JERKOFF JIZZ MOTHERFUCKER MOTHERFUCKERS MOTHERFUCKING NUTSACK ORGASM ORGASMS PISS PISSED PISSER PISSING POOP POOPED POOPING PRICK PRICKS PUSSY PUSSIES QUEEF QUEEFED QUEEFING QUEEFS RIMJOB RIMJOBS SCROTUM SHAG SHAGGED SHAGGING SHIT SHITHEAD SHITHEADS SHITSHOW SHITTING SHITTY SKEET SLUT SLUTS SMUT TITTIES TITTY TOSSER TWAT TWATS WANK WANKED WANKER WANKERS WANKING WETDREAM WHORE WHORES"
func NewProductionWordSaladRulesAdapter()(*RulesAdapter,error){return newProductionWordSaladRulesAdapter(true)}
func NewPreviousProductionWordSaladRulesAdapter()(*RulesAdapter,error){return newProductionWordSaladRulesAdapter(false)}
var currentSaladOnce sync.Once
var currentSaladAdapter *RulesAdapter
var currentSaladError error
func newProductionWordSaladRulesAdapter(passRound bool)(*RulesAdapter,error){
 currentSaladOnce.Do(func(){currentSaladAdapter,currentSaladError=buildProductionWordSalad()});if currentSaladError!=nil{return nil,currentSaladError};r:=currentSaladAdapter.module.(wordSaladRules);r.passRound=passRound;return NewRulesAdapter(r)
}
func buildProductionWordSalad()(*RulesAdapter,error){
 general,e:=wordSaladPinnedCorpus(wordSaladEnglish,wordSaladEnglishSHA256,wordSaladEnglishCount,false);if e!=nil{return nil,e}
 cannabis,e:=wordSaladPinnedCorpus(wordSaladCannabis,wordSaladCannabisSHA256,wordSaladCannabisCount,true);if e!=nil{return nil,e}
 seen:=make(map[string]bool,len(general));for _,w:=range general{seen[w]=true}
 for _,w:=range strings.Fields(wordSaladColloquial){if !saladWordOK(w){return nil,ErrUnavailable};if !seen[w]{general=append(general,w);seen[w]=true}}
 a,e:=newWordSaladRulesAdapter(general,cannabis,true);if e!=nil{return nil,e};r:=a.module.(wordSaladRules);r.production=true;legacy,e:=NewLegacyProductionWordSaladRulesAdapter();if e!=nil{return nil,e};r.cannabis=legacy.module.(wordSaladRules).cannabis;return NewRulesAdapter(r)
}
