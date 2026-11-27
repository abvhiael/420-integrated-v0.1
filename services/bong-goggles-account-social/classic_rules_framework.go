package social

import (
 "errors"
 "bytes"
 "crypto/rand"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "regexp"
 "strings"
 "time"
)

// BC-0.7: trust-boundary contract for independently qualified rules modules.
// Modules are compiled/registered by the operator, never loaded from clients,
// user-generated JavaScript or untrusted network manifests.
type RuleDefinition struct {
 GameID string
 Version string
 Specification string
}
type RuleFrame struct {
 GameID string `json:"gameId"`
 Version string `json:"version"`
 RulesHash string `json:"rulesHash"`
 Variant string `json:"variant,omitempty"`
 Seed string `json:"seed"`
 SeatCount int `json:"seatCount"`
 Round int `json:"round"`
 Phase string `json:"phase"`
 Turn int `json:"turn"`
 Scores []int64 `json:"scores"`
 Terminal bool `json:"terminal"`
 Winner *int `json:"winner"`
 Data json.RawMessage `json:"data"`
}
// Optional sealed variant initialization. Seat configuration is persisted via
// immutable room team rows and the selected variant in RuleFrame/genesis.
type RuleVariantModule interface {
 DefaultVariant(seatCount int)(string,error)
 VariantForSeats(room ClassicRoom,seats []ClassicSeat)(string,error)
 InitialVariant(seed [32]byte,seatCount int,variant string,budget *RuleBudget)(RuleFrame,error)
}
type RuleSeatPolicy interface {
 ValidateSeats(room ClassicRoom,seats []ClassicSeat)error
}
// Non-default replay allowances are compiled into trusted operator modules.
type RuleReplayCapacity interface { MaxReplayActions()int }
// Only compiled chess modules may opt into larger bounded capacities and
// separately enumerated non-turn commands. Default modules retain their limits.
type RuleChessCapacity interface { ChessLegalCapacity() int; ChessDataCapacity() int }
type RuleChessNonTurn interface { NonTurnLegal(RuleFrame,int,*RuleBudget)([]json.RawMessage,error) }
// Word Salad placements are submitted, not exhaustively enumerated. Only the
// concrete trusted Word Salad module may use this path; all other games keep
// exact legal-list membership. Step still independently checks every move.
type wordSaladSubmittedAction interface {
 ValidateSubmitted(RuleFrame,int,json.RawMessage,*RuleBudget)error
}
type RuleModule interface {
 Definition() RuleDefinition
 Initial(seed [32]byte,seatCount int,budget *RuleBudget)(RuleFrame,error)
 Legal(frame RuleFrame,seat int,budget *RuleBudget)([]json.RawMessage,error)
 Step(frame RuleFrame,seat int,move json.RawMessage,budget *RuleBudget)(RuleFrame,error)
 Validate(frame RuleFrame)error
 View(frame RuleFrame,seat int)(json.RawMessage,error)
}
// Future BC-0.8 AI policies receive ONLY seat-visible information, legal
// actions and a deterministic compute budget. The engine never passes its
// hidden RuleFrame to a bot policy.
type RuleDecisionPolicy interface{
 ChooseMove(seatView json.RawMessage,difficulty string,legal []json.RawMessage,budget *RuleBudget)(json.RawMessage,error)
}
type RuleBudget struct{remaining int;spent int;deadline time.Time}
func NewRuleBudget(limit int)*RuleBudget{
 if limit<1||limit>100000{return &RuleBudget{}}
 return &RuleBudget{remaining:limit}
}
func (b *RuleBudget)expired()bool{return b!=nil&&!b.deadline.IsZero()&&!time.Now().Before(b.deadline)}
func (b *RuleBudget)Charge(cost int)error{
 if b==nil||cost<1||cost>b.remaining||(!b.deadline.IsZero()&&!time.Now().Before(b.deadline)){return ErrUnavailable}
 b.remaining-=cost;b.spent+=cost;return nil
}
const maxRulesLegal=128
const maxRulesMoves=512
const maxRulesAction=1024
const maxRulesSpec=4096
const maxRuleScore=int64(1_000_000_000)
var ruleVersionPattern=regexp.MustCompile(`^v[0-9]{1,4}(?:\.[0-9]{1,3})?$`)
var rulePhasePattern=regexp.MustCompile(`^[a-z][a-z0-9_-]{0,31}$`)
type RulesAdapter struct{module RuleModule;definition RuleDefinition;hash string}

// Module callbacks must never share mutable state with the trusted snapshot
// or with one another. A shallow Go struct copy still aliases scores, hidden
// JSON bytes and the winner pointer; always make a full boundary copy.
func cloneRuleFrame(frame RuleFrame)RuleFrame{
 out:=frame
 out.Scores=append([]int64(nil),frame.Scores...)
 out.Data=append(json.RawMessage(nil),frame.Data...)
 if frame.Winner!=nil{winner:=*frame.Winner;out.Winner=&winner}
 return out
}
func NewRulesAdapter(module RuleModule)(*RulesAdapter,error){
 if module==nil{return nil,ErrInvalid}
 d:=module.Definition()
 if _,ok:=classicSeatLimits[d.GameID];!ok||!ruleVersionPattern.MatchString(d.Version)||
  len(d.Specification)<16||len(d.Specification)>maxRulesSpec||
  strings.TrimSpace(d.Specification)!=d.Specification{
  return nil,ErrInvalid
 }
 h:=sha256.Sum256([]byte(d.GameID+string([]byte{10})+d.Version+string([]byte{10})+d.Specification))
 return &RulesAdapter{module:module,definition:d,hash:hex.EncodeToString(h[:])},nil
}
func (a *RulesAdapter)Identity()(string,string){return a.definition.Version,a.hash}
func deterministicSeed()([32]byte,error){var seed [32]byte;_,e:=rand.Read(seed[:]);return seed,e}
func (a *RulesAdapter)Initial(room ClassicRoom,seats []ClassicSeat)(json.RawMessage,int,error){
 seed,e:=deterministicSeed();if e!=nil{return nil,0,e}
 return a.InitialWithSeed(seed,room,seats)
}
func (a *RulesAdapter)InitialWithSeed(seed [32]byte,room ClassicRoom,seats []ClassicSeat)(json.RawMessage,int,error){
 if a==nil||room.GameID!=a.definition.GameID||len(seats)!=room.SeatCount||!classicSeatsValid(room.GameID,room.SeatCount){return nil,0,ErrInvalid}
 for i,s:=range seats{
  if s.Index!=i{return nil,0,ErrUnavailable}
  switch s.Controller{
  case "human":
   if !uuid.MatchString(s.Subject)||s.Difficulty!=""{return nil,0,ErrUnavailable}
  case "bot":
   if s.Subject!=""||!map[string]bool{"easy":true,"medium":true,"hard":true}[s.Difficulty]{return nil,0,ErrUnavailable}
  default:return nil,0,ErrUnavailable
  }
 }
 if seatPolicy,ok:=a.module.(RuleSeatPolicy);ok{
  if e:=seatPolicy.ValidateSeats(room,seats);e!=nil{return nil,0,ErrUnavailable}
 }
 variant:=""
 if configured,ok:=a.module.(RuleVariantModule);ok{
  selected,e:=configured.VariantForSeats(room,seats);if e!=nil{return nil,0,ErrInvalid}
  variant=selected
 }
 first,e:=a.initialConfigured(seed,room.SeatCount,variant)
 if e!=nil{return nil,0,e}
 return first,func()int{frame,_:=a.decode(first);return frame.Turn}(),nil
}
func (a *RulesAdapter)initial(seed [32]byte,count int)(json.RawMessage,error){
 variant:=""
 if configured,ok:=a.module.(RuleVariantModule);ok{
  var e error;variant,e=configured.DefaultVariant(count);if e!=nil{return nil,e}
 }
 return a.initialConfigured(seed,count,variant)
}
func (a *RulesAdapter)initialConfigured(seed [32]byte,count int,variant string)(json.RawMessage,error){
 if count<2||count>4{return nil,ErrInvalid}
 configured,hasVariants:=a.module.(RuleVariantModule)
 if !hasVariants&&variant!=""{return nil,ErrInvalid}
 run:=func()(json.RawMessage,error){
  budget:=NewRuleBudget(100000)
  var frame RuleFrame;var e error
  if hasVariants{frame,e=configured.InitialVariant(seed,count,variant,budget)
  }else{frame,e=a.module.Initial(seed,count,budget)}
  if e!=nil||budget.spent<1||frame.Variant!=variant{return nil,ErrUnavailable}
  frame.GameID=a.definition.GameID;frame.Version=a.definition.Version;frame.RulesHash=a.hash
  frame.Seed=hex.EncodeToString(seed[:])
  if frame.Round!=1||frame.Terminal||frame.Winner!=nil||frame.SeatCount!=count{return nil,ErrUnavailable}
  return a.encode(frame)
 }
 x,e:=run();if e!=nil{return nil,e}
 y,e:=run();if e!=nil||!bytes.Equal(x,y){return nil,ErrUnavailable}
 return x,nil
}
func (a *RulesAdapter) legalCapacity() int {
 if a.definition.GameID=="chess" {if c,ok:=a.module.(RuleChessCapacity);ok {if n:=c.ChessLegalCapacity();n>=maxRulesLegal&&n<=1024{return n}}}
 return maxRulesLegal
}
func (a *RulesAdapter) dataCapacity() int {
 if a.definition.GameID=="chess" {if c,ok:=a.module.(RuleChessCapacity);ok {if n:=c.ChessDataCapacity();n>=8192&&n<=classicMaxStateBytes-1024{return n}}}
 return 8192
}
func (a *RulesAdapter)decode(raw json.RawMessage)(RuleFrame,error){
 var frame RuleFrame
 if a==nil||len(raw)==0||len(raw)>classicMaxStateBytes||!strictRuleJSON(raw,&frame){return frame,ErrInvalid}
 if frame.GameID!=a.definition.GameID||frame.Version!=a.definition.Version||frame.RulesHash!=a.hash||
  !classicSeatsValid(frame.GameID,frame.SeatCount)||frame.Round<1||frame.Round>1000000||
  !rulePhasePattern.MatchString(frame.Phase)||frame.Turn< -1||frame.Turn>=frame.SeatCount||
  (frame.Terminal!=(frame.Turn==-1))||(frame.Winner!=nil&&(!frame.Terminal||*frame.Winner<0||*frame.Winner>=frame.SeatCount))||
  len(frame.Scores)!=frame.SeatCount||len(frame.Data)==0||len(frame.Data)>a.dataCapacity()||!json.Valid(frame.Data){
  return frame,ErrInvalid
 }
 seed,e:=hex.DecodeString(frame.Seed)
 if e!=nil||len(seed)!=32{return frame,ErrInvalid}
 for _,score:=range frame.Scores{if score< -maxRuleScore||score>maxRuleScore{return frame,ErrInvalid}}
 if e=a.module.Validate(cloneRuleFrame(frame));e!=nil{return frame,ErrInvalid}
 return frame,nil
}
func (a *RulesAdapter)encode(frame RuleFrame)(json.RawMessage,error){
 // Modules may return a mutable Go object. Freeze through the strict JSON
 // codec, which rejects unknown/duplicate fields, extra data and overflows.
 var data any
 dec:=json.NewDecoder(bytes.NewReader(frame.Data));dec.UseNumber()
 if dec.Decode(&data)!=nil||!noDuplicateJSON(frame.Data){return nil,ErrUnavailable}
 canonicalData,e:=json.Marshal(data);if e!=nil{return nil,ErrUnavailable}
 frame.Data=canonicalData
 raw,e:=json.Marshal(frame);if e!=nil{return nil,ErrUnavailable}
 if _,e=a.decode(raw);e!=nil{return nil,e}
 return raw,nil
}
func strictRuleJSON(raw []byte,dst any)bool{
 if !json.Valid(raw)||len(raw)==0||!noDuplicateJSON(raw){return false}
 d:=json.NewDecoder(bytes.NewReader(raw));d.DisallowUnknownFields()
 if d.Decode(dst)!=nil{return false}
 return d.Decode(new(any))!=nil // JSON valid guarantees no trailing values
}
func noDuplicateJSON(raw []byte)bool{
 dec:=json.NewDecoder(bytes.NewReader(raw));dec.UseNumber()
 var walk func()bool
 walk=func()bool{
  tok,e:=dec.Token();if e!=nil{return false}
  open,ok:=tok.(json.Delim)
  if !ok{return true}
  switch open{
  case '{':
   seen:=map[string]bool{}
   for dec.More(){
    t,e:=dec.Token();if e!=nil{return false}
    key,ok:=t.(string);if !ok||seen[key]{return false}
    seen[key]=true;if !walk(){return false}
   }
   end,e:=dec.Token();return e==nil&&end==json.Delim('}')
  case '[':
   for dec.More(){if !walk(){return false}}
   end,e:=dec.Token();return e==nil&&end==json.Delim(']')
  default:return false
  }
 }
 return walk()
}
func canonicalRuleAction(raw json.RawMessage)(json.RawMessage,error){
 if len(raw)<2||len(raw)>maxRulesAction||!json.Valid(raw)||!noDuplicateJSON(raw)||raw[0]!='{'{
  return nil,ErrInvalid
 }
 var v any
 d:=json.NewDecoder(bytes.NewReader(raw));d.UseNumber()
 if d.Decode(&v)!=nil{return nil,ErrInvalid}
 canon,e:=json.Marshal(v)
 if e!=nil||len(canon)>maxRulesAction{return nil,ErrInvalid}
 return canon,nil
}
func (a *RulesAdapter)legal(frame RuleFrame,seat int)([]json.RawMessage,error){
 if frame.Terminal||seat<0||seat>=frame.SeatCount{return nil,ErrForbidden}
 nonTurn:=frame.Turn!=seat
 policy,ok:=a.module.(RuleChessNonTurn)
 if nonTurn&&(a.definition.GameID!="chess"||!ok){return nil,ErrForbidden}
 run:=func()([]json.RawMessage,error){
  budget:=NewRuleBudget(100000)
  var legal []json.RawMessage;var e error
  if nonTurn{legal,e=policy.NonTurnLegal(cloneRuleFrame(frame),seat,budget)}else{legal,e=a.module.Legal(cloneRuleFrame(frame),seat,budget)}
  if e!=nil||budget.spent<1||len(legal)>a.legalCapacity(){return nil,ErrUnavailable}
  if len(legal)==0{if nonTurn{return nil,ErrForbidden};return nil,ErrUnavailable}
  out:=make([]json.RawMessage,0,len(legal));seen:=map[string]bool{}
  for _,item:=range legal{
   b,e:=canonicalRuleAction(item);if e!=nil||seen[string(b)]{return nil,ErrUnavailable}
   if nonTurn&&!chessNonTurnAction(b){return nil,ErrUnavailable}
   seen[string(b)]=true;out=append(out,b)
  }
  return out,nil
 }
 once,e:=run();if e!=nil{return nil,e}
 again,e:=run();if e!=nil||len(once)!=len(again){return nil,ErrUnavailable}
 for i:=range once{if !bytes.Equal(once[i],again[i]){return nil,ErrUnavailable}}
 return once,nil
}
func (a *RulesAdapter)LegalActions(raw json.RawMessage,seat int)([]json.RawMessage,error){
 frame,e:=a.decode(raw);if e!=nil{return nil,e}
 return a.legal(frame,seat)
}
func (a *RulesAdapter)ValidateSaved(raw json.RawMessage)error{
 _,e:=a.decode(raw);return e
}
func (a *RulesAdapter)View(raw json.RawMessage,seat int)(json.RawMessage,error){
 frame,e:=a.decode(raw);if e!=nil||seat<0||seat>=frame.SeatCount{return nil,ErrUnavailable}
 // A per-seat view may contain that seat's cards, never the raw rule
 // snapshot or seed. Repeat with fresh clones: non-deterministic or mutable
 // projections cannot become authoritative browser-visible state.
 run:=func()(json.RawMessage,error){
  view,e:=a.module.View(cloneRuleFrame(frame),seat)
  if e!=nil||!validViewerState(view)||!noDuplicateJSON(view){return nil,ErrUnavailable}
  var root map[string]json.RawMessage
  if json.Unmarshal(view,&root)!=nil||root==nil{return nil,ErrUnavailable}
  for _,secret:=range []string{"seed","rulesHash","engineState","initialState","opponentHand","allHands"}{
   if _,ok:=root[secret];ok{return nil,ErrUnavailable}
  }
  if bytes.Contains(view,[]byte(frame.Seed))||bytes.Equal(view,raw){return nil,ErrUnavailable}
  return append(json.RawMessage(nil),view...),nil
 }
 first,e:=run();if e!=nil{return nil,e}
 second,e:=run();if e!=nil||!bytes.Equal(first,second){return nil,ErrUnavailable}
 return first,nil
}
func (a *RulesAdapter)Apply(raw json.RawMessage,seat int,move json.RawMessage)(json.RawMessage,int,bool,*int,error){
 frame,e:=a.decode(raw);if e!=nil{return nil,0,false,nil,e}
 chosen,e:=canonicalRuleAction(move);if e!=nil{return nil,0,false,nil,e}
 if submitted,ok:=a.module.(wordSaladSubmittedAction);ok&&a.definition.GameID=="scrabble" {
  if frame.Terminal||seat<0||seat>=frame.SeatCount{return nil,0,false,nil,ErrForbidden}
  for i:=0;i<2;i++{
   budget:=NewRuleBudget(100000)
   if e=submitted.ValidateSubmitted(cloneRuleFrame(frame),seat,append(json.RawMessage(nil),chosen...),budget);e!=nil{return nil,0,false,nil,e}
   if budget.spent<1{return nil,0,false,nil,ErrUnavailable}
  }
 }else{
  legal,e:=a.legal(frame,seat);if e!=nil{return nil,0,false,nil,e}
  allowed:=false;for _,option:=range legal{if bytes.Equal(option,chosen){allowed=true;break}}
  if !allowed{return nil,0,false,nil,ErrInvalid}
 }
 run:=func()(json.RawMessage,error){
  budget:=NewRuleBudget(100000)
  next,e:=a.module.Step(cloneRuleFrame(frame),seat,append(json.RawMessage(nil),chosen...),budget)
  if e!=nil{return nil,e}
  if budget.spent<1||next.GameID!=frame.GameID||next.Version!=frame.Version||
   next.RulesHash!=frame.RulesHash||next.Seed!=frame.Seed||next.Variant!=frame.Variant||next.SeatCount!=frame.SeatCount||
   next.Round<frame.Round||next.Round>frame.Round+1{
   return nil,ErrUnavailable
  }
  return a.encode(next)
 }
 once,e:=run();if e!=nil{return nil,0,false,nil,e}
 twice,e:=run();if e!=nil||!bytes.Equal(once,twice){return nil,0,false,nil,ErrUnavailable}
 result,e:=a.decode(once);if e!=nil{return nil,0,false,nil,e}
 return once,result.Turn,result.Terminal,result.Winner,nil
}
// A bot may receive only a seat projection and the legal action list.
// This contract does not install a bot policy or activate bot matches.
// ChooseMove is retained for BC-0.7 callers. Production bot execution uses
// ChooseMoveBounded with difficulty-specific limits and a wall-clock cap.
func (a *RulesAdapter)ChooseMove(raw json.RawMessage,seat int,difficulty string,policy RuleDecisionPolicy)(json.RawMessage,error){
 return a.ChooseMoveBounded(raw,seat,difficulty,policy,100000,time.Time{})
}
var errBotDecisionDeadline=errors.New("bot decision deadline")
func (a *RulesAdapter)ChooseMoveBounded(raw json.RawMessage,seat int,difficulty string,policy RuleDecisionPolicy,limit int,deadline time.Time)(json.RawMessage,error){
 if !map[string]bool{"easy":true,"medium":true,"hard":true}[difficulty]||policy==nil||
  limit<1||limit>100000{return nil,ErrUnavailable}
 frame,e:=a.decode(raw);if e!=nil{return nil,e}
 if frame.Turn!=seat{return nil,ErrForbidden}
 options,e:=a.legal(frame,seat);if e!=nil{return nil,e}
 view,e:=a.View(raw,seat);if e!=nil{return nil,e}
 // Run twice on isolated copies to reject nondeterministic decisions and
 // mutation of the legal action list or the seat projection. Never pass
 // RuleFrame, the seed or another seat's view to policy code.
 run:=func()(json.RawMessage,error){
  budget:=NewRuleBudget(limit);budget.deadline=deadline
  private:=append(json.RawMessage(nil),view...)
  candidates:=make([]json.RawMessage,len(options))
  for i,item:=range options{candidates[i]=append(json.RawMessage(nil),item...)}
  selected,e:=policy.ChooseMove(private,difficulty,candidates,budget)
  if budget.expired(){return nil,fmt.Errorf("%w: %w",ErrUnavailable,errBotDecisionDeadline)}
  if e!=nil||budget.spent<1{return nil,fmt.Errorf("%w: bot policy rejected decision",ErrUnavailable)}
  canon,e:=canonicalRuleAction(selected);if e!=nil{return nil,e}
  // Word Salad uses the same submitted-action authority as human moves.
  // Never expose the frame to the policy; validate only after it returns.
  if submitted,ok:=a.module.(wordSaladSubmittedAction);ok&&a.definition.GameID=="scrabble"{
   var m saladMove;if !strictRuleJSON(canon,&m)||(m.Type!="place"&&m.Type!="exchange"&&m.Type!="pass"){return nil,ErrForbidden}
   check:=NewRuleBudget(100000)
   if e:=submitted.ValidateSubmitted(cloneRuleFrame(frame),seat,canon,check);e!=nil||check.spent<1{return nil,ErrForbidden}
   return canon,nil
  }
  for _,legal:=range options{if bytes.Equal(legal,canon){return canon,nil}}
  return nil,ErrForbidden
 }
 // A bounded search can exhaust wall time under CPU contention. Only the
 // registered Word Salad policy may recover through the canonical pass,
 // and only when the search deadline actually elapsed. Invalid actions,
 // unknown policies and deterministic mismatches remain fail-closed.
 fallback:=func(e error)(json.RawMessage,error){
  trusted,ok:=policy.(saladBotPolicy)
  if !ok||trusted.lex==nil||trusted.level!=difficulty||a.definition.GameID!="scrabble"||deadline.IsZero()||time.Now().Before(deadline){return nil,e}
  if !errors.Is(e,errBotDecisionDeadline){return nil,e}
  pass:=json.RawMessage(`{"type":"pass"}`)
  check:=NewRuleBudget(100000)
  submitted,ok:=a.module.(wordSaladSubmittedAction)
  if !ok{return nil,ErrUnavailable}
  if err:=submitted.ValidateSubmitted(cloneRuleFrame(frame),seat,pass,check);err!=nil||check.spent<1{return nil,ErrUnavailable}
  return pass,nil
 }
 one,e:=run();if e!=nil{return fallback(e)}
 two,e:=run();if e!=nil{return fallback(e)};if !bytes.Equal(one,two){return nil,fmt.Errorf("%w: bot deterministic decision mismatch",ErrUnavailable)}
 return one,nil
}
func (a *RulesAdapter) replayLimit()int{
 if a!=nil{
  if p,ok:=a.module.(RuleReplayCapacity);ok{
   upper:=8192;if a.definition.GameID=="chess"{upper=20000}
   if cap:=p.MaxReplayActions();cap>=maxRulesMoves&&cap<=upper{return cap}
  }
 }
 return maxRulesMoves
}
// ReplayFromVerified continues only the suffix of a prefix that the server
// has already fully replayed and tied to the immutable private journal.
// Every new action still runs the exact same legal/determinism and
// before/after-hash verification as a cold full replay.
func (a *RulesAdapter) replayFromVerified(state json.RawMessage,prev int64,trace []RuleTrace)(json.RawMessage,error){
 if a==nil||prev<1||len(trace)>a.replayLimit(){return nil,ErrInvalid}
 state=append(json.RawMessage(nil),state...)
 for _,item:=range trace{
  if item.Sequence!=prev+1||item.Sequence>1000000{return nil,ErrConflict}
  before:=sha256.Sum256(state)
  if item.BeforeHash!=hex.EncodeToString(before[:]){return nil,ErrConflict}
  action,e:=a.chessReplayTiming(state,item.Action)
  if e!=nil{return nil,ErrConflict}
  var updated json.RawMessage
  if action!=nil{
   updated,_,_,_,e=a.applyChessTime(state,item.Seat,*action)
  }else{updated,_,_,_,e=a.Apply(state,item.Seat,item.Action)}
  if e!=nil{return nil,ErrConflict}
  after:=sha256.Sum256(updated)
  if item.AfterHash!=hex.EncodeToString(after[:]){return nil,ErrConflict}
  state=updated;prev=item.Sequence
 }
 return state,nil
}
func (a *RulesAdapter)Replay(seed [32]byte,seatCount int,trace []RuleTrace)(json.RawMessage,error){
 if a==nil||len(trace)>a.replayLimit(){return nil,ErrInvalid}
 state,e:=a.initial(seed,seatCount);if e!=nil{return nil,e}
 return a.replayFromVerified(state,1,trace)
}
// ReplayConfigured reconstructs an immutable selected rules variant from its
// sealed genesis. A later room mutation cannot reinterpret completed actions.
func (a *RulesAdapter)ReplayConfigured(seed [32]byte,seatCount int,variant string,trace []RuleTrace)(json.RawMessage,error){
 if a==nil||len(trace)>a.replayLimit(){return nil,ErrInvalid}
 state,e:=a.initialConfigured(seed,seatCount,variant);if e!=nil{return nil,e}
 return a.replayFromVerified(state,1,trace)
}
type RuleTrace struct {
 Sequence int64
 Seat int
 Action json.RawMessage
 BeforeHash string
 AfterHash string
}
func RuleHash(raw json.RawMessage)string{
 digest:=sha256.Sum256(raw);return hex.EncodeToString(digest[:])
}
func (a *RulesAdapter)Manifest()RuleDefinition{return a.definition}
func (a *RulesAdapter)String()string{return fmt.Sprintf("%s/%s@%s",a.definition.GameID,a.definition.Version,a.hash)}
var _ ClassicRule=(*RulesAdapter)(nil)
