package social

import (
 "encoding/json"
 "net/http/httptest"
 "strings"
 "testing"
)

type bc06TestRule struct{}
func (bc06TestRule)Identity()(string,string){return "test-only-v1",strings.Repeat("a",64)}
func (bc06TestRule)Initial(_ ClassicRoom,seats []ClassicSeat)(json.RawMessage,int,error){
 if len(seats)!=2{return nil,0,ErrInvalid}
 return json.RawMessage(`{"count":0,"secret0":"only-a","secret1":"only-b"}`),0,nil
}
func (bc06TestRule)Apply(raw json.RawMessage,seat int,move json.RawMessage)(json.RawMessage,int,bool,*int,error){
 var state struct{Count int `json:"count"`;Secret0 string `json:"secret0"`;Secret1 string `json:"secret1"`}
 var action struct{Take int `json:"take"`}
 if json.Unmarshal(raw,&state)!=nil||json.Unmarshal(move,&action)!=nil||action.Take!=1||seat<0||seat>1{
  return nil,0,false,nil,ErrInvalid
 }
 state.Count++
 next,_:=json.Marshal(state)
 if state.Count==3{return next,0,true,&seat,nil}
 return next,1-seat,false,nil,nil
}
func (bc06TestRule)View(raw json.RawMessage,seat int)(json.RawMessage,error){
 var state struct{Count int `json:"count"`;Secret0 string `json:"secret0"`;Secret1 string `json:"secret1"`}
 if json.Unmarshal(raw,&state)!=nil{return nil,ErrInvalid}
 secret:=state.Secret0;if seat==1{secret=state.Secret1}
 return json.Marshal(map[string]any{"count":state.Count,"yourHiddenCard":secret})
}
func bc06Resolver(id string)ClassicRule{
 if id=="chess"{return bc06TestRule{}} // test-only; NEVER registered in production
 return nil
}
func TestBC06RuleEngineIsAlwaysExplicitAndBounded(t *testing.T){
 if validRuleState(nil)||validRuleState(json.RawMessage("no-json"))||validRuleState(json.RawMessage(strings.Repeat("x",classicMaxStateBytes+1))){t.Fatal("invalid opaque state allowed")}
 if !validRuleState(json.RawMessage(`{"safe":true}`)){t.Fatal("valid state rejected")}
 if validViewerState(json.RawMessage(strings.Repeat("z",classicMaxActionBytes+1))){t.Fatal("overlong seat view")}
 if _,e:=NewClassicSessions(nil,nil,bc06Resolver);e==nil{t.Fatal("nil store accepted")}
 if s:=(&ClassicSessions{});s!=nil{if _,e:=s.rule("chess","","");e==nil{t.Fatal("implicit engine accepted")}}
 s:=&ClassicSessions{Rules:bc06Resolver}
 if _,e:=s.rule("cribbage","","");e==nil{t.Fatal("unqualified game rule accepted")}
 if _,e:=s.rule("chess","test-only-v1",strings.Repeat("b",64));e==nil{t.Fatal("hash mismatch accepted")}
 if _,e:=s.rule("chess","test-only-v1",strings.Repeat("a",64));e!=nil{t.Fatal(e)}
}
func TestBC06PublicEventAndSeatViewNeverIncludeConcealedRulesState(t *testing.T){
 rule:=bc06TestRule{}
 raw,_,e:=rule.Initial(ClassicRoom{},[]ClassicSeat{{},{}})
 if e!=nil{t.Fatal(e)}
 host,e:=rule.View(raw,0);if e!=nil{t.Fatal(e)}
 guest,e:=rule.View(raw,1);if e!=nil{t.Fatal(e)}
 if strings.Contains(string(host),"only-b")||strings.Contains(string(guest),"only-a"){t.Fatal("cross-seat secret leak")}
 record:=classicSessionRecord{ClassicSession:ClassicSession{ID:"x",Status:"active",Sequence:1},State:raw}
 public:=string(classicPublicState(record))
 if strings.Contains(public,"secret")||strings.Contains(public,"only-a")||strings.Contains(public,"only-b"){t.Fatal("event published concealed state")}
}
func TestBC06EventCursorCannotSmuggleUnboundedOrNegativeSequence(t *testing.T){
 for _,raw:=range []string{"?after=-1","?after=9999999999999999999","?after=3&after=4","?after=1&x=2","?after=+1","?after="}{
  request:=httptest.NewRequest("GET","https://bonggoggles.420integrated.org/v1/classic-sessions/aaa/events"+raw,nil)
  if _,e:=sessionAfter(request);e==nil{t.Fatal("accepted invalid cursor",raw)}
 }
 for _,raw:=range []string{"","?after=0","?after=42"}{
  request:=httptest.NewRequest("GET","https://bonggoggles.420integrated.org/v1/classic-sessions/aaa/events"+raw,nil)
  if _,e:=sessionAfter(request);e!=nil{t.Fatal("rejected cursor",raw,e)}
 }
 if !equalDigest([]byte{1,2,3},[]byte{1,2,3})||equalDigest([]byte{1,2},[]byte{1,3}){t.Fatal("digest comparer")}
}
