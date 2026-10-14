package complianceauth

import (
 "context"
 "crypto/ed25519"
 "encoding/json"
 "errors"
 "sync"
)

// C076SignedCheckpoint is authenticated *outside* the restored PostgreSQL.
// It binds an independently signed checkpoint to an immutable recovery epoch.
// Durable authority implementations must reject rollback at their own
// storage/attestation layer; verifying a signature alone cannot prove freshness.
type C076SignedCheckpoint struct {
 Checkpoint C076Checkpoint
 Issuer string
 Signature []byte
}
func c076SignedBytes(v C076SignedCheckpoint)[]byte{
 v.Signature=nil
 b,_:=json.Marshal(v)
 return b
}
func VerifyC076SignedCheckpoint(ctx context.Context,v C076SignedCheckpoint,keys map[string]ed25519.PublicKey)error{
 if ctx==nil||ctx.Err()!=nil||v.Issuer==""||v.Checkpoint.Generation==0||
  v.Checkpoint.Scope==""||v.Checkpoint.Scope!=v.Checkpoint.Fence.Scope||
  !digestValid(v.Checkpoint.PrivacyReceiptsDigest){return ErrC076UnsafeRestore}
 key,ok:=keys[v.Issuer]
 if !ok||len(key)!=ed25519.PublicKeySize||!ed25519.Verify(key,c076SignedBytes(v),v.Signature){return ErrC076UnsafeRestore}
 return nil
}

// C076MonotonicBackend MUST be a distinct independently protected storage
// authority, not a database restored with the Compliance primary. Advance must
// be a durable linearizable CAS with strictly increasing generation and
// nondecreasing publication sequence, revocation epoch and deletion count.
// WithCurrent must serialize all writers with the release callback, and keep
// the platform isolated if any check or callback fails.
type C076MonotonicBackend interface {
 ReadSigned(context.Context,string)(C076SignedCheckpoint,error)
 WithCurrent(context.Context,C076Checkpoint,func(context.Context)error)error
}

// C076AuthenticatedAuthority wraps a durable external backend with pinned
// issuer verification and shared out-of-band tombstone journal access.
type C076AuthenticatedAuthority struct{
 Backend C076MonotonicBackend
 Witnesses interface{ ReadWitness(context.Context,string)(C076Witness,error) }
 TrustedIssuers map[string]ed25519.PublicKey
 mu sync.Mutex
 highWater map[string]C076Checkpoint // in-process additional check, NOT durable authority
}
func(a *C076AuthenticatedAuthority) LatestCheckpoint(ctx context.Context,scope string)(C076Checkpoint,error){
 if a==nil||a.Backend==nil||!c051Scope(scope)||ctx==nil||ctx.Err()!=nil{return C076Checkpoint{},ErrC076UnsafeRestore}
 v,e:=a.Backend.ReadSigned(ctx,scope)
 if e!=nil||VerifyC076SignedCheckpoint(ctx,v,a.TrustedIssuers)!=nil||v.Checkpoint.Scope!=scope{return C076Checkpoint{},ErrC076UnsafeRestore}
 a.mu.Lock();defer a.mu.Unlock()
 if a.highWater==nil{a.highWater=make(map[string]C076Checkpoint)}
 prior,seen:=a.highWater[scope]
 now:=v.Checkpoint
 if seen&&(now.Generation<prior.Generation||now.Fence.Sequence<prior.Fence.Sequence||
  now.Fence.RevocationEpoch<prior.Fence.RevocationEpoch||
  now.PrivacyReceiptsCount<prior.PrivacyReceiptsCount){return C076Checkpoint{},ErrC076UnsafeRestore}
 a.highWater[scope]=now
 return now,nil
}
func(a *C076AuthenticatedAuthority) RecoverWitness(ctx context.Context,scope string)(C076Witness,error){
 current,e:=a.LatestCheckpoint(ctx,scope)
 if e!=nil||a.Witnesses==nil{return C076Witness{},ErrC076UnsafeRestore}
 w,e:=a.Witnesses.ReadWitness(ctx,scope)
 if e!=nil||w.Checkpoint!=current{return C076Witness{},ErrC076UnsafeRestore}
 return w,nil
}
func(a *C076AuthenticatedAuthority) ReleaseIfCurrent(ctx context.Context,expected C076Checkpoint,g uint64,p C076RecoveryPlatform)error{
 if a==nil||a.Backend==nil||p==nil||ctx==nil||ctx.Err()!=nil||
  expected.Generation==0||g!=expected.Generation+1||g==0{return ErrC076UnsafeRestore}
 // Linearization is owned by the durable authority backend. All checkpoint
 // writers must share its serialization point. A plain read+release is unsafe.
 e:=a.Backend.WithCurrent(ctx,expected,func(guard context.Context)error{
  if guard==nil||guard.Err()!=nil{return ErrC076UnsafeRestore}
  return p.Release(guard,expected.Scope,g)
 })
 if e!=nil{return errors.Join(ErrC076UnsafeRestore,e)}
 return nil
}
