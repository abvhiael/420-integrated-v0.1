package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c076Authority struct { checkpoint C076Checkpoint; err error }
func (a c076Authority) LatestCheckpoint(ctx context.Context,scope string)(C076Checkpoint,error){return a.checkpoint,a.err}
func TestC076RestoreRejectsStaleRevokedPolicyAndPrivacyReplay(t *testing.T){
 now:=time.Now().UTC()
 f:=PublicationFence{Scope:"production/BC/Vancouver",Sequence:7,RevocationEpoch:5,PolicyDigest:Digest([]byte("policy")),DependencyDigest:Digest([]byte("dependencies")),ExpiresAt:now.Add(time.Hour)}
 receipt:=Digest([]byte("receipts/7"))
 saved:=C076RestoredState{Fence:f,Generation:8,PrivacyReceiptsDigest:receipt,PrivacyReceiptsCount:9}
 latest:=C076Checkpoint{Scope:f.Scope,Fence:f,Generation:8,PrivacyReceiptsDigest:receipt,PrivacyReceiptsCount:9}
 test:=func(name string,state C076RestoredState,checkpoint C076Checkpoint,err error,want bool){
  t.Helper();t.Run(name,func(t *testing.T){got:=VerifyC076Restore(context.Background(),c076Authority{checkpoint,err},state,now);if (got==nil)!=want{t.Fatalf("accepted=%v want=%v",got==nil,want)}})
 }
 test("exact_checkpoint",saved,latest,nil,true)
 stale:=saved;stale.Fence.Sequence--
 test("prior_publication",stale,latest,nil,false)
 stale=saved;stale.Fence.RevocationEpoch--
 test("prior_revocation",stale,latest,nil,false)
 stale=saved;stale.Fence.PolicyDigest=Digest([]byte("revoked-policy"))
 test("revoked_policy",stale,latest,nil,false)
 stale=saved;stale.PrivacyReceiptsCount--
 test("missing_purge_receipt",stale,latest,nil,false)
 stale=saved;stale.PrivacyReceiptsDigest=Digest([]byte("missing tombstone"))
 test("missing_privacy_tombstone",stale,latest,nil,false)
 stale=saved;stale.Generation--
 test("older_restore_generation",stale,latest,nil,false)
 test("authority_unavailable",saved,latest,errors.New("outage"),false)
 stale=saved;stale.Fence.ExpiresAt=now.Add(-time.Second)
 test("expired_publication",stale,latest,nil,false)
 latest.Generation++
 test("external_generation_advanced",saved,latest,nil,false)
 if VerifyC076Restore(context.Background(),nil,saved,now)==nil{t.Fatal("nil authority accepted")}
 ctx,cancel:=context.WithCancel(context.Background());cancel()
 if VerifyC076Restore(ctx,c076Authority{latest,nil},saved,now)==nil{t.Fatal("cancelled context accepted")}
}
