package complianceauth

import (
 "context"
 "errors"
 "time"
)

// C05.5 never reopens sale authorization. Safety and return custody are
// independent, stage-bound workflows with a distinct reviewer and revocation.
type DOOBrRecoveryAction string
const (
 RecoveryRefuse DOOBrRecoveryAction = "REFUSE"
 RecoveryReturn DOOBrRecoveryAction = "RETURN_TO_ORIGIN"
 RecoverySecure DOOBrRecoveryAction = "SECURE_GOODS"
)
type DOOBrRecoveryRequest struct {
 TenantID string
 OrderID string
 ActorID string
 IdempotencyKey string
 FactsDigest string
 PriorReceiptDigest string
 NewPolicyDigest string
 Action DOOBrRecoveryAction
 ExpectedRevision uint64
 PolicyChange bool
}
type DOOBrRecoveryState struct {
 TenantID string
 OrderID string
 Revision uint64
 Phase string
 SaleHalted bool
 LastIdempotencyKey string
 PriorReceiptDigest string
 NewPolicyDigest string
}
// A separate reviewer and safety authority must be consulted at execution,
// regardless of the status of sale authorization.
type DOOBrRecoveryAuthority interface {
 VerifySafetyAction(context.Context, DOOBrRecoveryRequest, DOOBrRecoveryState, time.Time) error
}
type DOOBrRecoveryStore interface {
 LoadRecovery(context.Context,string,string)(DOOBrRecoveryState,error)
 CompareAndSwapRecovery(context.Context,DOOBrRecoveryState,DOOBrRecoveryState)(bool,error)
}
var ErrRecoveryDenied=errors.New("doobr recovery action denied")
func RecoverDOOBrOrder(ctx context.Context,store DOOBrRecoveryStore,authority DOOBrRecoveryAuthority,req DOOBrRecoveryRequest,now time.Time)(DOOBrRecoveryState,error){
 var zero DOOBrRecoveryState
 if ctx==nil||ctx.Err()!=nil||store==nil||authority==nil||now.IsZero()||!c051Scope(req.TenantID)||!c051Scope(req.OrderID)||!c051Scope(req.ActorID)||!c051Scope(req.IdempotencyKey)||!digestValid(req.FactsDigest)||!digestValid(req.PriorReceiptDigest)||!digestValid(req.NewPolicyDigest){return zero,ErrRecoveryDenied}
 if req.Action!=RecoveryRefuse&&req.Action!=RecoveryReturn&&req.Action!=RecoverySecure{return zero,ErrRecoveryDenied}
 old,err:=store.LoadRecovery(ctx,req.TenantID,req.OrderID)
 if err!=nil||old.TenantID!=req.TenantID||old.OrderID!=req.OrderID||old.Revision==0||old.Revision!=req.ExpectedRevision||old.LastIdempotencyKey==req.IdempotencyKey||old.Phase=="RETURNED"||old.Phase=="HANDED_OVER"{return zero,ErrRecoveryDenied}
 // Never allow safety processing to continue or reinstate normal sale flow.
 if req.PolicyChange&&(!old.SaleHalted||old.PriorReceiptDigest!=req.PriorReceiptDigest||old.NewPolicyDigest!=req.NewPolicyDigest){return zero,ErrRecoveryDenied}
 // A returned package must first be refused or secured and remain in custody.
 switch req.Action {
 case RecoveryRefuse:
  if old.Phase!="IN_TRANSIT"&&old.Phase!="AT_DOOR"{return zero,ErrRecoveryDenied}
 case RecoverySecure:
  if old.Phase!="IN_TRANSIT"&&old.Phase!="REFUSED"&&old.Phase!="AT_DOOR"{return zero,ErrRecoveryDenied}
 case RecoveryReturn:
  if old.Phase!="REFUSED"&&old.Phase!="SECURED"{return zero,ErrRecoveryDenied}
 }
 if err:=authority.VerifySafetyAction(ctx,req,old,now);err!=nil||ctx.Err()!=nil{return zero,ErrRecoveryDenied}
 next:=old;next.Revision++;next.SaleHalted=true;next.LastIdempotencyKey=req.IdempotencyKey
 switch req.Action{case RecoveryRefuse:next.Phase="REFUSED";case RecoverySecure:next.Phase="SECURED";case RecoveryReturn:next.Phase="RETURNED"}
 ok,err:=store.CompareAndSwapRecovery(ctx,old,next)
 if err!=nil||!ok{return zero,ErrRecoveryDenied}
 return next,nil
}
