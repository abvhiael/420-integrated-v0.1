package social

import (
 "bytes"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "math/bits"
 "sort"
 "strconv"
)

// BC-1.2: independent account-game engine. This module is not registered by
// production startup, and cannot change the BG-15 wallet ruleset.
const cribbageManifestSHA256 = "a2b6e4695d27555546fc1b8d43e54e33c2dfba3aa50c6103393db32575d86cec"
const cribbageProductRuleset = "bc-cribbage-standard-121@1.0.0"

type cribbageRules struct{}
type cribbageVariant struct {
 ID string
 Deal int
 Discard int
 Extra int
 Teams []int
}
func cribbageVariantFor(n int)(cribbageVariant,error){
 switch n {
 case 2:return cribbageVariant{"standard-2p",6,2,0,[]int{0,1}},nil
 case 3:return cribbageVariant{"standard-3p",5,1,1,[]int{0,1,2}},nil
 case 4:return cribbageVariant{"standard-4p-partners",5,1,0,[]int{0,1,0,1}},nil
 default:return cribbageVariant{},ErrInvalid
 }
}
type cribbageComponents struct{
 Fifteens int `json:"fifteens"`
 Pairs int `json:"pairs"`
 Runs int `json:"runs"`
 Flush int `json:"flush"`
 Nobs int `json:"nobs"`
 Total int `json:"total"`
}
type cribbageShow struct {
 Seat int `json:"seat"`
 IsCrib bool `json:"isCrib"`
 Cards []int `json:"cards"`
 Starter int `json:"starter"`
 Score cribbageComponents `json:"score"`
}
type cribbageAward struct {
 Seat int `json:"seat"`
 Team int `json:"team"`
 Kind string `json:"kind"`
 Points int `json:"points"`
 Count int `json:"count,omitempty"` // public running count at the instant of this award
 Total int64 `json:"total"`
}
type cribbageLoss struct {
 Team int `json:"team"`
 Score int64 `json:"score"`
 Classification string `json:"classification"`
}
type cribbageData struct {
 Variant string `json:"variant"`
 Stage string `json:"stage"`
 Dealer int `json:"dealer"`
 Deck []int `json:"deck"`
 Drawn int `json:"drawn"`
 Hands [][]int `json:"hands"`
 Kept [][]int `json:"kept"`
 Remaining [][]int `json:"remaining"`
 Played [][]int `json:"played"`
 Crib []int `json:"crib"`
 Discarded []bool `json:"discarded"`
 Starter int `json:"starter"`
 Count int `json:"count"`
 Pile []int `json:"pile"`
 Go []bool `json:"go"`
 Last int `json:"last"`
 LastShow []cribbageShow `json:"lastShow"`
 Awards []cribbageAward `json:"awards"`
 Losers []cribbageLoss `json:"losers"`
}
type cribbageMove struct {
 Type string `json:"type"`
 Cards []int `json:"cards,omitempty"`
 Card *int `json:"card,omitempty"`
}
func (cribbageRules) Definition()RuleDefinition{
 return RuleDefinition{GameID:"cribbage",Version:"v1.0",
  Specification:cribbageProductRuleset+";manifest-sha256="+cribbageManifestSHA256+
   ";2p-individual;3p-individual;4p-opposite-seat-teams;121;auto-count;no-muggins"}
}
func NewCribbageRulesAdapter()(*RulesAdapter,error){return NewRulesAdapter(cribbageRules{})}
// 121-point play can require more than the generic 512-command journal.
// This explicit allowance is still hard bounded and is not global.
func (cribbageRules) MaxReplayActions()int{return 8192}
func (cribbageRules) ValidateSeats(room ClassicRoom,seats []ClassicSeat)error{
 v,e:=cribbageVariantFor(room.SeatCount)
 if e!=nil||room.GameID!="cribbage"||len(seats)!=room.SeatCount{return ErrInvalid}
 for i,seat:=range seats{
  if seat.Index!=i||seat.Team!=v.Teams[i]{return ErrInvalid}
 }
 return nil
}

func cribbageRank(card int)int{return card%13+1}
func cribbageSuit(card int)int{return card/13}
func cribbagePips(card int)int{r:=cribbageRank(card);if r>10{return 10};return r}
func cribbageValidCards(cards []int)bool{
 seen:=[52]bool{}
 for _,v:=range cards{if v<0||v>=52||seen[v]{return false};seen[v]=true}
 return true
}
func cribbageShuffle(seed [32]byte,domain string)([]int,error){
 out:=make([]int,52)
 for i:=range out{out[i]=i}
 rng:=&RuleRandom{Seed:seed,Domain:domain}
 for i:=51;i>0;i--{
  j,e:=rng.Intn(uint64(i+1));if e!=nil{return nil,e}
  out[i],out[int(j)]=out[int(j)],out[i]
 }
 return out,nil
}
func cribbageFirstDealer(seed [32]byte,count int)(int,error){
 candidates:=make([]int,count)
 for i:=range candidates{candidates[i]=i}
 for attempt:=0;attempt<64;attempt++{
  pack,e:=cribbageShuffle(seed,"crib-cut-"+strconv.Itoa(attempt));if e!=nil{return 0,e}
  minRank:=14
  low:=[]int{}
  for i,seat:=range candidates{
   rank:=cribbageRank(pack[i])
   if rank<minRank{minRank=rank;low=low[:0]}
   if rank==minRank{low=append(low,seat)}
  }
  if len(low)==1{return low[0],nil}
  candidates=low
 }
 return 0,ErrUnavailable
}
func cribbageFreshRound(seed [32]byte,f *RuleFrame,d *cribbageData)error{
 v,e:=cribbageVariantFor(f.SeatCount);if e!=nil{return e}
 deck,e:=cribbageShuffle(seed,"crib-deal-"+strconv.Itoa(f.Round));if e!=nil{return e}
 d.Variant=v.ID;d.Stage="discard";d.Deck=deck;d.Drawn=0
 n:=f.SeatCount
 d.Hands=make([][]int,n);d.Kept=make([][]int,n)
 d.Remaining=make([][]int,n);d.Played=make([][]int,n)
 d.Crib=[]int{};d.Discarded=make([]bool,n)
 d.Starter=-1;d.Count=0;d.Pile=[]int{};d.Go=make([]bool,n);d.Last=-1
 d.Losers=[]cribbageLoss{}
 for round:=0;round<v.Deal;round++{
  for offset:=1;offset<=n;offset++{
   seat:=(d.Dealer+offset)%n
   d.Hands[seat]=append(d.Hands[seat],d.Deck[d.Drawn]);d.Drawn++
  }
 }
 for i:=0;i<v.Extra;i++{d.Crib=append(d.Crib,d.Deck[d.Drawn]);d.Drawn++}
 f.Phase="discard";f.Turn=(d.Dealer+1)%n
 return nil
}
func (cribbageRules) Initial(seed [32]byte,count int,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(52);e!=nil{return RuleFrame{},e}
 if _,e:=cribbageVariantFor(count);e!=nil{return RuleFrame{},e}
 dealer,e:=cribbageFirstDealer(seed,count);if e!=nil{return RuleFrame{},e}
 f:=RuleFrame{SeatCount:count,Round:1,Scores:make([]int64,count)}
 d:=cribbageData{Dealer:dealer}
 if e=cribbageFreshRound(seed,&f,&d);e!=nil{return RuleFrame{},e}
 f.Data,e=json.Marshal(d)
 return f,e
}
func cribbageDecode(f RuleFrame)(cribbageData,error){
 var d cribbageData
 if !strictRuleJSON(f.Data,&d){return d,ErrInvalid}
 return d,nil
}
func cribbageSameCards(a,b []int)bool{
 if len(a)!=len(b){return false}
 x:=append([]int(nil),a...);y:=append([]int(nil),b...)
 sort.Ints(x);sort.Ints(y)
 for i:=range x{if x[i]!=y[i]{return false}}
 return true
}
func cribbageFirstTurn(d cribbageData,n int)int{
 for i:=1;i<=n;i++{
  seat:=(d.Dealer+i)%n
  if !d.Discarded[seat]{return seat}
 }
 return (d.Dealer+1)%n
}
func cribbageAllDiscarded(d cribbageData)bool{
 for _,x:=range d.Discarded{if !x{return false}}
 return true
}
func cribbageAllPlayed(d cribbageData)bool{
 for _,r:=range d.Remaining{if len(r)!=0{return false}}
 return true
}
func cribbageCanPlay(d cribbageData,seat int)bool{
 if d.Go[seat]{return false}
 for _,card:=range d.Remaining[seat]{if cribbagePips(card)+d.Count<=31{return true}}
 return false
}
func cribbageNextActive(d cribbageData,after int)int{
 for i:=1;i<=len(d.Remaining);i++{
  seat:=(after+i)%len(d.Remaining)
  if len(d.Remaining[seat])>0&&!d.Go[seat]{return seat}
 }
 return -1
}
func cribbageReset(d *cribbageData){
 d.Count=0;d.Pile=[]int{};d.Go=make([]bool,len(d.Go));d.Last=-1
}
func cribbageJsonAction(m cribbageMove)json.RawMessage{raw,_:=json.Marshal(m);return raw}
func (cribbageRules) Legal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(2);e!=nil{return nil,e}
 if f.Terminal||f.Turn!=seat{return nil,ErrForbidden}
 d,e:=cribbageDecode(f);if e!=nil{return nil,e}
 v,_:=cribbageVariantFor(f.SeatCount)
 out:=[]json.RawMessage{}
 switch d.Stage{
 case "discard":
  hand:=d.Hands[seat]
  if v.Discard==1{
   for _,card:=range hand{out=append(out,cribbageJsonAction(cribbageMove{Type:"discard",Cards:[]int{card}}))}
  }else{
   for i:=0;i<len(hand);i++{for j:=i+1;j<len(hand);j++{
    out=append(out,cribbageJsonAction(cribbageMove{Type:"discard",Cards:[]int{hand[i],hand[j]}}))
   }}
  }
 case "cut":
  out=append(out,cribbageJsonAction(cribbageMove{Type:"cut"}))
 case "peg":
  for _,card:=range d.Remaining[seat]{
   if cribbagePips(card)+d.Count<=31{
    c:=card;out=append(out,cribbageJsonAction(cribbageMove{Type:"play",Card:&c}))
   }
  }
  if len(out)==0{out=append(out,cribbageJsonAction(cribbageMove{Type:"go"}))}
 default:return nil,ErrUnavailable
 }
 return out,nil
}
func cribbageRemove(h []int,card int)([]int,bool){
 for i,c:=range h{if c==card{return append(h[:i:i],h[i+1:]...),true}}
 return nil,false
}
func cribbageClassify(score int64)string{
 if score<=60{return "double-skunk"}
 if score<=90{return "skunk"}
 return "ordinary"
}
func cribbageScore(f *RuleFrame,d *cribbageData,seat,points int,kind string){
 if points<=0||f.Terminal{return}
 v,_:=cribbageVariantFor(f.SeatCount)
 team:=v.Teams[seat]
 for i,t:=range v.Teams{if t==team{f.Scores[i]+=int64(points)}}
 d.Awards=append(d.Awards,cribbageAward{Seat:seat,Team:team,Kind:kind,Points:points,Count:d.Count,Total:f.Scores[seat]})
 if f.Scores[seat]<121{return}
 f.Terminal=true;f.Turn=-1;f.Phase="finished"
 winner:=seat;f.Winner=&winner
 seen:=map[int]bool{team:true}
 d.Losers=[]cribbageLoss{}
 for i,t:=range v.Teams{
  if seen[t]{continue};seen[t]=true
  d.Losers=append(d.Losers,cribbageLoss{Team:t,Score:f.Scores[i],Classification:cribbageClassify(f.Scores[i])})
 }
}
func cribbagePegPoints(pile []int,count int)(string,int){
 points:=0
 kind:=""
 if count==15{points+=2;kind="fifteen"}
 if count==31{points+=2;kind="thirty-one"}
 equal:=1
 for i:=len(pile)-2;i>=0;i--{
  if cribbageRank(pile[i])!=cribbageRank(pile[len(pile)-1]){break}
  equal++
 }
 switch equal{case 2:points+=2;kind+="+pair";case 3:points+=6;kind+="+triple";case 4:points+=12;kind+="+quadruple"}
 for length:=len(pile);length>=3;length--{
  tail:=pile[len(pile)-length:]
  seen:=map[int]bool{};lo:=14;hi:=0
  for _,c:=range tail{r:=cribbageRank(c);seen[r]=true;if r<lo{lo=r};if r>hi{hi=r}}
  if len(seen)==length&&hi-lo+1==length{
   points+=length;kind+="+run";break
  }
 }
 return kind,points
}
func cribbageCountShow(hand []int,starter int,isCrib bool)(cribbageComponents,error){
 if len(hand)!=4||starter<0||starter>=52{return cribbageComponents{},ErrInvalid}
 all:=append(append([]int(nil),hand...),starter)
 if !cribbageValidCards(all){return cribbageComponents{},ErrInvalid}
 var s cribbageComponents
 for mask:=1;mask<32;mask++{
  if bits.OnesCount(uint(mask))<2{continue}
  value:=0
  for i,c:=range all{if mask&(1<<i)!=0{value+=cribbagePips(c)}}
  if value==15{s.Fifteens+=2}
 }
 for i:=0;i<5;i++{for j:=i+1;j<5;j++{
  if cribbageRank(all[i])==cribbageRank(all[j]){s.Pairs+=2}
 }}
 for length:=5;length>=3;length--{
  runScore:=0
  for mask:=1;mask<32;mask++{
   if bits.OnesCount(uint(mask))!=length{continue}
   seen:=map[int]bool{};lo:=14;hi:=0
   for i,c:=range all{
    if mask&(1<<i)==0{continue}
    r:=cribbageRank(c);seen[r]=true;if r<lo{lo=r};if r>hi{hi=r}
   }
   if len(seen)==length&&hi-lo+1==length{runScore+=length}
  }
  if runScore>0{s.Runs=runScore;break}
 }
 sameSuit:=true
 for _,c:=range hand[1:]{if cribbageSuit(c)!=cribbageSuit(hand[0]){sameSuit=false;break}}
 if sameSuit{
  if cribbageSuit(starter)==cribbageSuit(hand[0]){s.Flush=5
  }else if !isCrib{s.Flush=4}
 }
 for _,c:=range hand{if cribbageRank(c)==11&&cribbageSuit(c)==cribbageSuit(starter){s.Nobs++}}
 s.Total=s.Fifteens+s.Pairs+s.Runs+s.Flush+s.Nobs
 return s,nil
}
func cribbageShowAndDeal(f *RuleFrame,d *cribbageData)error{
 d.Stage="show";d.LastShow=[]cribbageShow{}
 for i:=1;i<=f.SeatCount+1;i++{
  seat:=(d.Dealer+i)%f.SeatCount
  isCrib:=i==f.SeatCount+1
  if isCrib{seat=d.Dealer}
  cards:=d.Kept[seat]
  if isCrib{cards=d.Crib}
  score,e:=cribbageCountShow(cards,d.Starter,isCrib);if e!=nil{return e}
  d.LastShow=append(d.LastShow,cribbageShow{Seat:seat,IsCrib:isCrib,
   Cards:append([]int(nil),cards...),Starter:d.Starter,Score:score})
  kind:="hand";if isCrib{kind="crib"}
  cribbageScore(f,d,seat,score.Total,kind)
  if f.Terminal{return nil}
 }
 f.Round++;d.Dealer=(d.Dealer+1)%f.SeatCount
 seedBytes,e:=hex.DecodeString(f.Seed);if e!=nil||len(seedBytes)!=32{return ErrUnavailable}
 var seed [32]byte;copy(seed[:],seedBytes)
 return cribbageFreshRound(seed,f,d)
}
func cribbageFinishPeg(f *RuleFrame,d *cribbageData,previousCount int)error{
 if previousCount!=31{cribbageScore(f,d,d.Last,1,"last-card");if f.Terminal{return nil}}
 return cribbageShowAndDeal(f,d)
}
func cribbageAdvancePeg(f *RuleFrame,d *cribbageData,after int)error{
 if cribbageAllPlayed(*d){return cribbageShowAndDeal(f,d)}
 next:=cribbageNextActive(*d,after)
 if next>=0{f.Turn=next;return nil}
 // All unplayed seats already declared Go. The last *player to lay*
 // receives precisely one point for the whole sequence.
 last:=d.Last
 cribbageScore(f,d,last,1,"go")
 if f.Terminal{return nil}
 cribbageReset(d)
 f.Turn=cribbageNextActive(*d,last)
 if f.Turn<0{return ErrUnavailable}
 return nil
}
func (cribbageRules) Step(f RuleFrame,seat int,move json.RawMessage,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(24);e!=nil{return RuleFrame{},e}
 if f.Terminal||f.Turn!=seat{return RuleFrame{},ErrForbidden}
 var m cribbageMove
 if !strictRuleJSON(move,&m){return RuleFrame{},ErrInvalid}
 d,e:=cribbageDecode(f);if e!=nil{return RuleFrame{},e}
 v,_:=cribbageVariantFor(f.SeatCount)
 f.Scores=append([]int64(nil),f.Scores...)
 d.Awards=[]cribbageAward{}
 switch d.Stage{
 case "discard":
  if m.Type!="discard"||m.Card!=nil||len(m.Cards)!=v.Discard||!cribbageValidCards(m.Cards)||d.Discarded[seat]{return RuleFrame{},ErrInvalid}
  for _,card:=range m.Cards{
   var found bool
   d.Hands[seat],found=cribbageRemove(d.Hands[seat],card)
   if !found{return RuleFrame{},ErrInvalid}
   d.Crib=append(d.Crib,card)
  }
  d.Discarded[seat]=true
  if cribbageAllDiscarded(d){
   d.Stage="cut";f.Phase="cut";f.Turn=(d.Dealer+1)%f.SeatCount
   for i:=range d.Hands{
    d.Kept[i]=append([]int(nil),d.Hands[i]...)
    d.Remaining[i]=append([]int(nil),d.Hands[i]...)
   }
  }else{f.Turn=cribbageFirstTurn(d,f.SeatCount)}
 case "cut":
  if m.Type!="cut"||m.Card!=nil||len(m.Cards)!=0||len(d.Crib)!=4||d.Drawn>=52{return RuleFrame{},ErrInvalid}
  d.Starter=d.Deck[d.Drawn];d.Drawn++
  d.Stage="peg";f.Phase="peg";f.Turn=(d.Dealer+1)%f.SeatCount
  if cribbageRank(d.Starter)==11{cribbageScore(&f,&d,d.Dealer,2,"heels")}
 case "peg":
  if m.Type=="play"{
   if m.Card==nil||len(m.Cards)>0||cribbagePips(*m.Card)+d.Count>31{return RuleFrame{},ErrInvalid}
   var found bool
   d.Remaining[seat],found=cribbageRemove(d.Remaining[seat],*m.Card)
   if !found{return RuleFrame{},ErrInvalid}
   d.Played[seat]=append(d.Played[seat],*m.Card)
   d.Pile=append(d.Pile,*m.Card);d.Count+=cribbagePips(*m.Card);d.Last=seat
   kind,points:=cribbagePegPoints(d.Pile,d.Count)
   cribbageScore(&f,&d,seat,points,kind)
   if f.Terminal{break}
   if d.Count==31{
    cribbageReset(&d)
    if cribbageAllPlayed(d){e=cribbageShowAndDeal(&f,&d)}else{
     f.Turn=cribbageNextActive(d,seat)
     if f.Turn<0{e=ErrUnavailable}
    }
   }else if cribbageAllPlayed(d){
    e=cribbageFinishPeg(&f,&d,d.Count)
   }else{e=cribbageAdvancePeg(&f,&d,seat)}
  }else if m.Type=="go"{
   if m.Card!=nil||len(m.Cards)>0||cribbageCanPlay(d,seat)||len(d.Remaining[seat])==0{return RuleFrame{},ErrInvalid}
   d.Go[seat]=true
   e=cribbageAdvancePeg(&f,&d,seat)
  }else{return RuleFrame{},ErrInvalid}
 default:return RuleFrame{},ErrInvalid
 }
 if e!=nil{return RuleFrame{},e}
 f.Data,e=json.Marshal(d)
 return f,e
}
func (cribbageRules) Validate(f RuleFrame)error{
 v,e:=cribbageVariantFor(f.SeatCount);if e!=nil{return e}
 d,e:=cribbageDecode(f);if e!=nil{return e}
 if d.Variant!=v.ID||d.Dealer<0||d.Dealer>=f.SeatCount||
  len(d.Hands)!=f.SeatCount||len(d.Kept)!=f.SeatCount||
  len(d.Remaining)!=f.SeatCount||len(d.Played)!=f.SeatCount||
  len(d.Discarded)!=f.SeatCount||len(d.Go)!=f.SeatCount||
  len(d.Deck)!=52||!cribbageValidCards(d.Deck)||
  d.Drawn<0||d.Drawn>52||d.Count<0||d.Count>31||
  d.Starter< -1||d.Starter>=52||d.Last< -1||d.Last>=f.SeatCount||
  len(d.Pile)>16||len(d.LastShow)>f.SeatCount+1||len(d.Awards)>32||
  len(d.Losers)>f.SeatCount-1{return ErrInvalid}
 seedBytes,e:=hex.DecodeString(f.Seed);if e!=nil||len(seedBytes)!=32{return ErrInvalid}
 var seed [32]byte;copy(seed[:],seedBytes)
 dealer,e:=cribbageFirstDealer(seed,f.SeatCount);if e!=nil{return e}
 if d.Dealer!=(dealer+f.Round-1)%f.SeatCount{return ErrInvalid}
 deck,e:=cribbageShuffle(seed,"crib-deal-"+strconv.Itoa(f.Round));if e!=nil{return e}
 for i:=range deck{if d.Deck[i]!=deck[i]{return ErrInvalid}}
 for i,team:=range v.Teams{for j,other:=range v.Teams{
  if team==other&&f.Scores[i]!=f.Scores[j]{return ErrInvalid}
 }}
 sawWin:=false
 for _,score:=range f.Scores{if score<0{return ErrInvalid};if score>=121{sawWin=true}}
 if f.Terminal!=sawWin||f.Terminal!=(f.Phase=="finished")||
  (f.Terminal&&f.Winner==nil)||(f.Terminal&&(f.Scores[*f.Winner]<121))||
  (!f.Terminal&&f.Winner!=nil){return ErrInvalid}
 if !f.Terminal&&len(d.Losers)!=0{return ErrInvalid}
 if !f.Terminal&&(f.Phase!=d.Stage||f.Turn<0){return ErrInvalid}
 if f.Terminal&&d.Stage!="peg"&&d.Stage!="show"{return ErrInvalid}
 for _,g:=range d.LastShow{
  if g.Seat<0||g.Seat>=f.SeatCount||len(g.Cards)!=4{return ErrInvalid}
  score,err:=cribbageCountShow(g.Cards,g.Starter,g.IsCrib)
  if err!=nil||score!=g.Score{return ErrInvalid}
 }
 for _,a:=range d.Awards{
  if a.Seat<0||a.Seat>=f.SeatCount||a.Team!=v.Teams[a.Seat]||a.Points<1||a.Points>29||a.Count<0||a.Count>31||a.Kind==""||a.Total<1{return ErrInvalid}
 }
 initialDrawn:=v.Deal*f.SeatCount+v.Extra
 seen:=[52]bool{}
 consume:=func(cards []int)bool{
  for _,card:=range cards{
   if card<0||card>=52||seen[card]{return false}
   seen[card]=true
  }
  return true
 }
 switch d.Stage{
 case "discard","cut":
  if d.Drawn!=initialDrawn||d.Starter!=-1||len(d.Pile)!=0||d.Count!=0||d.Last!=-1{return ErrInvalid}
  if !consume(d.Crib){return ErrInvalid}
  for i:=0;i<f.SeatCount;i++{
   expected:=v.Deal
   if d.Discarded[i]{expected-=v.Discard}
   if len(d.Hands[i])!=expected||!consume(d.Hands[i])||len(d.Played[i])>0{return ErrInvalid}
   if d.Stage=="discard"&&(len(d.Kept[i])!=0||len(d.Remaining[i])!=0){return ErrInvalid}
   if d.Stage=="cut"&&(!cribbageSameCards(d.Hands[i],d.Kept[i])||!cribbageSameCards(d.Hands[i],d.Remaining[i])){return ErrInvalid}
   if d.Go[i]{return ErrInvalid}
  }
  count:=0;for _,done:=range d.Discarded{if done{count++}}
  if len(d.Crib)!=v.Extra+count*v.Discard{return ErrInvalid}
  if d.Stage=="discard"&&(count==f.SeatCount||f.Turn!=cribbageFirstTurn(d,f.SeatCount)){return ErrInvalid}
  if d.Stage=="cut"&&(!cribbageAllDiscarded(d)||f.Turn!=(d.Dealer+1)%f.SeatCount){return ErrInvalid}
 case "peg","show":
  if d.Drawn!=initialDrawn+1||d.Starter!=d.Deck[initialDrawn]||
   len(d.Crib)!=4||!consume(d.Crib)||!consume([]int{d.Starter})||!cribbageAllDiscarded(d){return ErrInvalid}
  for i:=0;i<f.SeatCount;i++{
   if len(d.Hands[i])!=4||!cribbageSameCards(d.Hands[i],d.Kept[i])||
    len(d.Remaining[i])+len(d.Played[i])!=4{return ErrInvalid}
   both:=append(append([]int{},d.Remaining[i]...),d.Played[i]...)
   if !cribbageSameCards(both,d.Kept[i])||!consume(both){return ErrInvalid}
  }
  if d.Stage=="show"&&!f.Terminal{return ErrInvalid}
  total:=0;for _,card:=range d.Pile{total+=cribbagePips(card)}
  if total!=d.Count||(d.Count==0)!=(len(d.Pile)==0)||
   (d.Count==0&&d.Last!=-1)||(d.Count>0&&d.Last==-1){return ErrInvalid}
  // A winning 31 ends immediately before the normal sequence reset.
  if d.Count==31&&!f.Terminal{return ErrInvalid}
  if !f.Terminal{
   if cribbageAllPlayed(d)||len(d.Remaining[f.Turn])==0||d.Go[f.Turn]{return ErrInvalid}
  }
 default:return ErrInvalid
 }
 for i:=0;i<d.Drawn;i++{if !seen[d.Deck[i]]{return ErrInvalid}}
 for i:=d.Drawn;i<52;i++{if seen[d.Deck[i]]{return ErrInvalid}}
 if f.Terminal{
  groups:=map[int]bool{v.Teams[*f.Winner]:true}
  for _,l:=range d.Losers{
   if l.Team<0||l.Team>=f.SeatCount||groups[l.Team]||l.Score<0||l.Score>=121||l.Classification!=cribbageClassify(l.Score){return ErrInvalid}
   groups[l.Team]=true
  }
  if len(groups)!=func()int{m:=map[int]bool{};for _,t:=range v.Teams{m[t]=true};return len(m)}(){return ErrInvalid}
 }
 return nil
}
func (cribbageRules) View(f RuleFrame,seat int)(json.RawMessage,error){
 if seat<0||seat>=f.SeatCount{return nil,ErrForbidden}
 d,e:=cribbageDecode(f);if e!=nil{return nil,e}
 private:=d.Hands[seat]
 if d.Stage=="peg"||d.Stage=="show"{private=d.Remaining[seat]}
 // A nil Go slice marshals as JSON null, while the frozen browser privacy
 // contract requires arrays, including empty pegging piles and award lists.
 // Materialize only the participant's existing projection, never game state.
 hand:=append([]int{},private...)
 pegPile:=append([]int{},d.Pile...)
 pegged:=make([][]int,len(d.Played))
 for i,played:=range d.Played{pegged[i]=append([]int{},played...)}
 lastShow:=append([]cribbageShow{},d.LastShow...)
 lastAwards:=append([]cribbageAward{},d.Awards...)
 losers:=append([]cribbageLoss{},d.Losers...)
 publicCounts:=make([]int,f.SeatCount)
 for i:=range publicCounts{
  if d.Stage=="discard"||d.Stage=="cut"{publicCounts[i]=len(d.Hands[i])
  }else{publicCounts[i]=len(d.Remaining[i])}
 }
 view:=struct{
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
 }{GameID:"cribbage",Variant:d.Variant,Round:f.Round,Phase:f.Phase,
  Dealer:d.Dealer,Turn:f.Turn,Seat:seat,Scores:f.Scores,
  Hand:hand,CardCounts:publicCounts,CribCount:len(d.Crib),
  Discarded:d.Discarded,Starter:d.Starter,PegCount:d.Count,PegPile:pegPile,Pegged:pegged,
  SaidGo:d.Go,LastShow:lastShow,LastAwards:lastAwards,Losers:losers,Winner:f.Winner}
 raw,e:=json.Marshal(view)
 if e!=nil||len(raw)>classicMaxActionBytes{return nil,ErrUnavailable}
 return raw,nil
}
var _ RuleModule=cribbageRules{}

// Compile-time marker: the module uses the qualified RuleBudget and RuleRandom
// from BC-0.7, not browser-side randomness or a client-provided score.
var _ = bytes.Equal
var _ = fmt.Sprintf
