package complianceauth

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "time"
)

// ActivationImpact is advisory only. DOOBr owns order stop, reassess and return;
// Compliance never mutates an order, releases a shipment or revives an old ALLOW.
type ActivationOrder struct {
 OrderID string
 Scope string
 Stage string
 PreviousReceipt BoundDecisionReceipt
}
type ActivationImpact struct {
 OrderID string
 Action string
 Reason string
 PreviousReceiptDigest string
 PreviousPolicyDigest string
 NewPolicyDigest string
 PreviousSequence uint64
 NewSequence uint64
}
type ActivationImpactReport struct {
 Impacts []ActivationImpact
 InvalidateCachedGuidance bool
 Authorized bool
}
func AssessActivationImpact(ctx context.Context,store PublicationStore,cache *PublicationCache,previous,next PublicationFence,orders []ActivationOrder,now time.Time)(ActivationImpactReport,error){
 var result ActivationImpactReport
 if ctx==nil||ctx.Err()!=nil||store==nil||cache==nil||!ValidPublicationFence(previous,now)||!ValidPublicationFence(next,now)||previous.Scope!=next.Scope||next.Sequence<=previous.Sequence||next.RevocationEpoch<previous.RevocationEpoch||len(orders)>10000{return result,ErrPublicationStale}
 current,err:=store.Load(ctx,next.Scope)
 if err!=nil||current!=next{return result,ErrPublicationStale}
 // Reject and invalidate guidance on any activation, including same-content
 // revision. The cache is merely a hint and cannot override the current fence.
 cache.Invalidate(next.Scope)
 result.InvalidateCachedGuidance=true
 seen:=map[string]bool{}
 for _,order:=range orders {
  if ctx.Err()!=nil||order.OrderID==""||seen[order.OrderID]||order.Scope!=next.Scope{return ActivationImpactReport{},ErrPublicationStale}
  seen[order.OrderID]=true
  receipt:=order.PreviousReceipt
  if receipt.ReceiptID==""||receipt.OperationRef!=order.OrderID||receipt.PolicyDigest!=previous.PolicyDigest||!digestValid(receipt.PolicyDigest){return ActivationImpactReport{},ErrPublicationStale}
  bytes,e:=json.Marshal(receipt);if e!=nil{return ActivationImpactReport{},ErrPublicationStale}
  hash:=sha256.Sum256(bytes)
  action:="STOP_AND_REASSESS"
  if order.Stage=="IN_TRANSIT"||order.Stage=="REFUSED"||order.Stage=="FAILED_DELIVERY"{action="STOP_REASSESS_RETURN_REVIEW"}
  if order.Stage!="PENDING"&&order.Stage!="PREPARING"&&order.Stage!="IN_TRANSIT"&&order.Stage!="REFUSED"&&order.Stage!="FAILED_DELIVERY"{return ActivationImpactReport{},ErrPublicationStale}
  result.Impacts=append(result.Impacts,ActivationImpact{OrderID:order.OrderID,Action:action,Reason:"POLICY_ACTIVATION_REQUIRES_NEW_STAGE_DECISION",PreviousReceiptDigest:hex.EncodeToString(hash[:]),PreviousPolicyDigest:previous.PolicyDigest,NewPolicyDigest:next.PolicyDigest,PreviousSequence:previous.Sequence,NewSequence:next.Sequence})
 }
 return result,nil
}
