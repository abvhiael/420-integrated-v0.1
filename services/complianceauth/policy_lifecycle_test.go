package complianceauth

import (
 "context"
 "sync"
 "testing"
 "time"
)
func TestC041PolicyLifecycleSeparationAndReplay(t *testing.T){
 ctx:=context.Background();now:=time.Date(2026,10,10,21,0,0,0,time.UTC)
 digest:=Digest([]byte("reviewed policy"))
 l,err:=NewPolicyLifecycle("policy-A",digest,"author");if err!=nil{t.Fatal(err)}
 step:=func(to LifecycleState,actor,reviewed,successor string,at time.Time,revision uint64,want bool){
  t.Helper();e:=l.Transition(ctx,to,actor,reviewed,successor,now,at,revision)
  if (e==nil)!=want{t.Fatalf("transition %s by %s revision %d: %v",to,actor,revision,e)}
 }
 step(LifecycleActive,"publisher","","",now,1,false)
 step(LifecycleReviewed,"author",digest,"",now,1,false)
 step(LifecycleReviewed,"reviewer",Digest([]byte("changed")),"",now,1,false)
 step(LifecycleReviewed,"reviewer",digest,"",now,1,true)
 step(LifecycleReviewed,"reviewer",digest,"",now,1,false)
 step(LifecycleApproved,"reviewer","","",now,2,false)
 step(LifecycleApproved,"author","","",now,2,false)
 step(LifecycleApproved,"approver","","",now,2,true)
 step(LifecycleScheduled,"approver","","",now,3,false)
 step(LifecycleScheduled,"publisher","","",now.Add(-time.Second),3,false)
 step(LifecycleScheduled,"publisher","","",now.Add(time.Minute),3,true)
 step(LifecycleActive,"publisher","","",now,4,false)
 r,events:=l.Snapshot();if r.State!=LifecycleScheduled||len(events)!=3{t.Fatalf("bad event sequence %+v",r)}
 // Activate only after the scheduled clock instant.
 if err:=l.Transition(ctx,LifecycleActive,"publisher","","",now.Add(time.Minute),time.Time{},4);err!=nil{t.Fatal(err)}
 if err:=l.Transition(ctx,LifecycleSuperseded,"publisher","","policy-B",now.Add(time.Minute),time.Time{},5);err!=nil{t.Fatal(err)}
 step(LifecycleRevoked,"publisher","","",now,6,false)
 record,history:=l.Snapshot()
 if record.State!=LifecycleSuperseded||record.SupersededBy!="policy-B"||len(history)!=5{t.Fatalf("invalid terminal state %+v %+v",record,history)}
 for i,e:=range history{if e.Revision!=uint64(i+2){t.Fatalf("revision gap %+v",history)}}
 rev,err:=NewPolicyLifecycle("policy-R",digest,"author");if err!=nil{t.Fatal(err)}
 if err:=rev.Transition(ctx,LifecycleReviewed,"reviewer",digest,"",now,time.Time{},1);err!=nil{t.Fatal(err)}
 if err:=rev.Transition(ctx,LifecycleApproved,"approver","","",now,time.Time{},2);err!=nil{t.Fatal(err)}
 if err:=rev.Transition(ctx,LifecycleScheduled,"publisher","","",now,now.Add(time.Minute),3);err!=nil{t.Fatal(err)}
 if err:=rev.Transition(ctx,LifecycleRevoked,"publisher","","",now,time.Time{},4);err!=nil{t.Fatal(err)}
 if err:=rev.Transition(ctx,LifecycleActive,"publisher","","",now.Add(time.Minute),time.Time{},5);err==nil{t.Fatal("revoked policy activated")}
 concurrent,err:=NewPolicyLifecycle("policy-C",digest,"author");if err!=nil{t.Fatal(err)}
 var wg sync.WaitGroup; successes:=make(chan bool,32)
 for i:=0;i<32;i++{wg.Add(1);go func(){defer wg.Done();successes<-concurrent.Transition(ctx,LifecycleReviewed,"reviewer",digest,"",now,time.Time{},1)==nil}()}
 wg.Wait();close(successes);count:=0;for ok:=range successes{if ok{count++}}
 if count!=1{t.Fatalf("concurrent same-revision winners %d",count)}
}
