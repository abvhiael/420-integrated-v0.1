package bundle

import (
 "context"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
)

func TestBuilderEnforcesFIFOBeforeBoundedSelection(t *testing.T){
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 early:=op("0x2222222222222222222222222222222222222222","0x1")
 late:=op("0x3333333333333333333333333333333333333333","0x1")
 tie:=op("0x4444444444444444444444444444444444444444","0x1")
 a:=entry(t,early,now.Add(-time.Minute))
 b:=entry(t,late,now)
 c:=entry(t,tie,now.Add(time.Minute))
 // Deliberately put newest first. The builder must sort before truncating.
 p:=&fakePool{items:[]mempool.Entry{c,b,a}}
 s:=&fakeSubmitter{fails:map[string]bool{}}
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:2},p,fakeValidator{invalid:map[string]bool{}},s)
 if err!=nil{t.Fatal(err)}
 result,err:=builder.SubmitNext(context.Background(),now)
 if err!=nil{t.Fatal(err)}
 if result.Selected!=2||len(s.order)!=2||s.order[0]!=early.Sender||s.order[1]!=late.Sender{
  t.Fatalf("builder did not enforce earliest admission before truncation: %+v %v",result,s.order)
 }
}

func TestBuilderFailsClosedOnEconomicPolicyOverride(t *testing.T){
 p:=&fakePool{}
 s:=&fakeSubmitter{}
 _,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:2,OrderingPolicy:"fee-priority"},p,fakeValidator{},s)
 if err==nil{t.Fatal("undocumented ordering override accepted")}
}
