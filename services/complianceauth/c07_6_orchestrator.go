package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "time"
)

// C076RestorePlan is untrusted metadata until independently validated.
// The caller supplies an exact expected backup digest and scope; no trust is
// derived from the restored primary or archive itself.
type C076RestorePlan struct {
 Scope, BackupSHA256 string
 CheckpointGeneration uint64
}
type C076Deletion struct { Kind, Ref string }
type C076Witness struct {
 Checkpoint C076Checkpoint
 Deletions []C076Deletion
}
// C076WitnessAuthority must be independently authenticated, strongly
// consistent, and non-rollbackable outside the failed storage domain.
type C076WitnessAuthority interface {
 C076IndependentAuthority // monotonic latest checkpoint maintained outside the restore domain
 RecoverWitness(context.Context,string)(C076Witness,error)
}
// C076RecoveryPlatform is the privileged restore control plane. All methods
// must fail closed; implementations must never expose restored state prior to
// Release, and must retain isolation after any unsuccessful operation.
type C076RecoveryPlatform interface {
 Quiesce(context.Context,string) error
 RestoreVerifiedBackup(context.Context,C076RestorePlan) error
 ReplayDeletion(context.Context,string,C076Deletion) error
 RestoreCurrentFence(context.Context,PublicationFence) error
 FenceOldLeasesAndSessions(context.Context,string,uint64) error
 Snapshot(context.Context,string)(C076RestoredState,error)
 Release(context.Context,string,uint64) error
}

// C076Restore coordinates a quiesced recovery. A caller must use a trusted
// out-of-band witness; it must not implement witness reads from restored SQL.
// The platform must provide atomic/fenced replay and durable idempotency.
// No cleanup unquiesces a failed recovery.
func C076Restore(ctx context.Context,plan C076RestorePlan,authority C076WitnessAuthority,platform C076RecoveryPlatform,now time.Time)error{
 if ctx==nil||ctx.Err()!=nil||authority==nil||platform==nil||!c051Scope(plan.Scope)||
  !digestValid(plan.BackupSHA256)||plan.CheckpointGeneration==0{return ErrC076UnsafeRestore}
 if err:=platform.Quiesce(ctx,plan.Scope);err!=nil{return ErrC076UnsafeRestore}
 witness,err:=authority.RecoverWitness(ctx,plan.Scope)
 latest,latestErr:=authority.LatestCheckpoint(ctx,plan.Scope)
 if latestErr!=nil||latest!=witness.Checkpoint{return ErrC076UnsafeRestore}
 if err!=nil||ctx.Err()!=nil||witness.Checkpoint.Scope!=plan.Scope||
  witness.Checkpoint.Generation!=plan.CheckpointGeneration||
  !ValidPublicationFence(witness.Checkpoint.Fence,now)||
  witness.Checkpoint.Fence.Scope!=plan.Scope||
  witness.Checkpoint.PrivacyReceiptsCount!=uint64(len(witness.Deletions)){
  return ErrC076UnsafeRestore
 }
 // Canonicalize a bounded, unique tombstone ledger. The external authority
 // must prove the witness is complete; this digest checks accidental mutation.
 if len(witness.Deletions)>100000{return ErrC076UnsafeRestore}
 h:=sha256.New()
 seen:=make(map[string]bool,len(witness.Deletions))
 for _,d:=range witness.Deletions{
  if !c075Ref(C075Ref{Kind:d.Kind,ID:d.Ref},false){return ErrC076UnsafeRestore}
  key:=d.Kind+":"+d.Ref
  if seen[key]{return ErrC076UnsafeRestore};seen[key]=true
  h.Write([]byte(key));h.Write([]byte{0})
 }
 if hex.EncodeToString(h.Sum(nil))!=witness.Checkpoint.PrivacyReceiptsDigest{return ErrC076UnsafeRestore}
 if err=platform.RestoreVerifiedBackup(ctx,plan);err!=nil{return ErrC076UnsafeRestore}
 for _,d:=range witness.Deletions{
  if err=platform.ReplayDeletion(ctx,plan.Scope,d);err!=nil{return ErrC076UnsafeRestore}
 }
 if err=platform.RestoreCurrentFence(ctx,witness.Checkpoint.Fence);err!=nil{return ErrC076UnsafeRestore}
 // Fencing must advance generations so stale workers cannot renew leases.
 if witness.Checkpoint.Generation==^uint64(0){return ErrC076UnsafeRestore}
 nextGeneration:=witness.Checkpoint.Generation+1
 if err=platform.FenceOldLeasesAndSessions(ctx,plan.Scope,nextGeneration);err!=nil{return ErrC076UnsafeRestore}
 restored,err:=platform.Snapshot(ctx,plan.Scope)
 if err!=nil||restored.Fence!=witness.Checkpoint.Fence||
  restored.PrivacyReceiptsDigest!=witness.Checkpoint.PrivacyReceiptsDigest||
  restored.PrivacyReceiptsCount!=witness.Checkpoint.PrivacyReceiptsCount||
  restored.Generation!=nextGeneration||ctx.Err()!=nil{return ErrC076UnsafeRestore}
 // Release requires an independent current-state compare-and-swap in the
 // platform. Another revocation between witness and release must deny.
 fresh,e:=authority.RecoverWitness(ctx,plan.Scope)
 current,currentErr:=authority.LatestCheckpoint(ctx,plan.Scope)
 if currentErr!=nil||current!=witness.Checkpoint{return ErrC076UnsafeRestore}
 if e!=nil||ctx.Err()!=nil||fresh.Checkpoint!=witness.Checkpoint||len(fresh.Deletions)!=len(witness.Deletions){return ErrC076UnsafeRestore}
 for i:=range fresh.Deletions{if fresh.Deletions[i]!=witness.Deletions[i]{return ErrC076UnsafeRestore}}
 if err=platform.Release(ctx,plan.Scope,nextGeneration);err!=nil{return ErrC076UnsafeRestore}
 return nil
}
