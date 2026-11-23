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

func labSeed(n byte)[32]byte{var seed [32]byte;for i:=range seed{seed[i]=byte(int(n)+i*13)};return seed}
func labAdapter(t *testing.T)*RulesAdapter{
 t.Helper();a,e:=NewLabyrinthCribbageRulesAdapter();if e!=nil{t.Fatal(e)};return a
}
func labSeats(n int,format string)[]ClassicSeat{
 seats:=make([]ClassicSeat,n)
 for i:=range seats{
  seats[i]=ClassicSeat{Index:i,Team:classicRoomTeam("labyrinth-cribbage",n,i,format),
   Controller:"human",Subject:[]string{
    "10000000-1111-4111-8111-111111111111",
    "20000000-2222-4222-8222-222222222222",
    "30000000-3333-4333-8333-333333333333",
    "40000000-4444-4444-8444-444444444444",
   }[i]}
 }
 return seats
}
func TestBC22ManifestAndImmutableRoomVariants(t *testing.T){
 raw,e:=os.ReadFile("../../docs/games/classics/BC-2-1-LABYRINTH-CRIBBAGE-VARIANTS.json")
 if e!=nil{t.Fatal(e)}
 digest:=sha256.Sum256(raw)
 if hex.EncodeToString(digest[:])!=labyrinthManifestSHA256{t.Fatal("manifest changed without independent engine requalification")}
 a:=labAdapter(t)
 if a.definition.GameID!="labyrinth-cribbage"||a.definition.Version!="v2.0"||
 !strings.Contains(a.definition.Specification,labyrinthProductRuleset){t.Fatal(a.definition)}
 scenarios:=[]struct{n int;format,id string;deal,discard,extra int;teams []int}{
  {2,"","labyrinth-2p",9,3,0,[]int{0,1}},
  {3,"","labyrinth-3p",8,2,0,[]int{0,1,2}},
  {4,"","labyrinth-4p-partners",7,1,2,[]int{0,1,0,1}},
  {4,"individual","labyrinth-4p-individual",7,1,2,[]int{0,1,2,3}},
 }
 for _,c:=range scenarios{
  v,e:=labyrinthVariantFor(c.n,c.id)
  if e!=nil||v.Deal!=c.deal||v.Discard!=c.discard||v.Extra!=c.extra{t.Fatal("wrong deal structure",c,e,v)}
  room:=ClassicRoom{GameID:"labyrinth-cribbage",SeatCount:c.n}
  seats:=labSeats(c.n,c.format)
  for i,seat:=range seats{if seat.Team!=c.teams[i]{t.Fatal("team identity mismatch",c.id,seat)}}
  variant,e:=(labyrinthRules{}).VariantForSeats(room,seats)
  if e!=nil||variant!=c.id{t.Fatal("room-sealed variant",c.id,variant,e)}
  seed:=labSeed(byte(22+c.n))
  raw,turn,e:=a.InitialWithSeed(seed,room,seats)
  if e!=nil{t.Fatal(c.id,e)}
  f,e:=a.decode(raw);if e!=nil{t.Fatal(e)}
  d,e:=cribbageDecode(f);if e!=nil{t.Fatal(e)}
  if f.Variant!=c.id||d.Variant!=c.id||len(d.Crib)!=c.extra||len(d.Hands)!=c.n||
   turn!=(d.Dealer+1)%c.n||f.Round!=1{t.Fatal("bad sealed initial",c.id)}
  for _,hand:=range d.Hands{if len(hand)!=c.deal{t.Fatal("wrong cards dealt",c.id)}}
  if d.Drawn!=c.deal*c.n+c.extra{t.Fatal("draw count mismatch",c.id)}
  count:=0;for _,card:=range d.Crib{if card<0||card>=52{t.Fatal("bad crib",card)};count++}
  if count!=c.extra{t.Fatal("extra crib cards incorrectly dealt",c.id)}
  again,_,e:=a.InitialWithSeed(seed,room,seats)
  if e!=nil||!bytes.Equal(raw,again){t.Fatal("nondeterministic initial",c.id,e)}
  legal,e:=a.LegalActions(raw,f.Turn)
  if e!=nil||len(legal)!=func()int{switch c.discard{case 3:return 84;case 2:return 28;default:return 7}}(){
   t.Fatal("incorrect legal discard combinations",c.id,len(legal),e)
  }
  if len(legal)>maxRulesLegal{t.Fatal("action bound exceeded")}
  if _,_,_,_,e=a.Apply(raw,(f.Turn+1)%c.n,legal[0]);e==nil{t.Fatal("out-of-turn accepted")}
  if _,_,_,_,e=a.Apply(raw,f.Turn,json.RawMessage(`{"type":"discard","cards":[1,1,1]}`));e==nil{t.Fatal("invalid discard accepted")}
  // The variant cannot change after initial selection, even if the JSON is otherwise well formed.
  forged:=f;forged.Variant="labyrinth-4p-individual"
  tampered,_:=json.Marshal(forged)
  if c.id!="labyrinth-4p-individual"&&a.ValidateSaved(tampered)==nil{t.Fatal("unsealed variant accepted",c.id)}
  for seat:=0;seat<c.n;seat++{
   view,e:=a.View(raw,seat);if e!=nil{t.Fatal("seat-private projection",e)}
   for _,secret:=range []string{`"deck"`,`"seed"`,`"crib"`,`"kept"`,`"allHands"`,f.Seed}{
    if bytes.Contains(view,[]byte(secret)){t.Fatal("hidden state leaked",seat,secret)}
   }
   var seatView struct{Hand []int `json:"hand"`;Variant string `json:"variant"`;Seat int `json:"seat"`}
   if json.Unmarshal(view,&seatView)!=nil||seatView.Variant!=c.id||seatView.Seat!=seat||len(seatView.Hand)!=c.deal{
    t.Fatal("incorrect personal view",c.id,seat,string(view))
   }
  }
 }
 if _,e:=labyrinthVariantFor(4,"labyrinth-2p");e==nil{t.Fatal("cross-count variant accepted")}
 if _,e:=(labyrinthRules{}).VariantForSeats(ClassicRoom{GameID:"labyrinth-cribbage",SeatCount:4},
  []ClassicSeat{{Index:0,Team:0},{Index:1,Team:1},{Index:2,Team:2},{Index:3,Team:1}});e==nil{
  t.Fatal("unapproved seat pattern accepted")
 }
 if classicRoomTeam("labyrinth-cribbage",4,2,"")!=0||
  classicRoomTeam("labyrinth-cribbage",4,2,"individual")!=2{t.Fatal("wrong default team")}
 if classicRoomTeam("cribbage",4,2,"")!=0{t.Fatal("BC-1 team regression")}
}
func TestBC22SevenCardShowFlushRunsAndPegging(t *testing.T){
 total,e:=labyrinthCountShow([]int{0,1,2,3,4,5},6,false)
 if e!=nil||total.Fifteens!=16||total.Runs!=7||total.Flush!=7||total.Total!=30{t.Fatal("7-card run/fifteens",total,e)}
 nonmatch,e:=labyrinthCountShow([]int{0,1,2,3,4,5},13,false)
 if e!=nil||nonmatch.Flush!=6{t.Fatal("hand six flush",nonmatch,e)}
 crib,e:=labyrinthCountShow([]int{0,1,2,3,4,5},13,true)
 if e!=nil||crib.Flush!=0{t.Fatal("crib needs seventh suit",crib,e)}
 crib,e=labyrinthCountShow([]int{0,1,2,3,4,5},6,true)
 if e!=nil||crib.Flush!=7{t.Fatal("seven-suit crib",crib,e)}
 five,e:=labyrinthCountShow([]int{0,1,2,3,4,13},6,false)
 if e!=nil||five.Flush!=0{t.Fatal("five-suit pseudo flush",five,e)}
 multiples,e:=labyrinthCountShow([]int{2,15,28,3,16,43},7,false)
 if e!=nil||multiples.Runs!=18{t.Fatal("multiplicity in 7 cards",multiples,e)}
 if _,e:=labyrinthCountShow([]int{0,1,2,3,4,5},5,false);e==nil{t.Fatal("duplicate starter accepted")}
 if _,e:=labyrinthCountShow([]int{0,1,2,3,4},5,false);e==nil{t.Fatal("5-card count accepted")}
 if labyrinthClassify(162)!="double-skunk"||labyrinthClassify(163)!="skunk"||
 labyrinthClassify(243)!="skunk"||labyrinthClassify(244)!="ordinary"{t.Fatal("wrong 325 skunk thresholds")}
 if _,n:=cribbagePegPoints([]int{0,1,2,3,4},15);n!=7{t.Fatal("15 plus 5-run scoring")}
 standard,e:=cribbageCountShow([]int{4,17,30,49},43,false)
 if e!=nil||standard.Total!=29{t.Fatal("standard 121 counting was modified",standard,e)}
}
func TestBC22DeterministicFullGamesAndSealedReplay(t *testing.T){
 a:=labAdapter(t)
 scenarios:=[]struct{count int;variant string}{
  {2,"labyrinth-2p"},{3,"labyrinth-3p"},{4,"labyrinth-4p-partners"},{4,"labyrinth-4p-individual"},
 }
 for i,c:=range scenarios{t.Run(c.variant,func(t *testing.T){
  seed:=labSeed(byte(70+i))
  state,e:=a.initialConfigured(seed,c.count,c.variant);if e!=nil{t.Fatal(e)}
  trace:=[]RuleTrace{}
  shows,cuts,pegs:=0,0,0
  for step:=0;step<2500;step++{
   frame,e:=a.decode(state);if e!=nil{t.Fatal("invalid saved state",step,e)}
   if frame.Terminal{
    if frame.Winner==nil||frame.Scores[*frame.Winner]<325{t.Fatal("invalid winner")}
    final,e:=a.ReplayConfigured(seed,c.count,c.variant,trace)
    if e!=nil||!bytes.Equal(state,final){t.Fatal("full cold replay mismatch",e)}
    if c.variant=="labyrinth-4p-individual"{
     if _,e=a.Replay(seed,c.count,trace);e==nil{t.Fatal("individual history reinterpreted as partnership")}
    }
    if _,e:=a.LegalActions(state,*frame.Winner);e==nil{t.Fatal("terminal move enumeration")}
    if shows==0||cuts==0||pegs==0{t.Fatal("no whole-round qualification",shows,cuts,pegs)}
    corrupted:=append([]RuleTrace(nil),trace...)
    corrupted[0].AfterHash=strings.Repeat("0",64)
    if _,e=a.ReplayConfigured(seed,c.count,c.variant,corrupted);e==nil{t.Fatal("forged trace admitted")}
    t.Logf("qualified %s: rounds=%d, moves=%d, winner=%d, scores=%v",c.variant,frame.Round,len(trace),*frame.Winner,frame.Scores)
    return
   }
   legal,e:=a.LegalActions(state,frame.Turn)
   if e!=nil||len(legal)==0||len(legal)>maxRulesLegal{t.Fatal("illegal legal set",step,e)}
   var move cribbageMove
   if !strictRuleJSON(legal[0],&move){t.Fatal("malformed legal action")}
   if move.Type=="cut"{cuts++}
   if move.Type=="play"{pegs++}
   before:=state
   next,turn,terminal,winner,e:=a.Apply(state,frame.Turn,legal[0])
   if e!=nil{t.Fatalf("step %d: %v",step,e)}
   updated,e:=a.decode(next);if e!=nil||updated.Turn!=turn||updated.Terminal!=terminal||
    (winner==nil)!=(updated.Winner==nil){t.Fatal("adapter transition mismatch",e)}
   d,e:=cribbageDecode(updated);if e!=nil{t.Fatal(e)}
   if len(d.LastShow)>0{shows++}
   trace=append(trace,RuleTrace{Sequence:int64(len(trace)+2),Seat:frame.Turn,Action:legal[0],
    BeforeHash:RuleHash(before),AfterHash:RuleHash(next)})
   state=next
  }
  t.Fatal("325-point match exceeded bounded replay actions")
 })}
}
func TestBC22HeelsCanImmediatelyWin325(t *testing.T){
 a:=labAdapter(t)
 for n:=0;n<180;n++{
  seed:=labSeed(byte(n))
  state,e:=a.initial(seed,2);if e!=nil{t.Fatal(e)}
  for i:=0;i<2;i++{
   frame,e:=a.decode(state);if e!=nil{t.Fatal(e)}
   legal,e:=a.LegalActions(state,frame.Turn);if e!=nil{t.Fatal(e)}
   state,_,_,_,e=a.Apply(state,frame.Turn,legal[0]);if e!=nil{t.Fatal(e)}
  }
  frame,e:=a.decode(state);if e!=nil{t.Fatal(e)}
  data,e:=cribbageDecode(frame);if e!=nil{t.Fatal(e)}
  if frame.Phase!="cut"||data.Drawn>=52{t.Fatal("cut unavailable")}
  if cribbageRank(data.Deck[data.Drawn])!=11{continue}
  frame.Scores[data.Dealer]=323
  raw,_:=json.Marshal(frame)
  next,_,done,winner,e:=a.Apply(raw,frame.Turn,json.RawMessage(`{"type":"cut"}`))
  if e!=nil||!done||winner==nil||*winner!=data.Dealer{t.Fatal("heels failed to stop at 325",e)}
  terminal,e:=a.decode(next);if e!=nil||terminal.Scores[data.Dealer]!=325{t.Fatal("heels awarded incorrectly",e)}
  return
 }
 t.Fatal("no deterministic Jack-starter fixture found")
}
