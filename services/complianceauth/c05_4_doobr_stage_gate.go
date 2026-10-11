package complianceauth

import (
 "context"
 "errors"
 "sync"
 "time"
)

// C054 stages are strictly forward-only. Each entry point (HTTP, worker,
// offline replay, operator action) must call the same server-side gate.
type DOOBrStage string
const (
 DOOBrAccept DOOBrStage="ACCEPT"
 DOOBrPickup DOOBrStage="PICKUP"
 DOOBrDispatch DOOBrStage="DISPATCH"
 DOOBrHandover DOOBrStage="HANDOVER"
)
type DOOBrEntry string
const(
 EntryAPI DOOBrEntry="API"
 EntryAlternate DOOBrEntry="ALTERNATE_ENDPOINT"
 EntryMobileReplay DOOBrEntry="MOBILE_REPLAY"
 EntryOperator DOOBrEntry="OPERATOR"
)
type DOOBrStageRequest struct {
 TenantID string
 OrderID string
 Stage DOOBrStage
 Entry DOOBrEntry
 ActorID string
 IdempotencyKey string
 FactsDigest string
 ExpectedRevision uint64
}
type DOOBrStageState struct {
 TenantID string
 OrderID string
 Stage DOOBrStage
 Revision uint64
 LastIdempotencyKey string
 LastFactsDigest string
 LastActorID string
}
// DOOBrStageAuthority must verify current policy, stage-bound independent
// credentials, retailer/carrier, operator roles and source freshness afresh.
// No decision cached by a device or earlier stage is sufficient.
type DOOBrStageAuthority interface {
 VerifyStage(context.Context,DOOBrStageRequest,time.Time)error
}
// DOOBrStageStore must provide strongly consistent atomic CAS across every
// deployed endpoint and worker. An in-memory fixture is never production safe.
type DOOBrStageStore interface {
 LoadStage(context.Context,string,string)(DOOBrStageState,error)
 CompareAndSwapStage(context.Context,DOOBrStageState,DOOBrStageState)(bool,error)
}
var ErrDOOBrStageDenied=errors.New("doobr stage gate denied")
func doobrStep(s DOOBrStage)int{
 switch s{case DOOBrAccept:return 1;case DOOBrPickup:return 2;case DOOBrDispatch:return 3;case DOOBrHandover:return 4}
 return 0
}
func AdvanceDOOBrStage(ctx context.Context,store DOOBrStageStore,authority DOOBrStageAuthority,req DOOBrStageRequest,now time.Time)(DOOBrStageState,error){
 var zero DOOBrStageState
 if ctx==nil||ctx.Err()!=nil||store==nil||authority==nil||now.IsZero()||!c051Scope(req.TenantID)||!c051Scope(req.OrderID)||!c051Scope(req.ActorID)||!c051Scope(req.IdempotencyKey)||!digestValid(req.FactsDigest)||doobrStep(req.Stage)==0{return zero,ErrDOOBrStageDenied}
 switch req.Entry {case EntryAPI,EntryAlternate,EntryMobileReplay,EntryOperator:default:return zero,ErrDOOBrStageDenied}
 old,err:=store.LoadStage(ctx,req.TenantID,req.OrderID)
 if err!=nil||old.TenantID!=req.TenantID||old.OrderID!=req.OrderID||old.Revision!=req.ExpectedRevision||old.Revision==0||doobrStep(req.Stage)!=doobrStep(old.Stage)+1{return zero,ErrDOOBrStageDenied}
 // Even an identical replay is denied rather than reissuing authorization.
 if old.LastIdempotencyKey==req.IdempotencyKey{return zero,ErrDOOBrStageDenied}
 if err:=authority.VerifyStage(ctx,req,now);err!=nil||ctx.Err()!=nil{return zero,ErrDOOBrStageDenied}
 next:=old
 next.Stage=req.Stage;next.Revision++
 next.LastIdempotencyKey=req.IdempotencyKey;next.LastFactsDigest=req.FactsDigest;next.LastActorID=req.ActorID
 ok,err:=store.CompareAndSwapStage(ctx,old,next)
 if err!=nil||!ok{return zero,ErrDOOBrStageDenied}
 return next,nil
}
// MemoryDOOBrStageStore is a test fixture only, never cross-instance durable.
type MemoryDOOBrStageStore struct{
 mu sync.Mutex
 States map[string]DOOBrStageState
}
func doobrKey(tenant,order string)string{return tenant+"\x00"+order}
func(s *MemoryDOOBrStageStore)LoadStage(ctx context.Context,tenant,order string)(DOOBrStageState,error){
 if s==nil||ctx==nil||ctx.Err()!=nil{return DOOBrStageState{},ErrDOOBrStageDenied}
 s.mu.Lock();defer s.mu.Unlock()
 x,ok:=s.States[doobrKey(tenant,order)]
 if !ok{return DOOBrStageState{},ErrDOOBrStageDenied}
 return x,nil
}
func(s *MemoryDOOBrStageStore)CompareAndSwapStage(ctx context.Context,old,next DOOBrStageState)(bool,error){
 if s==nil||ctx==nil||ctx.Err()!=nil{return false,ErrDOOBrStageDenied}
 s.mu.Lock();defer s.mu.Unlock()
 k:=doobrKey(old.TenantID,old.OrderID)
 if s.States[k]!=old{return false,nil}
 s.States[k]=next;return true,nil
}
