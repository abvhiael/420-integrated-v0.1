package social

import (
 "bytes"
 "encoding/json"
 "fmt"
 "sync"
 "testing"
)

func TestBC15VerifiedReplayPrefixIsBoundedCopiedAndMonotone(t *testing.T){
 s:=&ClassicSessions{}
 original:=[]byte(`{"private":"only-seat-zero"}`)
 v:=verifiedRulePrefix{moves:2,state:original}
 s.retainVerifiedPrefix("room-1",v)
 original[0]='X'
 from,ok:=s.verifiedPrefix("room-1")
 if !ok||!bytes.Equal(from.state,[]byte(`{"private":"only-seat-zero"}`)){
  t.Fatal("cached private state aliases caller")
 }
 from.state[0]='Y'
 saved,_:=s.verifiedPrefix("room-1")
 if !bytes.Equal(saved.state,[]byte(`{"private":"only-seat-zero"}`)){
  t.Fatal("cached private state aliases reader")
 }
 s.retainVerifiedPrefix("room-1",verifiedRulePrefix{moves:1,state:[]byte("rollback")})
 saved,_=s.verifiedPrefix("room-1")
 if saved.moves!=2{t.Fatal("stale concurrent read rolled prefix backward")}
 for i:=0;i<maxVerifiedRulePrefixes+3;i++{
  s.retainVerifiedPrefix(fmt.Sprintf("room-%d",i+2),verifiedRulePrefix{moves:i})
 }
 s.verifiedMu.Lock()
 n:=len(s.verifiedPrefixes)
 s.verifiedMu.Unlock()
 if n>maxVerifiedRulePrefixes{t.Fatalf("unbounded private replay cache %d",n)}
}

func TestBC15VerifiedReplayPrefixConcurrentReaders(t *testing.T){
 s:=&ClassicSessions{}
 var wg sync.WaitGroup
 for i:=0;i<16;i++{
  wg.Add(1)
  go func(i int){defer wg.Done()
   for j:=0;j<50;j++{
    s.retainVerifiedPrefix("one",verifiedRulePrefix{moves:i*50+j,state:json.RawMessage(`{"ok":true}`)})
    _,_=s.verifiedPrefix("one")
   }
  }(i)
 }
 wg.Wait()
 v,ok:=s.verifiedPrefix("one")
 if !ok||v.moves!=799{t.Fatal("concurrent verified prefix lost most recent committed head")}
}

func TestBC15RuleTraceDigestBindsEveryHistoricalField(t *testing.T){
 original:=[]RuleTrace{{Sequence:2,Seat:0,Action:json.RawMessage(`{"take":1}`),
  BeforeHash:"a",AfterHash:"b"}}
 fingerprint,e:=ruleTraceDigest(original);if e!=nil{t.Fatal(e)}
 candidates:=[][]RuleTrace{
  {{Sequence:3,Seat:0,Action:json.RawMessage(`{"take":1}`),BeforeHash:"a",AfterHash:"b"}},
  {{Sequence:2,Seat:1,Action:json.RawMessage(`{"take":1}`),BeforeHash:"a",AfterHash:"b"}},
  {{Sequence:2,Seat:0,Action:json.RawMessage(`{"take":2}`),BeforeHash:"a",AfterHash:"b"}},
  {{Sequence:2,Seat:0,Action:json.RawMessage(`{"take":1}`),BeforeHash:"c",AfterHash:"b"}},
  {{Sequence:2,Seat:0,Action:json.RawMessage(`{"take":1}`),BeforeHash:"a",AfterHash:"c"}},
  {},
 }
 for i,trace:=range candidates{
  next,e:=ruleTraceDigest(trace);if e!=nil{t.Fatal(e)}
  if next==fingerprint{t.Fatalf("modified immutable trace field accepted (%d)",i)}
 }
}
