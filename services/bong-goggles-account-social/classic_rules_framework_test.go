package social

import (
 "bytes"
 "encoding/hex"
 "encoding/json"
 "testing"
)

const bc07Spec="TEST ONLY deterministic two-player four-action rounds and scores contract, not actual Chess rules"
type bc07FixtureModule struct{}
type bc07Data struct{
 Step int `json:"step"`
 Private0 uint64 `json:"private0"`
 Private1 uint64 `json:"private1"`
}
type bc07Take struct{Take int `json:"take"`}
func (bc07FixtureModule)Definition()RuleDefinition{
 return RuleDefinition{GameID:"chess",Version:"v1.0",Specification:bc07Spec}
}
func bc07Deal(seed [32]byte)(bc07Data,error){
 random:=&RuleRandom{Seed:seed,Domain:"test-only-private-v1"}
 a,e:=random.Intn(100000);if e!=nil{return bc07Data{},e}
 b,e:=random.Intn(100000);if e!=nil{return bc07Data{},e}
 return bc07Data{Private0:a,Private1:b},nil
}
func (bc07FixtureModule)Initial(seed [32]byte,count int,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(4);e!=nil{return RuleFrame{},e}
 if count!=2{return RuleFrame{},ErrInvalid}
 data,e:=bc07Deal(seed);if e!=nil{return RuleFrame{},e}
 raw,e:=json.Marshal(data);if e!=nil{return RuleFrame{},e}
 return RuleFrame{SeatCount:2,Round:1,Phase:"playing",Turn:0,
  Scores:[]int64{0,0},Data:raw},nil
}
func (bc07FixtureModule)Validate(f RuleFrame)error{
 if f.SeatCount!=2||len(f.Scores)!=2||f.Round<1||f.Round>3{return ErrInvalid}
 var data bc07Data
 if !strictRuleJSON(f.Data,&data)||data.Step<0||data.Step>4{return ErrInvalid}
 if f.Round!=1+data.Step/2{return ErrInvalid}
 seed,e:=CanonicalRuleSeed(func()json.RawMessage{
  raw,_:=json.Marshal(f);return raw
 }());if e!=nil{return ErrInvalid}
 original,e:=bc07Deal(seed);if e!=nil||data.Private0!=original.Private0||data.Private1!=original.Private1{return ErrInvalid}
 if f.Terminal{
  if data.Step!=4||f.Turn!=-1||f.Phase!="finished"{return ErrInvalid}
  var win *int
  if f.Scores[0]>f.Scores[1]{zero:=0;win=&zero}
  if f.Scores[1]>f.Scores[0]{one:=1;win=&one}
  if (f.Winner==nil)!=(win==nil){return ErrInvalid}
  if f.Winner!=nil&&*f.Winner!=*win{return ErrInvalid}
 }else if f.Turn!=data.Step%2||f.Phase!="playing"||data.Step==4||f.Winner!=nil{return ErrInvalid}
 return nil
}
func (bc07FixtureModule)Legal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(2);e!=nil{return nil,e}
 if f.Terminal||f.Turn!=seat{return nil,ErrForbidden}
 return []json.RawMessage{json.RawMessage(`{"take":1}`),json.RawMessage(`{"take":2}`)},nil
}
func (bc07FixtureModule)Step(f RuleFrame,seat int,move json.RawMessage,b *RuleBudget)(RuleFrame,error){
 if e:=b.Charge(5);e!=nil{return RuleFrame{},e}
 if f.Terminal||f.Turn!=seat{return RuleFrame{},ErrForbidden}
 var action bc07Take
 if !strictRuleJSON(move,&action)||(action.Take!=1&&action.Take!=2){return RuleFrame{},ErrInvalid}
 var data bc07Data
 if !strictRuleJSON(f.Data,&data){return RuleFrame{},ErrInvalid}
 data.Step++
 f.Scores=append([]int64(nil),f.Scores...)
 f.Scores[seat]+=int64(action.Take)
 f.Round=1+data.Step/2
 if data.Step==4{
  f.Terminal=true;f.Turn=-1;f.Phase="finished"
  if f.Scores[0]>f.Scores[1]{x:=0;f.Winner=&x
  }else if f.Scores[1]>f.Scores[0]{x:=1;f.Winner=&x}
 }else{f.Turn=1-seat}
 raw,e:=json.Marshal(data);if e!=nil{return RuleFrame{},e}
 f.Data=raw
 return f,nil
}
func (bc07FixtureModule)View(f RuleFrame,seat int)(json.RawMessage,error){
 if seat<0||seat>=2{return nil,ErrForbidden}
 var data bc07Data
 if !strictRuleJSON(f.Data,&data){return nil,ErrInvalid}
 mine:=data.Private0;if seat==1{mine=data.Private1}
 return json.Marshal(map[string]any{"round":f.Round,"phase":f.Phase,
  "turn":f.Turn,"scores":f.Scores,"terminal":f.Terminal,"mine":mine})
}
func bc07Adapter(t *testing.T)*RulesAdapter{
 t.Helper();a,e:=NewRulesAdapter(bc07FixtureModule{})
 if e!=nil{t.Fatal(e)};return a
}
func bc07Seed() [32]byte {
 var seed [32]byte
 for i:=range seed{seed[i]=byte(i+1)}
 return seed
}
func TestBC07DeterministicVersionedActionsRoundsScoresAndTie(t *testing.T){
 a:=bc07Adapter(t);seed:=bc07Seed()
 room:=ClassicRoom{GameID:"chess",SeatCount:2}
 seats:=[]ClassicSeat{{Index:0,Controller:"human",Subject:"11111111-1111-4111-8111-111111111111"},
  {Index:1,Controller:"human",Subject:"22222222-2222-4222-8222-222222222222"}}
 state,turn,e:=a.InitialWithSeed(seed,room,seats)
 if e!=nil||turn!=0{t.Fatal("invalid seeded initial",e,turn)}
 again,first,e:=a.InitialWithSeed(seed,room,seats)
 if e!=nil||first!=0||!bytes.Equal(state,again){t.Fatal("same-seed game diverged",e)}
 frame,e:=a.decode(state)
 if e!=nil||frame.Round!=1||frame.Phase!="playing"||frame.RulesHash!=a.hash||
  frame.Seed!=hex.EncodeToString(seed[:]){t.Fatal("initial codec mismatch",e)}
 trace:=[]RuleTrace{}
 for i,take:=range []int{2,1,2,1}{
  actor:=i%2
  legal,e:=a.LegalActions(state,actor);if e!=nil||len(legal)!=2{t.Fatal("legal actions",e)}
  move,_:=json.Marshal(bc07Take{Take:take})
  next,turn,terminal,winner,e:=a.Apply(state,actor,move)
  if e!=nil{t.Fatal("applied legal turn",e)}
  trace=append(trace,RuleTrace{Sequence:int64(i+2),Seat:actor,Action:move,
   BeforeHash:RuleHash(state),AfterHash:RuleHash(next)})
  state=next
  frame,e=a.decode(state);if e!=nil{t.Fatal(e)}
  if frame.Round!=1+(i+1)/2{t.Fatal("round progression",frame.Round)}
  if terminal!=(i==3){t.Fatal("terminal timing",i)}
  if i==3&&(winner==nil||*winner!=0||turn!=-1||frame.Scores[0]!=4||frame.Scores[1]!=2){t.Fatal("scoring or winner",frame)}
 }
 recovered,e:=a.Replay(seed,2,trace)
 if e!=nil||!bytes.Equal(recovered,state){t.Fatal("full deterministic replay",e)}
 if _,_,_,_,e=a.Apply(state,0,json.RawMessage(`{"take":1}`));e==nil{t.Fatal("terminal accepted move")}
 // New match demonstrates a valid tie: no fabricated winner.
 state,_,e=a.InitialWithSeed(seed,room,seats);if e!=nil{t.Fatal(e)}
 for i:=0;i<4;i++{
  state,_,_,_,e=a.Apply(state,i%2,json.RawMessage(`{"take":1}`))
  if e!=nil{t.Fatal(e)}
 }
 final,e:=a.decode(state);if e!=nil||!final.Terminal||final.Winner!=nil{t.Fatal("tie was not valid",e)}
}
func TestBC07RejectMalformedUnknownDuplicateAndTamperedSavedState(t *testing.T){
 a:=bc07Adapter(t);seed:=bc07Seed();state,e:=a.initial(seed,2);if e!=nil{t.Fatal(e)}
 frame,_:=a.decode(state)
 if _,_,_,_,e=a.Apply(state,0,json.RawMessage(`{"take":1,"take":2}`));e==nil{t.Fatal("duplicate action key")}
 for _,bad:=range []string{`{"take":3}`,`{"take":1,"winner":0}`,
  `{"take":0}`,`{"take":null}`,`["take"]`,`null`}{
  if _,_,_,_,e=a.Apply(state,0,json.RawMessage(bad));e==nil{t.Fatal("illegal action",bad)}
 }
 for _,variant:=range []struct{name string;change func(*RuleFrame)}{
  {"wrong phase",func(f *RuleFrame){f.Phase="fraud"}},
  {"wrong version",func(f *RuleFrame){f.Version="v2.0"}},
  {"bad score",func(f *RuleFrame){f.Scores[0]=maxRuleScore+1}},
  {"wrong turn",func(f *RuleFrame){f.Turn=1}},
  {"forged round",func(f *RuleFrame){f.Round++}},
  {"corrupted seed",func(f *RuleFrame){f.Seed="not-a-seed"}},
  {"concealed deal",func(f *RuleFrame){f.Data=json.RawMessage(`{"step":0,"private0":123,"private1":123}`)}},
  {"winner before game end",func(f *RuleFrame){x:=1;f.Winner=&x}},
 }{
  altered:=frame;altered.Scores=append([]int64(nil),frame.Scores...);variant.change(&altered)
  raw,_:=json.Marshal(altered)
  if e=a.ValidateSaved(raw);e==nil{t.Fatal("accepted corrupted snapshot",variant.name)}
 }
 unknown:=append([]byte(state[:len(state)-1]),[]byte(`,"newField":true}`)...)
 if e=a.ValidateSaved(unknown);e==nil{t.Fatal("unknown persisted field")}
 if e=a.ValidateSaved(append([]byte(state),[]byte(" trailing")...));e==nil{t.Fatal("trailing data accepted")}
 if _,e:=NewRulesAdapter(nil);e==nil{t.Fatal("nil game rules accepted")}
}
func TestBC07PrivateViewsRandomReplayTamperingAndBudget(t *testing.T){
 a:=bc07Adapter(t);seed:=bc07Seed()
 state,e:=a.initial(seed,2);if e!=nil{t.Fatal(e)}
 aview,e:=a.View(state,0);if e!=nil{t.Fatal(e)}
 bview,e:=a.View(state,1);if e!=nil{t.Fatal(e)}
 frame,_:=a.decode(state)
 var hidden bc07Data
 if !strictRuleJSON(frame.Data,&hidden){t.Fatal("missing hidden data")}
 var memberView struct{Mine uint64 `json:"mine"`}
 if e=json.Unmarshal(aview,&memberView);e!=nil||memberView.Mine!=hidden.Private0{t.Fatal("wrong seat view",e)}
 if e=json.Unmarshal(bview,&memberView);e!=nil||memberView.Mine!=hidden.Private1{t.Fatal("opponent secret visible",e)}
 if bytes.Contains(aview,[]byte("private0"))||bytes.Contains(aview,[]byte("private1"))||
  bytes.Contains(bview,[]byte("private0")){t.Fatal("raw private state published")}
 move:=json.RawMessage(`{"take":2}`)
 next,_,_,_,e:=a.Apply(state,0,move);if e!=nil{t.Fatal(e)}
 trail:=[]RuleTrace{{Sequence:2,Seat:0,Action:move,BeforeHash:RuleHash(state),AfterHash:RuleHash(next)}}
 replay,e:=a.Replay(seed,2,trail);if e!=nil||!bytes.Equal(next,replay){t.Fatal("single move replay",e)}
 clone:=append([]RuleTrace(nil),trail...)
 clone[0].AfterHash=RuleHash(state)
 if _,e=a.Replay(seed,2,clone);e==nil{t.Fatal("mutated after hash accepted")}
 clone[0]=trail[0];clone[0].Action=json.RawMessage(`{"take":1}`)
 if _,e=a.Replay(seed,2,clone);e==nil{t.Fatal("mutated replay move accepted")}
 clone[0]=trail[0];clone[0].Seat=1
 if _,e=a.Replay(seed,2,clone);e==nil{t.Fatal("wrong turn replay accepted")}
 random1:=&RuleRandom{Seed:seed,Domain:"rule-public"}
 random2:=&RuleRandom{Seed:seed,Domain:"rule-public"}
 for i:=0;i<24;i++{
  x,e:=random1.Intn(7);if e!=nil{t.Fatal(e)}
  y,e:=random2.Intn(7);if e!=nil||x!=y||x>=7{t.Fatal("nonrepeatable/unbounded RNG")}
 }
 random3:=&RuleRandom{Seed:seed,Domain:"different-public"}
 x,_:=random3.Uint64()
 random4:=&RuleRandom{Seed:seed,Domain:"rule-public"}
 y,_:=random4.Uint64()
 if x==y{t.Fatal("domain separation ignored")}
 if _,e:=random4.Intn(0);e==nil{t.Fatal("zero random bound")}
 b:=NewRuleBudget(4)
 if e=b.Charge(3);e!=nil{t.Fatal(e)}
 if e=b.Charge(2);e==nil{t.Fatal("over-budget action accepted")}
}
type bc07Decision struct{bad bool;seen json.RawMessage}
func (p *bc07Decision)ChooseMove(view json.RawMessage,_ string,actions []json.RawMessage,b *RuleBudget)(json.RawMessage,error){
 p.seen=append(json.RawMessage(nil),view...)
 if e:=b.Charge(5);e!=nil{return nil,e}
 if p.bad{return json.RawMessage(`{"take":900}`),nil}
 return actions[0],nil
}
func TestBC07BotPolicyContractOnlySeesOwnViewAndReturnsLegalAction(t *testing.T){
 a:=bc07Adapter(t);state,e:=a.initial(bc07Seed(),2);if e!=nil{t.Fatal(e)}
 policy:=&bc07Decision{}
 move,e:=a.ChooseMove(state,0,"easy",policy)
 if e!=nil||!bytes.Equal(move,json.RawMessage(`{"take":1}`)){t.Fatal("legal policy decision",e)}
 if bytes.Contains(policy.seen,[]byte("private0"))||bytes.Contains(policy.seen,[]byte("private1")){t.Fatal("hidden state sent to policy")}
 policy.bad=true
 if _,e=a.ChooseMove(state,0,"medium",policy);e==nil{t.Fatal("illegal policy output accepted")}
 if _,e=a.ChooseMove(state,0,"legendary",policy);e==nil{t.Fatal("unsupported bot policy tier accepted")}
}
