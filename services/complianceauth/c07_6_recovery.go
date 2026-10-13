package complianceauth

import (
 "context"
 "errors"
 "time"
)

// ErrC076UnsafeRestore intentionally collapses all recovery failures. Restored
// records are untrusted until independently checked against non-restored state.
var ErrC076UnsafeRestore = errors.New("compliance disaster recovery reconciliation unavailable")

// C076Checkpoint MUST reside outside the backup/restore failure domain. The
// trusted reader authenticates integrity, freshness and monotonic checkpoint
// sequence, not merely the JSON representation returned from a restored DB.
type C076Checkpoint struct {
 Scope string
 Generation uint64
 Fence PublicationFence
 PrivacyReceiptsDigest string
 PrivacyReceiptsCount uint64
}
type C076IndependentAuthority interface {
 LatestCheckpoint(context.Context,string)(C076Checkpoint,error)
}
// C076RestoredState is captured from a strongly consistent restored PRIMARY,
// with serving, writers, durable jobs and outbox dispatch stopped.
type C076RestoredState struct {
 Fence PublicationFence
 PrivacyReceiptsDigest string
 PrivacyReceiptsCount uint64
 Generation uint64
}

// VerifyC076Restore is a fail-closed precondition, not a release token.
// The caller must also replay irrevocable privacy tombstones from an independent
// journal, revalidate all roles/keys and acquire a new recovery generation
// before it may resume any traffic. A stale DB cannot bootstrap its own trust.
func VerifyC076Restore(ctx context.Context,authority C076IndependentAuthority,restored C076RestoredState,now time.Time) error {
 if ctx==nil||ctx.Err()!=nil||authority==nil||!ValidPublicationFence(restored.Fence,now)||
  !digestValid(restored.PrivacyReceiptsDigest)||restored.Generation==0{
  return ErrC076UnsafeRestore
 }
 latest,err:=authority.LatestCheckpoint(ctx,restored.Fence.Scope)
 if err!=nil||ctx.Err()!=nil||latest.Scope!=restored.Fence.Scope||
  latest.Generation==0||latest.Generation!=restored.Generation||
  latest.Fence!=restored.Fence||!ValidPublicationFence(latest.Fence,now)||
  !digestValid(latest.PrivacyReceiptsDigest)||
  latest.PrivacyReceiptsDigest!=restored.PrivacyReceiptsDigest||
  latest.PrivacyReceiptsCount!=restored.PrivacyReceiptsCount {
  return ErrC076UnsafeRestore
 }
 return nil
}
