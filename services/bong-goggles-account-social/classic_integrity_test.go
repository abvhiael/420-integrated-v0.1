package social

import (
 "bytes"
 "encoding/json"
 "strings"
 "sync/atomic"
 "testing"
 "time"
)

// A faulty compiled module may mutate slice/pointer arguments even when the
// language-level RuleFrame parameter was passed by value. Such mutation must
// never affect later validation, scoring, legal moves or the saved seed.
type bc11Mutator struct{bc07FixtureModule}
func (bc11Mutator)Validate(f RuleFrame)error{
 original:=cloneRuleFrame(f)
 f.Scores[0]=999999;f.Data[0]='!'
 return bc07FixtureModule{}.Validate(original)
}
func (bc11Mutator)Legal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 original:=cloneRuleFrame(f)
 f.Scores[0]=999999;f.Data[0]='!'
 return bc07FixtureModule{}.Legal(original,seat,b)
}
func (bc11Mutator)Step(f RuleFrame,seat int,action json.RawMessage,b *RuleBudget)(RuleFrame,error){
 original:=cloneRuleFrame(f)
 f.Scores[0]=999999;f.Data[0]='!'
 if len(action)>0{action[0]='!'}
 return bc07FixtureModule{}.Step(original,seat,json.RawMessage(`{"take":2}`),b)
}
func (bc11Mutator)View(f RuleFrame,seat int)(json.RawMessage,error){
 original:=cloneRuleFrame(f)
 f.Scores[0]=999999;f.Data[0]='!'
 return bc07FixtureModule{}.View(original,seat)
}

func TestBC11RuleCallbacksCannotMutateSavedStateOrUnauthorizedScore(t *testing.T){
 secure,e:=NewRulesAdapter(bc11Mutator{})
 if e!=nil{t.Fatal(e)}
 reference:=bc07Adapter(t)
 seed:=bc07Seed()
 original,e:=secure.initial(seed,2);if e!=nil{t.Fatal(e)}
 expected,e:=reference.initial(seed,2);if e!=nil||!bytes.Equal(original,expected){t.Fatal("mutating Validate rewrote initial state",e)}
 before:=append(json.RawMessage(nil),original...)
 action:=json.RawMessage(`{"take":2}`)
 next,_,_,_,e:=secure.Apply(original,0,action)
 if e!=nil{t.Fatal("legal action failed",e)}
 expectedNext,_,_,_,e:=reference.Apply(expected,0,json.RawMessage(`{"take":2}`))
 if e!=nil||!bytes.Equal(next,expectedNext){t.Fatal("mutating callbacks changed score or transition",e)}
 if !bytes.Equal(original,before)||!bytes.Equal(action,json.RawMessage(`{"take":2}`)){t.Fatal("module mutated the caller's persisted bytes or command")}
 var frame RuleFrame
 if json.Unmarshal(next,&frame)!=nil||frame.Scores[0]!=2||frame.Scores[1]!=0{t.Fatal("unauthorized score",frame.Scores)}
 view,e:=secure.View(original,0)
 if e!=nil||bytes.Contains(view,[]byte("999999")){t.Fatal("side effects escaped into private view",e,string(view))}
 if _,e=secure.Replay(seed,2,[]RuleTrace{{
  Sequence:3,Seat:0,Action:json.RawMessage(`{"take":2}`),
  BeforeHash:RuleHash(original),AfterHash:RuleHash(next),
 }});e==nil{t.Fatal("replay skipped a committed public sequence")}
}

type bc11LeakingView struct{bc07FixtureModule}
func (bc11LeakingView)View(f RuleFrame,seat int)(json.RawMessage,error){
 return json.Marshal(map[string]any{"seed":f.Seed,"opponentHand":f.Data})
}
type bc11VolatileView struct{bc07FixtureModule;counter atomic.Int64}
func (m *bc11VolatileView)View(_ RuleFrame,_ int)(json.RawMessage,error){
 return json.Marshal(map[string]any{"number":m.counter.Add(1)})
}
func TestBC11FailClosedSeedDisclosureAndNonDeterministicView(t *testing.T){
 a,e:=NewRulesAdapter(bc11LeakingView{});if e!=nil{t.Fatal(e)}
 state,e:=a.initial(bc07Seed(),2);if e!=nil{t.Fatal(e)}
 if view,e:=a.View(state,0);e==nil{t.Fatal("seed/opponent leak approved",string(view))}
 volatile,e:=NewRulesAdapter(&bc11VolatileView{});if e!=nil{t.Fatal(e)}
 state,e=volatile.initial(bc07Seed(),2);if e!=nil{t.Fatal(e)}
 if _,e=volatile.View(state,0);e==nil{t.Fatal("nondeterministic seat projection approved")}
}

func TestBC11PublicEventOnlyAcceptsServerLifecycleMetadata(t *testing.T){
 due:=time.Now().UTC();seat:=0
 rec:=classicSessionRecord{ClassicSession:ClassicSession{
  Status:"active",Sequence:1,SeatCount:2,TurnSeat:&seat,Deadline:&due}}
 valid:=ClassicSessionEvent{Sequence:1,Kind:"started",PublicState:classicPublicState(rec)}
 if !validClassicPublicEvent(valid,2){t.Fatal("server-authored start rejected")}
 cases:=[]struct{name string;edit func(*ClassicSessionEvent)}{
  {"extra private field",func(v *ClassicSessionEvent){v.PublicState=json.RawMessage(`{"status":"active","turnSeat":0,"deadline":"2026-11-22T00:00:00Z","winnerSeat":null,"finishedReason":"","hiddenCard":"secret"}`)}},
  {"duplicate field",func(v *ClassicSessionEvent){v.PublicState=json.RawMessage(`{"status":"active","status":"active","turnSeat":0,"deadline":"2026-11-22T00:00:00Z","winnerSeat":null,"finishedReason":""}`)}},
  {"client score",func(v *ClassicSessionEvent){v.PublicState=json.RawMessage(`{"status":"active","turnSeat":0,"deadline":"2026-11-22T00:00:00Z","winnerSeat":null,"finishedReason":"","score":999}`)}},
  {"actor impersonation",func(v *ClassicSessionEvent){n:=5;v.ActorSeat=&n}},
  {"invalid turn",func(v *ClassicSessionEvent){v.PublicState=json.RawMessage(`{"status":"active","turnSeat":7,"deadline":"2026-11-22T00:00:00Z","winnerSeat":null,"finishedReason":""}`)}},
  {"result during active turn",func(v *ClassicSessionEvent){v.PublicState=json.RawMessage(`{"status":"active","turnSeat":0,"deadline":"2026-11-22T00:00:00Z","winnerSeat":1,"finishedReason":""}`)}},
  {"missing start",func(v *ClassicSessionEvent){v.Kind="move"}},
 }
 for _,c:=range cases{
  event:=valid;c.edit(&event)
  if validClassicPublicEvent(event,2){t.Fatal("accepted forged public event",c.name)}
 }
 rec.Status="finished";rec.TurnSeat=nil;rec.Deadline=nil;rec.FinishedReason="completed"
 valid=ClassicSessionEvent{Sequence:2,Kind:"finished",PublicState:classicPublicState(rec)}
 if !validClassicPublicEvent(valid,2){t.Fatal("verified tie result rejected")}
 if strings.Contains(string(valid.PublicState),"hiddenCard"){t.Fatal("private state copied into public projection")}
}
