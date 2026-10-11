package complianceauth

import ("context";"testing";"time")
func TestC049ActivationImpactAndPriorEvidence(t *testing.T){
 now:=time.Date(2026,10,11,12,0,0,0,time.UTC)
 old:=PublicationFence{Scope:"travel/BC",Sequence:2,RevocationEpoch:1,PolicyDigest:Digest([]byte("old")),DependencyDigest:Digest([]byte("dependencies")),ExpiresAt:now.Add(time.Hour)}
 next:=old;next.Sequence=3;next.PolicyDigest=Digest([]byte("new"))
 store:=&MemoryPublicationStore{entries:map[string]PublicationFence{old.Scope:next}}
 cache:=&PublicationCache{}
 rec:=BoundDecisionReceipt{ReceiptID:"prior",OperationRef:"order1",PolicyDigest:old.PolicyDigest}
 orders:=[]ActivationOrder{{OrderID:"order1",Scope:old.Scope,Stage:"IN_TRANSIT",PreviousReceipt:rec}}
 report,err:=AssessActivationImpact(context.Background(),store,cache,old,next,orders,now)
 if err!=nil||!report.InvalidateCachedGuidance||report.Authorized||len(report.Impacts)!=1||report.Impacts[0].Action!="STOP_REASSESS_RETURN_REVIEW"||report.Impacts[0].PreviousReceiptDigest==""{t.Fatalf("report %+v %v",report,err)}
 if report.Impacts[0].PreviousPolicyDigest!=old.PolicyDigest||report.Impacts[0].NewPolicyDigest!=next.PolicyDigest{t.Fatal("policy history lost")}
 for _,stage:=range []string{"PENDING","PREPARING","IN_TRANSIT","REFUSED","FAILED_DELIVERY"} {
  x:=orders[0];x.Stage=stage;r,e:=AssessActivationImpact(context.Background(),store,cache,old,next,[]ActivationOrder{x},now)
  if e!=nil||len(r.Impacts)!=1||r.Authorized{t.Fatalf("%s %+v %v",stage,r,e)}
 }
 invalid:=orders[0];invalid.PreviousReceipt.PolicyDigest=next.PolicyDigest
 if _,err:=AssessActivationImpact(context.Background(),store,cache,old,next,[]ActivationOrder{invalid},now);err==nil{t.Fatal("replacement of historic policy accepted")}
 invalid=orders[0];invalid.Stage="DELIVERED"
 if _,err:=AssessActivationImpact(context.Background(),store,cache,old,next,[]ActivationOrder{invalid},now);err==nil{t.Fatal("completed order reopened")}
 if _,err:=AssessActivationImpact(context.Background(),store,cache,old,next,append(orders,orders...),now);err==nil{t.Fatal("duplicate order accepted")}
 stale:=next;stale.Sequence=4
 if _,err:=AssessActivationImpact(context.Background(),store,cache,old,stale,orders,now);err==nil{t.Fatal("unpublished future accepted")}
 if _,err:=AssessActivationImpact(context.Background(),nil,cache,old,next,orders,now);err==nil{t.Fatal("store outage accepted")}
 if _,err:=AssessActivationImpact(context.Background(),store,nil,old,next,orders,now);err==nil{t.Fatal("missing cache accepted")}
 ctx,cancel:=context.WithCancel(context.Background());cancel()
 if _,err:=AssessActivationImpact(ctx,store,cache,old,next,orders,now);err==nil{t.Fatal("cancellation accepted")}
}
