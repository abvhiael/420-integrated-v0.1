package social

import (
 "bytes"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "os"
 "strings"
 "testing"
)

func cribSeed(n byte)[32]byte{
 var x [32]byte;for i:=range x{x[i]=byte(int(n)+i*17)};return x
}
func cribFrame(t *testing.T,a *RulesAdapter,raw json.RawMessage)RuleFrame{
 t.Helper();f,e:=a.decode(raw);if e!=nil{t.Fatal(e)};return f
}
func cribData(t *testing.T,f RuleFrame)cribbageData{
 t.Helper();d,e:=cribbageDecode(f);if e!=nil{t.Fatal(e)};return d
}
func cribCard(rank int,suit int)int{return suit*13+rank-1}
func TestBC12ManifestLockAndVariants(t *testing.T){
 manifest,e:=os.ReadFile("../../docs/games/classics/BC-1-1-CRIBBAGE-VARIANTS.json")
 if e!=nil{t.Fatal(e)}
 hash:=sha256.Sum256(manifest)
 if hex.EncodeToString(hash[:])!=cribbageManifestSHA256{t.Fatal("BC-1.1 rule manifest changed without new engine version")}
 a,e:=NewCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 if a.definition.GameID!="cribbage"||a.definition.Version!="v1.0"||!strings.Contains(a.definition.Specification,cribbageProductRuleset){t.Fatal(a.definition)}
 for _,n:=range []int{2,3,4}{
  v,e:=cribbageVariantFor(n);if e!=nil{t.Fatal(e)}
  raw,e:=a.initial(cribSeed(byte(n)),n);if e!=nil{t.Fatal(e)}
  again,e:=a.initial(cribSeed(byte(n)),n);if e!=nil||!bytes.Equal(raw,again){t.Fatal("nondeterministic initial state",n,e)}
  f:=cribFrame(t,a,raw);d:=cribData(t,f)
  if d.Variant!=v.ID||len(d.Crib)!=v.Extra||f.Turn!=(d.Dealer+1)%n{t.Fatal("bad opening",n)}
  for _,h:=range d.Hands{if len(h)!=v.Deal{t.Fatal("wrong deal",n)}}
  if f.Terminal||f.Round!=1||f.Phase!="discard"{t.Fatal("wrong initial phase",n)}
 }
 if _,e=a.initial(cribSeed(1),5);e==nil{t.Fatal("unsupported seat count")}
 if _,e=a.initial(cribSeed(1),1);e==nil{t.Fatal("unsupported seat count")}
}
func TestBC12HandScoringCanonicalFixtures(t *testing.T){
 cases:=[]struct{name string;hand [4]int;starter int;crib bool;total,run,flush,nobs int}{
  {"perfect29",[4]int{cribCard(5,0),cribCard(5,1),cribCard(5,2),cribCard(11,3)},cribCard(5,3),false,29,0,0,1},
  {"double-run",[4]int{cribCard(3,0),cribCard(4,1),cribCard(4,3),cribCard(5,2)},cribCard(9,0),false,8,6,0,0},
  {"double-double",[4]int{cribCard(2,0),cribCard(2,1),cribCard(3,2),cribCard(4,3)},cribCard(4,0),false,18,12,0,0},
  {"zero",[4]int{cribCard(1,0),cribCard(3,1),cribCard(7,2),cribCard(9,3)},cribCard(13,0),false,0,0,0,0},
  {"hand-four-flush",[4]int{cribCard(2,2),cribCard(4,2),cribCard(6,2),cribCard(8,2)},cribCard(13,0),false,4,0,4,0},
  {"crib-four-flush-zero",[4]int{cribCard(2,2),cribCard(4,2),cribCard(6,2),cribCard(8,2)},cribCard(13,0),true,0,0,0,0},
  {"crib-five-flush",[4]int{cribCard(2,2),cribCard(4,2),cribCard(6,2),cribCard(8,2)},cribCard(9,2),true,5,0,5,0},
  {"nobs",[4]int{cribCard(11,3),cribCard(2,0),cribCard(4,1),cribCard(8,2)},cribCard(9,3),false,1,0,0,1},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){
  p,e:=cribbageCountShow(tc.hand[:],tc.starter,tc.crib)
  if e!=nil||p.Total!=tc.total||p.Runs!=tc.run||p.Flush!=tc.flush||p.Nobs!=tc.nobs{t.Fatal(p,e)}
 })}
 // Every five-card combination must use physical cards; never invent 19.
 var seed [32]byte
 for i:=0;i<1500;i++{
  seed[0]=byte(i);seed[1]=byte(i>>8)
  shuffled,e:=cribbageShuffle(seed,"test-exhaustive-sample");if e!=nil{t.Fatal(e)}
  score,e:=cribbageCountShow(shuffled[:4],shuffled[4],i%2==0)
  if e!=nil||score.Total==19||score.Total>29||score.Total<0{t.Fatal("invalid score",i,score,e)}
 }
 bad:=[]int{cribCard(5,0),cribCard(5,0),cribCard(6,0),cribCard(7,0)}
 if _,e:=cribbageCountShow(bad,cribCard(8,0),false);e==nil{t.Fatal("duplicated physical card")}
}
func TestBC12PeggingRules(t *testing.T){
 C:=func(r,s int)int{return cribCard(r,s)}
 cases:=[]struct{cards []int;count int;score int}{
  {[]int{C(5,2),C(10,1)},15,2},
  {[]int{C(4,0),C(4,1)},8,2},
  {[]int{C(3,0),C(3,1),C(3,2)},9,6},
  {[]int{C(6,0),C(6,1),C(6,2),C(6,3)},24,12},
  {[]int{C(3,0),C(5,1),C(4,2)},12,3},
  {[]int{C(4,0),C(6,1),C(5,2),C(7,3)},22,4},
  {[]int{C(10,0),C(10,1),C(10,3),C(1,0)},31,2},
 }
 for _,tc:=range cases{
  _,score:=cribbagePegPoints(tc.cards,tc.count)
  if score!=tc.score{t.Fatal(tc.cards,score,tc.score)}
 }
 if cribbageClassify(60)!="double-skunk"||cribbageClassify(61)!="skunk"||
  cribbageClassify(90)!="skunk"||cribbageClassify(91)!="ordinary"{t.Fatal("skunk thresholds")}
}
func TestBC12PrivateProjectionAndIllegalCommands(t *testing.T){
 a,e:=NewCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 state,e:=a.initial(cribSeed(42),3);if e!=nil{t.Fatal(e)}
 f:=cribFrame(t,a,state);d:=cribData(t,f)
 for seat:=0;seat<3;seat++{
  view,e:=a.View(state,seat);if e!=nil{t.Fatal(e)}
  if bytes.Contains(view,[]byte(f.Seed))||bytes.Contains(view,[]byte("\"deck\""))||
   bytes.Contains(view,[]byte("\"crib\""))||bytes.Contains(view,[]byte("\"kept\"")){t.Fatal("private state leak",seat,string(view))}
  var v struct{Hand []int `json:"hand"`;CardCounts []int `json:"cardCounts"`;Seat int `json:"seat"`}
  if e=json.Unmarshal(view,&v);e!=nil||!cribbageSameCards(v.Hand,d.Hands[seat])||v.Seat!=seat{t.Fatal("viewer not seat-private",seat,e)}
 }
 wrong:=(f.Turn+1)%3
 if _,e=a.LegalActions(state,wrong);e==nil{t.Fatal("out of turn enumeration")}
 if _,_,_,_,e=a.Apply(state,wrong,json.RawMessage("{\"type\":\"cut\"}"));e==nil{t.Fatal("out of turn mutation")}
 for _,action:=range []string{
  "{\"type\":\"cut\"}",
  "{\"type\":\"discard\",\"cards\":[-1]}",
  "{\"type\":\"discard\",\"cards\":[0],\"score\":121}",
  "{\"type\":\"discard\",\"cards\":[0],\"cards\":[1]}",
  "{\"type\":\"go\"}",
 }{
  if _,_,_,_,e=a.Apply(state,f.Turn,json.RawMessage(action));e==nil{t.Fatal("accepted invalid action",action)}
 }
 f.Scores[0]=121 // nonterminal score forgery must fail closed.
 changed,_:=json.Marshal(f)
 if e=a.ValidateSaved(changed);e==nil{t.Fatal("accepted forged score")}
 f=cribFrame(t,a,state);d=cribData(t,f);d.Deck[0],d.Deck[1]=d.Deck[1],d.Deck[0]
 f.Data,_=json.Marshal(d);changed,_=json.Marshal(f)
 if e=a.ValidateSaved(changed);e==nil{t.Fatal("accepted forged shuffle")}
}
func TestBC12DeterministicFullMatchesAndReplay(t *testing.T){
 a,e:=NewCribbageRulesAdapter();if e!=nil{t.Fatal(e)}
 for _,count:=range []int{2,3,4}{
  t.Run(string(rune('0'+count))+"-seats",func(t *testing.T){
   seed:=cribSeed(byte(70+count))
   state,e:=a.initial(seed,count);if e!=nil{t.Fatal(e)}
   trace:=[]RuleTrace{};sawCut:=false;sawPeg:=false;sawShow:=false;sawGo:=false
   for step:=0;step<maxRulesMoves;step++{
    f:=cribFrame(t,a,state)
    if f.Terminal{
     if f.Winner==nil||f.Scores[*f.Winner]<121||len(cribData(t,f).Losers)==0{t.Fatal("invalid terminal outcome")}
     replay,e:=a.Replay(seed,count,trace)
     if e!=nil||!bytes.Equal(state,replay){t.Fatal("replay divergence",e)}
     if _,e=a.LegalActions(state,*f.Winner);e==nil{t.Fatal("terminal legal action")}
     if len(trace)==0{t.Fatal("empty trace")}
     tampered:=append([]RuleTrace(nil),trace...)
     tampered[0].AfterHash=strings.Repeat("0",64)
     if _,e=a.Replay(seed,count,tampered);e==nil{t.Fatal("accepted forged journal")}
     t.Logf("qualified full match count=%d steps=%d rounds=%d winner=%d scores=%v",count,len(trace),f.Round,*f.Winner,f.Scores)
     if !sawCut||!sawPeg||!sawShow||!sawGo{t.Fatal("missing covered match phase",sawCut,sawPeg,sawShow,sawGo)}
     return
    }
    legal,e:=a.LegalActions(state,f.Turn)
    if e!=nil||len(legal)==0||len(legal)>128{t.Fatal("invalid legal actions",f.Phase,e)}
    var chosen struct{Type string `json:"type"`}
    if e=json.Unmarshal(legal[0],&chosen);e!=nil{t.Fatal(e)}
    if chosen.Type=="cut"{sawCut=true}
    if chosen.Type=="play"{sawPeg=true}
    if chosen.Type=="go"{sawGo=true}
    prev:=state
    next,turn,terminal,winner,e:=a.Apply(prev,f.Turn,legal[0])
    if e!=nil{t.Fatalf("step %d count=%d phase=%s: %v",step,count,f.Phase,e)}
    newFrame:=cribFrame(t,a,next);newData:=cribData(t,newFrame)
    if len(newData.LastShow)>0{sawShow=true}
    if newFrame.Turn!=turn||newFrame.Terminal!=terminal||(winner==nil)!=(newFrame.Winner==nil){t.Fatal("incorrect adapter contract")}
    trace=append(trace,RuleTrace{Sequence:int64(len(trace)+2),Seat:f.Turn,Action:legal[0],BeforeHash:RuleHash(prev),AfterHash:RuleHash(next)})
    state=next
   }
   t.Fatal("valid match exceeded BC-0.7 replay cap",count)
  })
 }
}
