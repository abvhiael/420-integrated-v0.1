package complianceauth

import (
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "sync"
 "time"
)

var ErrReceiptRejected=errors.New("bound compliance receipt rejected")
type BoundDecisionReceipt struct {
 ReceiptID string
 TenantID string
 OperationRef string
 Stage string
 Action string
 Audience string
 Jurisdiction string
 FactsDigest string
 RequestDigest string
 PolicyDigest string
 IssuedAt time.Time
 ExpiresAt time.Time
}
// ReceiptLedger is process-local; deployed multi-instance protection requires
// one durable transactional nonce store, not an in-memory map.
type ReceiptLedger struct {
 mu sync.Mutex
 spent map[string]bool
 issued map[string]BoundDecisionReceipt
 nonces map[string]bool
}
func (l *ReceiptLedger) Issue(service EvaluationService,policy ReviewedPolicy,request EvaluationRequest,now time.Time,ttl time.Duration,nonce string)(BoundDecisionReceipt,error){
 if l==nil||nonce==""||len(nonce)>128||ttl<=0||ttl>5*time.Minute||now.IsZero(){return BoundDecisionReceipt{},ErrReceiptRejected}
 decision:=service.Evaluate(policy,request,now)
 if decision.Outcome!="ALLOW"||!digestValid(decision.PolicyDigest)||!digestValid(decision.RequestDigest)||!now.Before(decision.ExpiresAt){return BoundDecisionReceipt{},ErrReceiptRejected}
 expires:=now.Add(ttl);if decision.ExpiresAt.Before(expires){expires=decision.ExpiresAt}
 if !now.Before(expires){return BoundDecisionReceipt{},ErrReceiptRejected}
 payload,err:=json.Marshal(struct{Request EvaluationRequest;Nonce string;At time.Time}{request,nonce,now})
 if err!=nil{return BoundDecisionReceipt{},ErrReceiptRejected}
 h:=sha256.Sum256(payload);id:=hex.EncodeToString(h[:])
 receipt:=BoundDecisionReceipt{ReceiptID:id,TenantID:request.TenantID,OperationRef:request.OperationRef,Stage:request.Stage,Action:request.Action,Audience:request.Audience,Jurisdiction:request.Jurisdiction,FactsDigest:request.FactsDigest,RequestDigest:decision.RequestDigest,PolicyDigest:decision.PolicyDigest,IssuedAt:now,ExpiresAt:expires}
 l.mu.Lock();defer l.mu.Unlock()
 if l.issued==nil{l.issued=map[string]BoundDecisionReceipt{}}
 if l.spent==nil{l.spent=map[string]bool{}}
 if l.nonces==nil{l.nonces=map[string]bool{}}
 nonceKey:=request.TenantID+"\\x00"+request.OperationRef+"\\x00"+nonce
 if l.nonces[nonceKey]{return BoundDecisionReceipt{},ErrReceiptRejected}
 if _,exists:=l.issued[id];exists||l.spent[id]{return BoundDecisionReceipt{},ErrReceiptRejected}
 l.nonces[nonceKey]=true
 l.issued[id]=receipt
 return receipt,nil
}
// ConsumeAndReevaluate never treats an old receipt as permission at the next
// action stage: the supplied next-stage request must pass a fresh evaluation.
func (l *ReceiptLedger) ConsumeAndReevaluate(service EvaluationService,policy ReviewedPolicy,receipt BoundDecisionReceipt,original EvaluationRequest,next EvaluationRequest,now time.Time)error{
 if l==nil||receipt.ReceiptID==""||now.IsZero()||now.Before(receipt.IssuedAt)||!now.Before(receipt.ExpiresAt)||next.Stage==original.Stage||
 next.TenantID!=original.TenantID||next.OperationRef!=original.OperationRef||next.Audience!=original.Audience||next.Domain!=original.Domain||next.Jurisdiction!=original.Jurisdiction{return ErrReceiptRejected}
 serialized,err:=json.Marshal(original);if err!=nil{return ErrReceiptRejected}
 h:=sha256.Sum256(serialized)
 if receipt.TenantID!=original.TenantID||receipt.OperationRef!=original.OperationRef||receipt.Stage!=original.Stage||receipt.Action!=original.Action||receipt.FactsDigest!=original.FactsDigest||receipt.Audience!=original.Audience||receipt.Jurisdiction!=original.Jurisdiction||receipt.RequestDigest!=hex.EncodeToString(h[:]){return ErrReceiptRejected}
 // One transaction-local critical section: replay cannot race a second consume.
 l.mu.Lock();defer l.mu.Unlock()
 recorded,exists:=l.issued[receipt.ReceiptID]
 if !exists||recorded!=receipt||l.spent[receipt.ReceiptID]{return ErrReceiptRejected}
 l.spent[receipt.ReceiptID]=true
 // Fail closed and burn the receipt even when downstream evidence is unavailable.
 decision:=service.Evaluate(policy,next,now)
 if decision.Outcome!="ALLOW"||decision.PolicyDigest!=receipt.PolicyDigest||!now.Before(decision.ExpiresAt){return ErrReceiptRejected}
 return nil
}
