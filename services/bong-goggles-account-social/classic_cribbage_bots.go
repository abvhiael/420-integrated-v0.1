package social

import (
 "crypto/sha256"
 "encoding/binary"
 "encoding/json"
 "math"
 "math/rand"
)

// BC-1.3: three immutable, game-specific strategies. Only the rules adapter's
// seat-visible JSON and canonical legal actions enter this policy. No RuleFrame,
// deck, server seed, opponent hand, crib contents or untrusted client hints.
type cribbageBotPolicy struct{ level string }

func NewCribbageBotPolicies() ClassicBotPolicies {
 return ClassicBotPolicies{
  Easy:cribbageBotPolicy{level:"easy"},
  Medium:cribbageBotPolicy{level:"medium"},
  Hard:cribbageBotPolicy{level:"hard"},
 }
}

type cribbageBotView struct {
 GameID string `json:"gameId"`
 Variant string `json:"variant"`
 Round int `json:"round"`
 Phase string `json:"phase"`
 Dealer int `json:"dealer"`
 Turn int `json:"turn"`
 Seat int `json:"seat"`
 Scores []int64 `json:"scores"`
 Hand []int `json:"hand"`
 CardCounts []int `json:"cardCounts"`
 CribCount int `json:"cribCount"`
 Discarded []bool `json:"discarded"`
 Starter int `json:"starter"`
 PegCount int `json:"pegCount"`
 PegPile []int `json:"pegPile"`
 Pegged [][]int `json:"pegged"`
 SaidGo []bool `json:"saidGo"`
 LastShow []cribbageShow `json:"lastShow"`
 LastAwards []cribbageAward `json:"lastAwards"`
 Losers []cribbageLoss `json:"losers"`
 Winner *int `json:"winner"`
}

func cribbageBotReadView(raw json.RawMessage)(cribbageBotView,error){
 var v cribbageBotView
 if !strictRuleJSON(raw,&v)||v.GameID!="cribbage"||v.Round<1||
  v.Seat<0||v.Turn!=v.Seat||v.Phase=="finished"||v.Winner!=nil||
  (v.Phase!="discard"&&v.Phase!="cut"&&v.Phase!="peg")||
  len(v.Scores)<2||len(v.Scores)>4||v.Dealer<0||v.Dealer>=len(v.Scores)||
  len(v.Hand)>6||!cribbageValidCards(v.Hand)||len(v.CardCounts)!=len(v.Scores)||
  len(v.Discarded)!=len(v.Scores)||len(v.Pegged)!=len(v.Scores)||
  len(v.SaidGo)!=len(v.Scores)||v.PegCount<0||v.PegCount>31||
  len(v.PegPile)>16||v.Starter< -1||v.Starter>=52{return v,ErrInvalid}
 variant,e:=cribbageVariantFor(len(v.Scores))
 if e!=nil||variant.ID!=v.Variant{return v,ErrInvalid}
 if v.Phase=="discard"&&(v.Starter!=-1||len(v.Hand)!=variant.Deal||v.Discarded[v.Seat]){return v,ErrInvalid}
 if v.Phase=="cut"&&(v.Starter!=-1||len(v.Hand)!=4){return v,ErrInvalid}
 if v.Phase=="peg"&&(v.Starter<0||v.Starter>=52){return v,ErrInvalid}
 if !cribbageValidCards(v.PegPile){return v,ErrInvalid}
 for i,n:=range v.CardCounts{
  if n<0||n>6||len(v.Pegged[i])>4||!cribbageValidCards(v.Pegged[i]){return v,ErrInvalid}
 }
 return v,nil
}
func cribbageBotActions(raw []json.RawMessage,phase string)([]cribbageMove,error){
 if len(raw)<1||len(raw)>maxRulesLegal{return nil,ErrInvalid}
 actions:=make([]cribbageMove,0,len(raw))
 for _,item:=range raw{
  var m cribbageMove
  if !strictRuleJSON(item,&m){return nil,ErrInvalid}
  switch phase{
  case "discard":
   if m.Type!="discard"||m.Card!=nil||len(m.Cards)<1||len(m.Cards)>2||!cribbageValidCards(m.Cards){return nil,ErrInvalid}
  case "cut":
   if m.Type!="cut"||m.Card!=nil||len(m.Cards)>0{return nil,ErrInvalid}
  case "peg":
   if m.Type=="play"{
    if m.Card==nil||*m.Card<0||*m.Card>=52||len(m.Cards)!=0{return nil,ErrInvalid}
   }else if m.Type!="go"||m.Card!=nil||len(m.Cards)!=0{return nil,ErrInvalid}
  }
  actions=append(actions,m)
 }
 return actions,nil
}
func cribbageUnknownCards(v cribbageBotView)[]int{
 used:=[52]bool{}
 for _,card:=range v.Hand{used[card]=true}
 if v.Starter>=0{used[v.Starter]=true}
 for _,seat:=range v.Pegged{
  for _,card:=range seat{used[card]=true}
 }
 unknown:=make([]int,0,52)
 for i:=0;i<52;i++{if !used[i]{unknown=append(unknown,i)}}
 return unknown
}
func cribbageBotKept(hand,discard []int)([]int,error){
 kept:=append([]int(nil),hand...)
 for _,c:=range discard{
  var ok bool
  kept,ok=cribbageRemove(kept,c)
  if !ok{return nil,ErrInvalid}
 }
 if len(kept)!=4{return nil,ErrInvalid}
 return kept,nil
}
func cribbageBotOwnCrib(v cribbageBotView)bool{
 teams,_:=cribbageVariantFor(len(v.Scores))
 return teams.Teams[v.Seat]==teams.Teams[v.Dealer]
}
// Use only currently visible cards to seed repeatable *hypothetical* unknown
// cards; this is not the match's private shuffle seed or a deck prediction.
func cribbageBotSamples(raw json.RawMessage,unknown []int,count int)[ ][]int{
 digest:=sha256.Sum256(raw)
 rng:=rand.New(rand.NewSource(int64(binary.BigEndian.Uint64(digest[:8]))))
 samples:=make([][]int,0,count)
 for i:=0;i<count;i++{
  perm:=rng.Perm(len(unknown))
  drawn:=make([]int,4)
  for k:=0;k<4;k++{drawn[k]=unknown[perm[k]]}
  samples=append(samples,drawn)
 }
 return samples
}
func cribbageMediumHandPotential(kept []int,unknown []int,b *RuleBudget)(float64,error){
 // A small representative starter sample: intermediate difficulty recognizes
 // runs, pairs, fifteens and flushes, but is less accurate than Hard's full EV.
 const n=7
 sum:=0
 for i:=0;i<n;i++{
  if e:=b.Charge(1);e!=nil{return 0,e}
  starter:=unknown[(i*7+3)%len(unknown)]
  hand,e:=cribbageCountShow(kept,starter,false);if e!=nil{return 0,e}
  sum+=hand.Total
 }
 return float64(sum)/n,nil
}
func cribbageBotCribHeuristic(discard []int)float64{
 if len(discard)<2{
  if len(discard)==1{
   r:=cribbageRank(discard[0])
   if r==5{return 2.5};if r==10||r>10{return 0.7}
  }
  return 0
 }
 a,c:=discard[0],discard[1]
 score:=0.0
 if cribbageRank(a)==cribbageRank(c){score+=2.6}
 if cribbagePips(a)+cribbagePips(c)==15{score+=2.6}
 if int(math.Abs(float64(cribbageRank(a)-cribbageRank(c))))==1{score+=1.8}
 if cribbagePips(a)==5{score+=1.6}
 if cribbagePips(c)==5{score+=1.6}
 if cribbageSuit(a)==cribbageSuit(c){score+=0.35}
 return score
}
func cribbageBotDiscardScore(raw json.RawMessage,v cribbageBotView,m cribbageMove,unknown []int,
 samples [][]int,b *RuleBudget,level string)(float64,error){
 kept,e:=cribbageBotKept(v.Hand,m.Cards);if e!=nil{return 0,e}
 ownCrib:=cribbageBotOwnCrib(v)
 cribWeight:=-0.48;if ownCrib{cribWeight=0.48}
 if level=="medium"{
  value,e:=cribbageMediumHandPotential(kept,unknown,b)
  if e!=nil{return 0,e}
  return value+cribWeight*cribbageBotCribHeuristic(m.Cards),nil
 }
 // Hard: enumerate ALL possible publicly-unseen starters (no peek) and
 // estimate crib yield with common deterministic unseen-card samples.
 handTotal:=0
 for _,starter:=range unknown{
  if e:=b.Charge(1);e!=nil{return 0,e}
  score,err:=cribbageCountShow(kept,starter,false)
  if err!=nil{return 0,err}
  handTotal+=score.Total
 }
 cribTotal:=0
 for _,sample:=range samples{
  if e:=b.Charge(1);e!=nil{return 0,e}
  crib:=append([]int(nil),m.Cards...)
  // sample[0] is an unseen starter; remaining positions supply
  // unseen crib cards. All originate in the same unobserved pool.
  for j:=1;len(crib)<4;j++{crib=append(crib,sample[j])}
  score,err:=cribbageCountShow(crib,sample[0],true)
  if err!=nil{return 0,err}
  cribTotal+=score.Total
 }
 // A small pegging term values versatile cards without revealing other hands.
 potential:=0.0
 for _,card:=range kept{
  if cribbageRank(card)==5{potential+=0.18}
  if cribbagePips(card)<=4{potential+=0.08}
 }
 return float64(handTotal)/float64(len(unknown))+
  cribWeight*float64(cribTotal)/float64(len(samples))+potential,nil
}
func cribbageBotNextSeat(v cribbageBotView)int{
 n:=len(v.Scores)
 for offset:=1;offset<n;offset++{
  seat:=(v.Seat+offset)%n
  if v.CardCounts[seat]>0&&!v.SaidGo[seat]{return seat}
 }
 return -1
}
func cribbageBotPegScore(v cribbageBotView,m cribbageMove,unknown []int,level string,b *RuleBudget)(float64,error){
 if m.Type!="play"||m.Card==nil{return 0,nil}
 card:=*m.Card
 count:=v.PegCount+cribbagePips(card)
 pile:=append(append([]int(nil),v.PegPile...),card)
 _,points:=cribbagePegPoints(pile,count)
 value:=float64(points)*11
 teams,_:=cribbageVariantFor(len(v.Scores))
 if v.Scores[v.Seat]+int64(points)>=121{return 10000+value,nil}
 if level=="medium"{
  // Greedy tactical play: take known points, but avoid easy 15s after a
  // new count of 5/10 and retain low cards when tied.
  if count==5||count==10{value-=3.2}
  if count==21{value-=1.3}
  value-=float64(11-cribbagePips(card))*0.1
  return value,nil
 }
 // Hard: immediate reward plus one-ply opponent/teammate response EV
 // from publicly unobserved card identities. No opponent's hand is used.
 if count==31{return value+2,nil}
 next:=cribbageBotNextSeat(v)
 if next<0{return value+0.5,nil}
 if e:=b.Charge(len(unknown));e!=nil{return 0,e}
 response:=0.0
 legalPossibilities:=0
 for _,other:=range unknown{
  if count+cribbagePips(other)>31{continue}
  _,gain:=cribbagePegPoints(append(pile,other),count+cribbagePips(other))
  response+=float64(gain)
  legalPossibilities++
 }
 if legalPossibilities>0{
  // Risk model only, never a peek: it assumes unseen ranks are evenly
  // distributed. Partner point chances are beneficial in four-seat games.
  sign:=-1.0
  if teams.Teams[next]==teams.Teams[v.Seat]{sign=0.7}
  value+=sign*7.0*response/float64(len(unknown))
 }
 if count==5||count==10{value-=0.7}
 if count>21{value+=0.5}
 // Retain versatile low cards for a future 31 or Go sequence.
 value-=float64(11-cribbagePips(card))*0.035
 return value,nil
}
func (p cribbageBotPolicy)ChooseMove(raw json.RawMessage,difficulty string,legal []json.RawMessage,b *RuleBudget)(json.RawMessage,error){
 if difficulty!=p.level||!map[string]bool{"easy":true,"medium":true,"hard":true}[difficulty]{return nil,ErrInvalid}
 if e:=b.Charge(1);e!=nil{return nil,e}
 v,e:=cribbageBotReadView(raw);if e!=nil{return nil,e}
 moves,e:=cribbageBotActions(legal,v.Phase);if e!=nil{return nil,e}
 if len(moves)==1{return append(json.RawMessage(nil),legal[0]...),nil}
 if difficulty=="easy"{
  // Deliberately weak, but varied: fixed choice from the visible hand and
  // turn metadata only. Reproducible without any hidden state or clock.
  digest:=sha256.Sum256(raw)
  idx:=int(binary.BigEndian.Uint64(digest[:8])%uint64(len(legal)))
  return append(json.RawMessage(nil),legal[idx]...),nil
 }
 unknown:=cribbageUnknownCards(v)
 if len(unknown)<4{return nil,ErrUnavailable}
 var samples [][]int
 if v.Phase=="discard"&&difficulty=="hard"{samples=cribbageBotSamples(raw,unknown,16)}
 selected:=-1
 best:=math.Inf(-1)
 for i,m:=range moves{
  if e:=b.Charge(1);e!=nil{return nil,e}
  var score float64
  if v.Phase=="discard"{
   score,e=cribbageBotDiscardScore(raw,v,m,unknown,samples,b,difficulty)
  }else if v.Phase=="peg"{
   score,e=cribbageBotPegScore(v,m,unknown,difficulty,b)
  }
  if e!=nil{return nil,e}
  if selected<0||score>best+1e-9{
   selected=i;best=score
  }
 }
 if selected<0{return nil,ErrUnavailable}
 return append(json.RawMessage(nil),legal[selected]...),nil
}
var _ RuleDecisionPolicy=cribbageBotPolicy{}
