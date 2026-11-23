package social

import (
 "crypto/sha256"
 "encoding/binary"
 "encoding/json"
 "math"
 "math/bits"
 "math/rand"
)

// BC-2.3 is a separate, operator-compiled policy for the versioned 325-point
// Labyrinth rules. It is not installed in the production resolver at this
// milestone. All inputs are the acting seat's public/private projection and
// the rules engine's canonical legal actions; no deck, seed or hidden crib.
type labyrinthBotPolicy struct{ level string }

func NewLabyrinthCribbageBotPolicies() ClassicBotPolicies {
 return ClassicBotPolicies{
  Easy: labyrinthBotPolicy{level:"easy"},
  Medium: labyrinthBotPolicy{level:"medium"},
  Hard: labyrinthBotPolicy{level:"hard"},
 }
}

// Reject untrusted/overbroad observations *before* evaluating a move. Using
// the BC-1.3 view type preserves the exact externally exposed field set: a
// new or concealed field cannot quietly enter the policy's information set.
func labyrinthBotReadView(raw json.RawMessage)(cribbageBotView,cribbageVariant,error){
 var v cribbageBotView
 if !strictRuleJSON(raw,&v)||v.GameID!="labyrinth-cribbage"||
  v.Phase!="discard"&&v.Phase!="cut"&&v.Phase!="peg"||
  v.Round<1||v.Turn!=v.Seat||v.Winner!=nil||
  len(v.Scores)<2||len(v.Scores)>4||v.Seat<0||v.Seat>=len(v.Scores)||
  v.Dealer<0||v.Dealer>=len(v.Scores)||v.PegCount<0||v.PegCount>31||
  v.Starter< -1||v.Starter>=52||len(v.PegPile)>16||
  len(v.Hand)>9||!cribbageValidCards(v.Hand)||
  len(v.Discarded)!=len(v.Scores)||len(v.CardCounts)!=len(v.Scores)||
  len(v.Pegged)!=len(v.Scores)||len(v.SaidGo)!=len(v.Scores){
  return v,cribbageVariant{},ErrInvalid
 }
 variant,e:=labyrinthVariantFor(len(v.Scores),v.Variant)
 if e!=nil{return v,cribbageVariant{},ErrInvalid}
 for i,team:=range variant.Teams {
  if v.Scores[i]<0||v.Scores[i]>=325{return v,variant,ErrInvalid}
  for j,other:=range variant.Teams {
   if team==other&&v.Scores[i]!=v.Scores[j]{return v,variant,ErrInvalid}
  }
 }
 switch v.Phase {
 case "discard":
  if v.Starter!=-1||v.Discarded[v.Seat]||len(v.Hand)!=variant.Deal||
   v.PegCount!=0||len(v.PegPile)!=0{return v,variant,ErrInvalid}
 case "cut":
  if v.Starter!=-1||!v.Discarded[v.Seat]||len(v.Hand)!=6||
   v.PegCount!=0||len(v.PegPile)!=0{return v,variant,ErrInvalid}
 case "peg":
  if v.Starter<0||!v.Discarded[v.Seat]||v.SaidGo[v.Seat]||
   len(v.Hand)>6||len(v.Hand)==0{return v,variant,ErrInvalid}
 }
 used:=[52]bool{}
 consume:=func(card int)bool{
  if card<0||card>=52||used[card]{return false}
  used[card]=true
  return true
 }
 for _,card:=range v.Hand{if !consume(card){return v,variant,ErrInvalid}}
 if v.Starter>=0&&!consume(v.Starter){return v,variant,ErrInvalid}
 peggedCount:=0
 for i,n:=range v.CardCounts {
  if n<0||n>variant.Deal||v.Phase!="discard"&&n>6||
   len(v.Pegged[i])>6||!cribbageValidCards(v.Pegged[i])||
   v.Phase=="discard"&&(len(v.Pegged[i])>0||v.SaidGo[i])||
   v.Phase=="cut"&&(len(v.Pegged[i])>0||v.SaidGo[i]){
   return v,variant,ErrInvalid
  }
  for _,card:=range v.Pegged[i]{
   if !consume(card){return v,variant,ErrInvalid}
   peggedCount++
  }
 }
 if v.CardCounts[v.Seat]!=len(v.Hand){return v,variant,ErrInvalid}
 if v.Phase=="peg"{
  if !cribbageValidCards(v.PegPile)||len(v.PegPile)>peggedCount{return v,variant,ErrInvalid}
  for _,card:=range v.PegPile {
   found:=false
   for _,hand:=range v.Pegged {
    for _,played:=range hand{if card==played{found=true;break}}
    if found{break}
   }
   if !found{return v,variant,ErrInvalid}
  }
 }
 return v,variant,nil
}

func labyrinthBotActions(raw []json.RawMessage,v cribbageBotView,variant cribbageVariant)([]cribbageMove,error){
 if len(raw)<1||len(raw)>maxRulesLegal{return nil,ErrInvalid}
 actions:=make([]cribbageMove,0,len(raw))
 for _,item:=range raw {
  if len(item)==0||len(item)>maxRulesAction{return nil,ErrInvalid}
  var m cribbageMove
  if !strictRuleJSON(item,&m){return nil,ErrInvalid}
  switch v.Phase{
  case "discard":
   if m.Type!="discard"||m.Card!=nil||len(m.Cards)!=variant.Discard||
    !cribbageValidCards(m.Cards){return nil,ErrInvalid}
   for _,c:=range m.Cards{
    found:=false;for _,own:=range v.Hand{if c==own{found=true;break}}
    if !found{return nil,ErrInvalid}
   }
  case "cut":
   if m.Type!="cut"||m.Card!=nil||len(m.Cards)!=0{return nil,ErrInvalid}
  case "peg":
   if m.Type=="play"{
    if m.Card==nil||len(m.Cards)!=0||*m.Card<0||*m.Card>=52||
     v.PegCount+cribbagePips(*m.Card)>31{return nil,ErrInvalid}
    found:=false;for _,own:=range v.Hand{if own==*m.Card{found=true;break}}
    if !found{return nil,ErrInvalid}
   }else if m.Type=="go"{
    if m.Card!=nil||len(m.Cards)!=0{return nil,ErrInvalid}
    for _,own:=range v.Hand{
     if v.PegCount+cribbagePips(own)<=31{return nil,ErrInvalid}
    }
   }else{return nil,ErrInvalid}
  }
  actions=append(actions,m)
 }
 return actions,nil
}

// Exact mathematical seven-card show score, using rank multiplicity and 127
// physical subsets. This is a performance-only implementation for evaluating
// candidate discards, not authoritative scoring. The engine remains the sole
// scorer. Independent random fixtures cross-check it against labyrinthCountShow.
func labyrinthBotShowScore(hand []int,starter int,isCrib bool)int{
 var rankCount [14]int
 var pips [7]int
 for i,c:=range hand{rankCount[cribbageRank(c)]++;pips[i]=cribbagePips(c)}
 rankCount[cribbageRank(starter)]++;pips[6]=cribbagePips(starter)
 fifteens:=0
 var sums [128]int
 for mask:=1;mask<128;mask++{
  low:=mask& -mask
  sums[mask]=sums[mask^low]+pips[bits.TrailingZeros(uint(low))]
  if sums[mask]==15&&bits.OnesCount(uint(mask))>=2{fifteens+=2}
 }
 pairs:=0
 for _,n:=range rankCount{pairs+=n*(n-1)}
 runs:=0;longest:=0
 for start:=1;start<=13; {
  if rankCount[start]==0{start++;continue}
  finish:=start;mult:=1
  for finish<=13&&rankCount[finish]>0{
   mult*=rankCount[finish];finish++
  }
  length:=finish-start
  if length>=3 {
   if length>longest{longest=length;runs=length*mult
   }else if length==longest{runs+=length*mult}
  }
  start=finish
 }
 flush:=0;suit:=cribbageSuit(hand[0]);same:=true
 for _,c:=range hand[1:]{if cribbageSuit(c)!=suit{same=false;break}}
 if same{
  if cribbageSuit(starter)==suit{flush=7
  }else if !isCrib{flush=6}
 }
 nobs:=0
 for _,c:=range hand{
  if cribbageRank(c)==11&&cribbageSuit(c)==cribbageSuit(starter){nobs++}
 }
 return fifteens+pairs+runs+flush+nobs
}

func labyrinthBotUnknown(v cribbageBotView)[]int{
 return cribbageUnknownCards(v)
}
func labyrinthBotKept(hand,discard []int)([]int,error){
 kept:=append([]int(nil),hand...)
 for _,c:=range discard{
  var found bool;kept,found=cribbageRemove(kept,c)
  if !found{return nil,ErrInvalid}
 }
 if len(kept)!=6{return nil,ErrInvalid}
 return kept,nil
}
func labyrinthBotOwnCrib(v cribbageBotView,variant cribbageVariant)bool{
 return variant.Teams[v.Seat]==variant.Teams[v.Dealer]
}

// All hypothetical starters and crib partners are sampled from public-unknown
// physical cards using only the current seat's observation as the seed. The
// private dealer's deck order and concealed opponent holdings are never used.
func labyrinthBotSamples(raw json.RawMessage,unknown []int,n int)[][]int{
 digest:=sha256.Sum256(raw)
 rng:=rand.New(rand.NewSource(int64(binary.BigEndian.Uint64(digest[:8]))))
 out:=make([][]int,0,n)
 for i:=0;i<n;i++{
  perm:=rng.Perm(len(unknown))
  drawn:=make([]int,6)
  for k:=range drawn{drawn[k]=unknown[perm[k]]}
  out=append(out,drawn)
 }
 return out
}
func labyrinthBotCribHint(cards []int)float64{
 hint:=0.0
 for i,a:=range cards{
  r:=cribbageRank(a)
  if r==5{hint+=1.7}
  for _,b:=range cards[i+1:]{
   if r==cribbageRank(b){hint+=2.5}
   if cribbagePips(a)+cribbagePips(b)==15{hint+=2.6}
   gap:=r-cribbageRank(b);if gap==1||gap==-1{hint+=0.9}
   if cribbageSuit(a)==cribbageSuit(b){hint+=0.24}
  }
 }
 return hint
}
func labyrinthBotHandEV(kept,unknown []int,b *RuleBudget,level string)(float64,error){
 total:=0;n:=0
 if level=="medium"{
  const samples=8
  for i:=0;i<samples;i++{
   if e:=b.Charge(1);e!=nil{return 0,e}
   starter:=unknown[(i*5+3)%len(unknown)]
   total+=labyrinthBotShowScore(kept,starter,false);n++
  }
 }else{
  for _,starter:=range unknown{
   if e:=b.Charge(1);e!=nil{return 0,e}
   total+=labyrinthBotShowScore(kept,starter,false);n++
  }
 }
 return float64(total)/float64(n),nil
}
func labyrinthBotDiscardEV(v cribbageBotView,variant cribbageVariant,move cribbageMove,
 unknown []int,samples [][]int,b *RuleBudget,level string)(float64,error){
 kept,e:=labyrinthBotKept(v.Hand,move.Cards);if e!=nil{return 0,e}
 value,e:=labyrinthBotHandEV(kept,unknown,b,level);if e!=nil{return 0,e}
 sign:=-0.55
 if labyrinthBotOwnCrib(v,variant){sign=0.55}
 if level=="medium"{
  return value+sign*labyrinthBotCribHint(move.Cards),nil
 }
 cribEV:=0
 for _,sample:=range samples{
  if e:=b.Charge(1);e!=nil{return 0,e}
  // sample[0] is the hypothetical public starter; sample[1:] fills only
  // the unobserved portion of the six-card crib.
  crib:=append([]int(nil),move.Cards...)
  for j:=1;len(crib)<6;j++{crib=append(crib,sample[j])}
  cribEV+=labyrinthBotShowScore(crib,sample[0],true)
 }
 value+=sign*float64(cribEV)/float64(len(samples))
 // Small future-pegging preference, subordinate to show + crib EV.
 for _,card:=range kept {
  if cribbageRank(card)==5{value+=0.14}
  if cribbagePips(card)<=4{value+=0.06}
 }
 return value,nil
}

func labyrinthBotPegEV(v cribbageBotView,variant cribbageVariant,move cribbageMove,
 unknown []int,b *RuleBudget,level string)(float64,error){
 if move.Type!="play"||move.Card==nil{return 0,nil}
 count:=v.PegCount+cribbagePips(*move.Card)
 pile:=append(append([]int(nil),v.PegPile...),*move.Card)
 _,earned:=cribbagePegPoints(pile,count)
 value:=float64(earned)*11
 if v.Scores[v.Seat]+int64(earned)>=325{return 1_000_000+value,nil}
 if level=="medium"{
  if count==5||count==10{value-=3}
  if count==21{value-=1.2}
  return value-float64(11-cribbagePips(*move.Card))*0.09,nil
 }
 if count==31{return value+2,nil}
 next:=cribbageBotNextSeat(v)
 if next<0{return value+0.5,nil}
 if e:=b.Charge(len(unknown));e!=nil{return 0,e}
 // One-ply exposed-rank response model; may benefit a partner but never
 // queries an opponent's unrevealed hand or predicts the real next card.
 response:=0.0
 for _,c:=range unknown{
  if count+cribbagePips(c)>31{continue}
  _,gain:=cribbagePegPoints(append(pile,c),count+cribbagePips(c))
  response+=float64(gain)
 }
 sign:=-1.0
 if variant.Teams[next]==variant.Teams[v.Seat]{sign=0.8}
 value+=sign*7.0*response/float64(len(unknown))
 if count==5||count==10{value-=0.8}
 if count>=25{value+=0.3}
 return value-float64(11-cribbagePips(*move.Card))*0.03,nil
}

func (p labyrinthBotPolicy)ChooseMove(raw json.RawMessage,difficulty string,legal []json.RawMessage,b *RuleBudget)(json.RawMessage,error){
 if difficulty!=p.level||!map[string]bool{"easy":true,"medium":true,"hard":true}[difficulty]{
  return nil,ErrInvalid
 }
 if e:=b.Charge(1);e!=nil{return nil,e}
 view,variant,e:=labyrinthBotReadView(raw);if e!=nil{return nil,e}
 moves,e:=labyrinthBotActions(legal,view,variant);if e!=nil{return nil,e}
 if len(moves)==1{return append(json.RawMessage(nil),legal[0]...),nil}
 if difficulty=="easy"{
  digest:=sha256.Sum256(raw)
  index:=int(binary.BigEndian.Uint64(digest[:8])%uint64(len(legal)))
  return append(json.RawMessage(nil),legal[index]...),nil
 }
 unknown:=labyrinthBotUnknown(view)
 if len(unknown)<6{return nil,ErrUnavailable}
 var samples [][]int
 if view.Phase=="discard"&&difficulty=="hard"{samples=labyrinthBotSamples(raw,unknown,12)}
 best:=math.Inf(-1);chosen:=-1
 for i,m:=range moves{
  if e:=b.Charge(1);e!=nil{return nil,e}
  score:=0.0
  if view.Phase=="discard"{
   score,e=labyrinthBotDiscardEV(view,variant,m,unknown,samples,b,difficulty)
  }else if view.Phase=="peg"{
   score,e=labyrinthBotPegEV(view,variant,m,unknown,b,difficulty)
  }
  if e!=nil{return nil,e}
  if chosen<0||score>best+1e-9{chosen=i;best=score}
 }
 if chosen<0{return nil,ErrUnavailable}
 return append(json.RawMessage(nil),legal[chosen]...),nil
}

var _ RuleDecisionPolicy=labyrinthBotPolicy{}
