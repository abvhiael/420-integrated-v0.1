package complianceauth

import (
 "errors"
 "sync"
 "testing"
 "time"
)
func TestChangeIntakeQueueOwnerAndReplay(t *testing.T){
 now:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 template:=ChangeIntake{SourceID:"FED-ACT",SnapshotDigest:Digest([]byte("snapshot")),ChangeType:"SILENT_AMENDMENT",Severity:SeverityCritical,Apps:[]string{"DOOBr","420Travel"},Regions:[]string{"BC"},Rules:[]string{"DELIVERY-AGE"},EffectiveAt:now.Add(time.Hour),DetectedAt:now,OwnerID:"reviewer-credential-123"}
 q:=&ChangeIntakeQueue{}
 first,err:=q.Enqueue(template)
 if err!=nil||first.State!="PENDING_REVIEW"||first.PolicyAuthorized||first.ID==""{t.Fatalf("unexpected intake %+v %v",first,err)}
 again,err:=q.Enqueue(template)
 if err!=nil||again.ID!=first.ID||len(q.PendingFor(template.OwnerID))!=1{t.Fatalf("duplicate accepted %+v %v",again,err)}
 if _,err=q.Acknowledge(first.ID,"attacker",now.Add(time.Minute));!errors.Is(err,ErrIntakeForbidden){t.Fatal("wrong owner accepted",err)}
 if _,err=q.Acknowledge(first.ID,template.OwnerID,now.Add(-time.Minute));!errors.Is(err,ErrInvalidIntake){t.Fatal("backdated acknowledgment",err)}
 ack,err:=q.Acknowledge(first.ID,template.OwnerID,now.Add(time.Minute))
 if err!=nil||ack.PolicyAuthorized||ack.State!="ACKNOWLEDGED_PENDING_LEGAL_REVIEW"||ack.AcknowledgedBy!=template.OwnerID{t.Fatalf("ack bypass %+v %v",ack,err)}
 if _,err=q.Acknowledge(first.ID,template.OwnerID,now.Add(time.Minute));!errors.Is(err,ErrIntakeConflict){t.Fatal("replayed ack accepted",err)}
 if len(q.PendingFor(template.OwnerID))!=0{t.Fatal("ack still pending")}
 bad:=template;bad.OwnerID="";if _,err=q.Enqueue(bad);!errors.Is(err,ErrInvalidIntake){t.Fatal("unnamed owner accepted")}
 bad=template;bad.Apps=nil;if _,err=q.Enqueue(bad);!errors.Is(err,ErrInvalidIntake){t.Fatal("no affected app accepted")}
 bad=template;bad.Severity="NONE";if _,err=q.Enqueue(bad);!errors.Is(err,ErrInvalidIntake){t.Fatal("invalid severity accepted")}
 bad=template;bad.PolicyAuthorized=true;if _,err=q.Enqueue(bad);!errors.Is(err,ErrInvalidIntake){t.Fatal("caller-authorized policy accepted")}
 bad=template;bad.SnapshotDigest="fabricated";if _,err=q.Enqueue(bad);!errors.Is(err,ErrInvalidIntake){t.Fatal("unverified snapshot accepted")}
 // Concurrent identical ingestion must produce exactly one pending work item.
 parallel:=&ChangeIntakeQueue{}
 var wg sync.WaitGroup
 for i:=0;i<16;i++{wg.Add(1);go func(){defer wg.Done();if _,err:=parallel.Enqueue(template);err!=nil{t.Error(err)}}()}
 wg.Wait()
 if len(parallel.PendingFor(template.OwnerID))!=1{t.Fatal("concurrent replay creates duplicate")}
}
