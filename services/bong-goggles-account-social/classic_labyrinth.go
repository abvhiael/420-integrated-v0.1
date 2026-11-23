package social

import (
 "encoding/hex"
 "encoding/json"
 "math/bits"
 "strconv"
)

// BC-2.2: server-only deterministic Labyrinth Cribbage rules engine.
// No production activation or bot policy is implied by this module.
const labyrinthManifestSHA256 = "5c2f863b99dfc6430c4a75715d07fcdcff9e2ccebbd3bd2ac4be6c3beb466aa0"
const labyrinthProductRuleset = "bc-labyrinth-cribbage-241@1.0.0"
type labyrinthRules struct{}

func labyrinthVariantFor(count int,id string)(cribbageVariant,error){
 switch {
 case count==2&&id=="labyrinth-2p":
  return cribbageVariant{ID:id,Deal:9,Discard:3,Extra:0,Teams:[]int{0,1}},nil
 case count==3&&id=="labyrinth-3p":
  return cribbageVariant{ID:id,Deal:8,Discard:2,Extra:0,Teams:[]int{0,1,2}},nil
 case count==4&&id=="labyrinth-4p-partners":
  return cribbageVariant{ID:id,Deal:7,Discard:1,Extra:2,Teams:[]int{0,1,0,1}},nil
 case count==4&&id=="labyrinth-4p-individual":
  return cribbageVariant{ID:id,Deal:7,Discard:1,Extra:2,Teams:[]int{0,1,2,3}},nil
 default:return cribbageVariant{},ErrInvalid
 }
}
func (labyrinthRules) DefaultVariant(count int)(string,error){
 switch count {
 case 2:return "labyrinth-2p",nil
 case 3:return "labyrinth-3p",nil
 case 4:return "labyrinth-4p-partners",nil
 default:return "",ErrInvalid
 }
}
func (labyrinthRules) VariantForSeats(room ClassicRoom,seats []ClassicSeat)(string,error){
 if room.GameID!="labyrinth-cribbage"||len(seats)!=room.SeatCount{return "",ErrInvalid}
 variants:=[]string{}
 switch room.SeatCount {
 case 2:variants=[]string{"labyrinth-2p"}
 case 3:variants=[]string{"labyrinth-3p"}
 case 4:variants=[]string{"labyrinth-4p-partners","labyrinth-4p-individual"}
 default:return "",ErrInvalid
 }
 for _,id:=range variants{
  v,_:=labyrinthVariantFor(room.SeatCount,id)
  valid:=true
  for i,seat:=range seats{
   if seat.Index!=i||seat.Team!=v.Teams[i]{valid=false;break}
  }
  if valid{return id,nil}
 }
 return "",ErrInvalid
}
func (r labyrinthRules) ValidateSeats(room ClassicRoom,seats []ClassicSeat)error{
 _,e:=r.VariantForSeats(room,seats);return e
}
func (labyrinthRules) Definition()RuleDefinition{
 return RuleDefinition{GameID:"labyrinth-cribbage",Version:"v1.0",
  Specification:labyrinthProductRuleset+";manifest-sha256="+labyrinthManifestSHA256+
   ";six-retained;six-crib;four-players-partners-or-individual;241;auto-count;no-muggins"}
}
func NewLabyrinthCribbageRulesAdapter()(*RulesAdapter,error){return NewRulesAdapter(labyrinthRules{})}
func (labyrinthRules) MaxReplayActions()int{return 8192}

func labyrinthFirstDealer(seed [32]byte,count int)(int,error){
 candidates:=make([]int,count)
 for i:=range candidates{candidates[i]=i}
 for attempt:=0;attempt<64;attempt++{
  pack,e:=cribbageShuffle(seed,"lab-cut-"+strconv.Itoa(attempt));if e!=nil{return 0,e}
  minRank:=14;low:=[]int{}
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
func labyrinthFreshRound(seed [32]byte,f *RuleFrame,d *cribbageData)error{
 v,e:=labyrinthVariantFor(f.SeatCount,f.Variant);if e!=nil{return e}
 deck,e:=cribbageShuffle(seed,"lab-deal-"+strconv.Itoa(f.Round));if e!=nil{return e}
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
func (r labyrinthRules) Initial(seed [32]byte,count int,b *RuleBudget)(RuleFrame,error){
 variant,e:=r.DefaultVariant(count);if e!=nil{return RuleFrame{},e}
 return r.InitialVariant(seed,count,variant,b)
}
func (labyrinthRules) InitialVariant(seed [32]byte,count int,variant string,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(52);e!=nil{return RuleFrame{},e}
 if _,e:=labyrinthVariantFor(count,variant);e!=nil{return RuleFrame{},e}
 dealer,e:=labyrinthFirstDealer(seed,count);if e!=nil{return RuleFrame{},e}
 f:=RuleFrame{SeatCount:count,Round:1,Variant:variant,Scores:make([]int64,count)}
 d:=cribbageData{Dealer:dealer}
 if e=labyrinthFreshRound(seed,&f,&d);e!=nil{return RuleFrame{},e}
 f.Data,e=json.Marshal(d)
 return f,e
}

func (labyrinthRules) Legal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(2);e!=nil{return nil,e}
 if f.Terminal||f.Turn!=seat{return nil,ErrForbidden}
 d,e:=cribbageDecode(f);if e!=nil{return nil,e}
 v,_:=labyrinthVariantFor(f.SeatCount,f.Variant)
 out:=[]json.RawMessage{}
 switch d.Stage{
 case "discard":
  hand:=d.Hands[seat]
  if v.Discard==1{
   for _,card:=range hand{out=append(out,cribbageJsonAction(cribbageMove{Type:"discard",Cards:[]int{card}}))}
  }else if v.Discard==2{
   for i:=0;i<len(hand);i++{for j:=i+1;j<len(hand);j++{
    out=append(out,cribbageJsonAction(cribbageMove{Type:"discard",Cards:[]int{hand[i],hand[j]}}))
   }}
  }else if v.Discard==3{
   for i:=0;i<len(hand);i++{for j:=i+1;j<len(hand);j++{for k:=j+1;k<len(hand);k++{
    out=append(out,cribbageJsonAction(cribbageMove{Type:"discard",Cards:[]int{hand[i],hand[j],hand[k]}}))
   }}}
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

func labyrinthClassify(score int64)string{
 if score<=120{return "double-skunk"}
 if score<=180{return "skunk"}
 return "ordinary"
}
func labyrinthScore(f *RuleFrame,d *cribbageData,seat,points int,kind string){
 if points<=0||f.Terminal{return}
 v,_:=labyrinthVariantFor(f.SeatCount,f.Variant)
 team:=v.Teams[seat]
 for i,t:=range v.Teams{if t==team{f.Scores[i]+=int64(points)}}
 d.Awards=append(d.Awards,cribbageAward{Seat:seat,Team:team,Kind:kind,Points:points,Count:d.Count,Total:f.Scores[seat]})
 if f.Scores[seat]<241{return}
 f.Terminal=true;f.Turn=-1;f.Phase="finished"
 winner:=seat;f.Winner=&winner
 seen:=map[int]bool{team:true}
 d.Losers=[]cribbageLoss{}
 for i,t:=range v.Teams{
  if seen[t]{continue};seen[t]=true
  d.Losers=append(d.Losers,cribbageLoss{Team:t,Score:f.Scores[i],Classification:labyrinthClassify(f.Scores[i])})
 }
}

func labyrinthCountShow(hand []int,starter int,isCrib bool)(cribbageComponents,error){
 if len(hand)!=6||starter<0||starter>=52{return cribbageComponents{},ErrInvalid}
 all:=append(append([]int(nil),hand...),starter)
 if !cribbageValidCards(all){return cribbageComponents{},ErrInvalid}
 var s cribbageComponents
 for mask:=1;mask<128;mask++{
  if bits.OnesCount(uint(mask))<2{continue}
  value:=0
  for i,c:=range all{if mask&(1<<i)!=0{value+=cribbagePips(c)}}
  if value==15{s.Fifteens+=2}
 }
 for i:=0;i<7;i++{for j:=i+1;j<7;j++{
  if cribbageRank(all[i])==cribbageRank(all[j]){s.Pairs+=2}
 }}
 for length:=7;length>=3;length--{
  runScore:=0
  for mask:=1;mask<128;mask++{
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
  if cribbageSuit(starter)==cribbageSuit(hand[0]){s.Flush=7
  }else if !isCrib{s.Flush=6}
 }
 for _,c:=range hand{if cribbageRank(c)==11&&cribbageSuit(c)==cribbageSuit(starter){s.Nobs++}}
 s.Total=s.Fifteens+s.Pairs+s.Runs+s.Flush+s.Nobs
 return s,nil
}

func labyrinthShowAndDeal(f *RuleFrame,d *cribbageData)error{
 d.Stage="show";d.LastShow=[]cribbageShow{}
 for i:=1;i<=f.SeatCount+1;i++{
  seat:=(d.Dealer+i)%f.SeatCount
  isCrib:=i==f.SeatCount+1
  if isCrib{seat=d.Dealer}
  cards:=d.Kept[seat]
  if isCrib{cards=d.Crib}
  score,e:=labyrinthCountShow(cards,d.Starter,isCrib);if e!=nil{return e}
  d.LastShow=append(d.LastShow,cribbageShow{Seat:seat,IsCrib:isCrib,
   Cards:append([]int(nil),cards...),Starter:d.Starter,Score:score})
  kind:="hand";if isCrib{kind="crib"}
  labyrinthScore(f,d,seat,score.Total,kind)
  if f.Terminal{return nil}
 }
 f.Round++;d.Dealer=(d.Dealer+1)%f.SeatCount
 seedBytes,e:=hex.DecodeString(f.Seed);if e!=nil||len(seedBytes)!=32{return ErrUnavailable}
 var seed [32]byte;copy(seed[:],seedBytes)
 return labyrinthFreshRound(seed,f,d)
}
func labyrinthFinishPeg(f *RuleFrame,d *cribbageData,previousCount int)error{
 if previousCount!=31{labyrinthScore(f,d,d.Last,1,"last-card");if f.Terminal{return nil}}
 return labyrinthShowAndDeal(f,d)
}
func labyrinthAdvancePeg(f *RuleFrame,d *cribbageData,after int)error{
 if cribbageAllPlayed(*d){return labyrinthShowAndDeal(f,d)}
 next:=cribbageNextActive(*d,after)
 if next>=0{f.Turn=next;return nil}
 // All unplayed seats already declared Go. The last *player to lay*
 // receives precisely one point for the whole sequence.
 last:=d.Last
 labyrinthScore(f,d,last,1,"go")
 if f.Terminal{return nil}
 cribbageReset(d)
 f.Turn=cribbageNextActive(*d,last)
 if f.Turn<0{return ErrUnavailable}
 return nil
}
func (labyrinthRules) Step(f RuleFrame,seat int,move json.RawMessage,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(24);e!=nil{return RuleFrame{},e}
 if f.Terminal||f.Turn!=seat{return RuleFrame{},ErrForbidden}
 var m cribbageMove
 if !strictRuleJSON(move,&m){return RuleFrame{},ErrInvalid}
 d,e:=cribbageDecode(f);if e!=nil{return RuleFrame{},e}
 v,_:=labyrinthVariantFor(f.SeatCount,f.Variant)
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
  if m.Type!="cut"||m.Card!=nil||len(m.Cards)!=0||len(d.Crib)!=6||d.Drawn>=52{return RuleFrame{},ErrInvalid}
  d.Starter=d.Deck[d.Drawn];d.Drawn++
  d.Stage="peg";f.Phase="peg";f.Turn=(d.Dealer+1)%f.SeatCount
  if cribbageRank(d.Starter)==11{labyrinthScore(&f,&d,d.Dealer,2,"heels")}
 case "peg":
  if m.Type=="play"{
   if m.Card==nil||len(m.Cards)>0||cribbagePips(*m.Card)+d.Count>31{return RuleFrame{},ErrInvalid}
   var found bool
   d.Remaining[seat],found=cribbageRemove(d.Remaining[seat],*m.Card)
   if !found{return RuleFrame{},ErrInvalid}
   d.Played[seat]=append(d.Played[seat],*m.Card)
   d.Pile=append(d.Pile,*m.Card);d.Count+=cribbagePips(*m.Card);d.Last=seat
   kind,points:=cribbagePegPoints(d.Pile,d.Count)
   labyrinthScore(&f,&d,seat,points,kind)
   if f.Terminal{break}
   if d.Count==31{
    cribbageReset(&d)
    if cribbageAllPlayed(d){e=labyrinthShowAndDeal(&f,&d)}else{
     f.Turn=cribbageNextActive(d,seat)
     if f.Turn<0{e=ErrUnavailable}
    }
   }else if cribbageAllPlayed(d){
    e=labyrinthFinishPeg(&f,&d,d.Count)
   }else{e=labyrinthAdvancePeg(&f,&d,seat)}
  }else if m.Type=="go"{
   if m.Card!=nil||len(m.Cards)>0||cribbageCanPlay(d,seat)||len(d.Remaining[seat])==0{return RuleFrame{},ErrInvalid}
   d.Go[seat]=true
   e=labyrinthAdvancePeg(&f,&d,seat)
  }else{return RuleFrame{},ErrInvalid}
 default:return RuleFrame{},ErrInvalid
 }
 if e!=nil{return RuleFrame{},e}
 f.Data,e=json.Marshal(d)
 return f,e
}
func (labyrinthRules) Validate(f RuleFrame)error{
 v,e:=labyrinthVariantFor(f.SeatCount,f.Variant);if e!=nil{return e}
 d,e:=cribbageDecode(f);if e!=nil{return e}
 if d.Variant!=v.ID||f.Variant!=v.ID||d.Dealer<0||d.Dealer>=f.SeatCount||
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
 dealer,e:=labyrinthFirstDealer(seed,f.SeatCount);if e!=nil{return e}
 if d.Dealer!=(dealer+f.Round-1)%f.SeatCount{return ErrInvalid}
 deck,e:=cribbageShuffle(seed,"lab-deal-"+strconv.Itoa(f.Round));if e!=nil{return e}
 for i:=range deck{if d.Deck[i]!=deck[i]{return ErrInvalid}}
 for i,team:=range v.Teams{for j,other:=range v.Teams{
  if team==other&&f.Scores[i]!=f.Scores[j]{return ErrInvalid}
 }}
 sawWin:=false
 for _,score:=range f.Scores{if score<0{return ErrInvalid};if score>=241{sawWin=true}}
 if f.Terminal!=sawWin||f.Terminal!=(f.Phase=="finished")||
  (f.Terminal&&f.Winner==nil)||(f.Terminal&&(f.Scores[*f.Winner]<241))||
  (!f.Terminal&&f.Winner!=nil){return ErrInvalid}
 if !f.Terminal&&len(d.Losers)!=0{return ErrInvalid}
 if !f.Terminal&&(f.Phase!=d.Stage||f.Turn<0){return ErrInvalid}
 if f.Terminal&&d.Stage!="peg"&&d.Stage!="show"{return ErrInvalid}
 for _,g:=range d.LastShow{
  if g.Seat<0||g.Seat>=f.SeatCount||len(g.Cards)!=6{return ErrInvalid}
  score,err:=labyrinthCountShow(g.Cards,g.Starter,g.IsCrib)
  if err!=nil||score!=g.Score{return ErrInvalid}
 }
 for _,a:=range d.Awards{
  if a.Seat<0||a.Seat>=f.SeatCount||a.Team!=v.Teams[a.Seat]||a.Points<1||a.Points>128||a.Count<0||a.Count>31||a.Kind==""||a.Total<1{return ErrInvalid}
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
   len(d.Crib)!=6||!consume(d.Crib)||!consume([]int{d.Starter})||!cribbageAllDiscarded(d){return ErrInvalid}
  for i:=0;i<f.SeatCount;i++{
   if len(d.Hands[i])!=6||!cribbageSameCards(d.Hands[i],d.Kept[i])||
    len(d.Remaining[i])+len(d.Played[i])!=6{return ErrInvalid}
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
   if l.Team<0||l.Team>=f.SeatCount||groups[l.Team]||l.Score<0||l.Score>=241||l.Classification!=labyrinthClassify(l.Score){return ErrInvalid}
   groups[l.Team]=true
  }
  if len(groups)!=func()int{m:=map[int]bool{};for _,t:=range v.Teams{m[t]=true};return len(m)}(){return ErrInvalid}
 }
 return nil
}
func (labyrinthRules) View(f RuleFrame,seat int)(json.RawMessage,error){
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
 }{GameID:"labyrinth-cribbage",Variant:d.Variant,Round:f.Round,Phase:f.Phase,
  Dealer:d.Dealer,Turn:f.Turn,Seat:seat,Scores:f.Scores,
  Hand:hand,CardCounts:publicCounts,CribCount:len(d.Crib),
  Discarded:d.Discarded,Starter:d.Starter,PegCount:d.Count,PegPile:pegPile,Pegged:pegged,
  SaidGo:d.Go,LastShow:lastShow,LastAwards:lastAwards,Losers:losers,Winner:f.Winner}
 raw,e:=json.Marshal(view)
 if e!=nil||len(raw)>classicMaxActionBytes{return nil,ErrUnavailable}
 return raw,nil
}

var _ RuleModule=labyrinthRules{}
var _ RuleVariantModule=labyrinthRules{}
var _ RuleSeatPolicy=labyrinthRules{}
