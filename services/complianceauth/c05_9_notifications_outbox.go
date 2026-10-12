package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "time"
)

// Notification events revoke cached permissions; they NEVER confer permission.
// Persist the event atomically with the corresponding policy publication in
// the production store; the fixture implementation is not production durable.
type ComplianceImpactEvent struct {
 EventID string `json:"event_id"`
 Scope string `json:"scope"`
 Sequence uint64 `json:"sequence"`
 PolicyDigest string `json:"policy_digest"`
 RevocationEpoch uint64 `json:"revocation_epoch"`
 Kind string `json:"kind"`
 IssuedAt time.Time `json:"issued_at"`
 KeyID string `json:"key_id"`
 Signature []byte `json:"signature"`
}
type ComplianceOutboxItem struct {
 Event ComplianceImpactEvent
 Subscriber string
 Attempts uint32
 NextAttempt time.Time
 DeadLetter bool
 Acknowledged bool
}
type ComplianceOutboxStore interface {
 // AtomicPublish persists one signed event and subscriber fan-out atomically
 // with the canonical publication; refuses old sequence and duplicate IDs.
 PublishImpact(context.Context,ComplianceImpactEvent,[]string) error
 // Lease must return only the oldest unacknowledged item for each scope and
 // subscriber; never deliver sequence N+1 before N is acknowledged.
 LeaseImpact(context.Context,time.Time)(ComplianceOutboxItem,error)
 // Finish uses optimistic concurrency and durable state transitions.
 FinishImpact(context.Context,ComplianceOutboxItem,bool,time.Time,uint32) error
}
type ComplianceImpactSender interface{ SendInvalidation(context.Context,string,ComplianceImpactEvent) error }
type CompliancePolicyRereader interface{ ReadCurrentPolicy(context.Context,string)(PublicationFence,error) }
var ErrImpactUnavailable=errors.New("compliance impact unavailable")
func impactBytes(e ComplianceImpactEvent) ([]byte,error) {
 e.Signature=nil
 return json.Marshal(e)
}
func SignComplianceImpact(e ComplianceImpactEvent,secret ed25519.PrivateKey)(ComplianceImpactEvent,error){
 if len(secret)!=ed25519.PrivateKeySize||!c051Scope(e.Scope)||!c051Scope(e.EventID)||!c051Scope(e.KeyID)||!digestValid(e.PolicyDigest)||e.Sequence==0||e.IssuedAt.IsZero()||(e.Kind!="POLICY_CHANGED"&&e.Kind!="POLICY_REVOKED"){return ComplianceImpactEvent{},ErrImpactUnavailable}
 b,err:=impactBytes(e);if err!=nil{return ComplianceImpactEvent{},ErrImpactUnavailable}
 e.Signature=ed25519.Sign(secret,b);return e,nil
}
func VerifyComplianceImpact(e ComplianceImpactEvent,public ed25519.PublicKey)bool{
 if len(public)!=ed25519.PublicKeySize||len(e.Signature)!=ed25519.SignatureSize||!c051Scope(e.Scope)||!c051Scope(e.EventID)||!c051Scope(e.KeyID)||!digestValid(e.PolicyDigest)||e.Sequence==0||e.IssuedAt.IsZero()||(e.Kind!="POLICY_CHANGED"&&e.Kind!="POLICY_REVOKED"){return false}
 b,err:=impactBytes(e);return err==nil&&ed25519.Verify(public,b,e.Signature)
}
func PublishComplianceImpact(ctx context.Context,store ComplianceOutboxStore,e ComplianceImpactEvent,subscribers []string,public ed25519.PublicKey)error{
 if ctx==nil||ctx.Err()!=nil||store==nil||!VerifyComplianceImpact(e,public)||len(subscribers)==0||len(subscribers)>256{return ErrImpactUnavailable}
 seen:=map[string]bool{}
 for _,s:=range subscribers{if !c051Scope(s)||seen[s]{return ErrImpactUnavailable};seen[s]=true}
 if err:=store.PublishImpact(ctx,e,subscribers);err!=nil{return ErrImpactUnavailable}
 return nil
}
// Delivery means "invalidate and re-read", never "ALLOW". The consumer
// must re-read canonical policy; a stale or missing read rejects the event.
func ConsumeComplianceImpact(ctx context.Context,e ComplianceImpactEvent,pub ed25519.PublicKey,reader CompliancePolicyRereader)error{
 if ctx==nil||ctx.Err()!=nil||reader==nil||!VerifyComplianceImpact(e,pub){return ErrImpactUnavailable}
 current,err:=reader.ReadCurrentPolicy(ctx,e.Scope)
 if err!=nil||ctx.Err()!=nil||current.Sequence<e.Sequence||current.RevocationEpoch<e.RevocationEpoch||current.PolicyDigest!=e.PolicyDigest{return ErrImpactUnavailable}
 return nil
}
func DeliverComplianceImpact(ctx context.Context,store ComplianceOutboxStore,sender ComplianceImpactSender,now time.Time,maxAttempts uint32)error{
 if ctx==nil||ctx.Err()!=nil||store==nil||sender==nil||now.IsZero()||maxAttempts<1||maxAttempts>100{return ErrImpactUnavailable}
 item,err:=store.LeaseImpact(ctx,now)
 if err!=nil||item.DeadLetter||item.Acknowledged||item.Attempts>=maxAttempts||!c051Scope(item.Subscriber)||item.NextAttempt.After(now){return ErrImpactUnavailable}
 err=sender.SendInvalidation(ctx,item.Subscriber,item.Event)
 if ctx.Err()!=nil{return ErrImpactUnavailable}
 next:=now
 if err!=nil{
  attempt:=item.Attempts+1
  if attempt>=maxAttempts{return store.FinishImpact(ctx,item,false,now,maxAttempts)}
  delay:=time.Second*time.Duration(1<<min(attempt,10))
  next=now.Add(delay)
 }
 if finishErr:=store.FinishImpact(ctx,item,err==nil,next,maxAttempts);finishErr!=nil{return ErrImpactUnavailable}
 if err!=nil{return ErrImpactUnavailable}
 return nil
}
// Payloads never contain personal/order/courier data, only hashes and scope.
func ComplianceImpactFingerprint(e ComplianceImpactEvent)string{
 b,_:=impactBytes(e);v:=sha256.Sum256(b);return hex.EncodeToString(v[:])
}
