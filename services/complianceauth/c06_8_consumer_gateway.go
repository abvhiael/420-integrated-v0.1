package complianceauth

import (
 "context"
 "errors"
)

// C06.8 consuming applications must fail closed for every non-ALLOW outcome.
// Decision authority stays with C05; this adapter NEVER upgrades an outcome.
var ErrC068ConsumerBlocked=errors.New("Compliance consumer must not proceed")
type C068ConsumerDecision struct {
 Outcome string
 Scope C064AuthorScope
 Audience string
 EvidenceDigest string
}
type C068ConsumerEvaluator interface {
 EvaluateForConsumer(context.Context,string,C064AuthorScope)(C068ConsumerDecision,error)
}
type C068ConsumerGateway struct {
 Devices C068DeviceGate
 Evaluator C068ConsumerEvaluator
}
func(g C068ConsumerGateway)Check(ctx context.Context,token,deviceID,audience string)(C068ConsumerDecision,error){
 if audience!="DOOBr"&&audience!="420Travel"{return C068ConsumerDecision{},ErrC068ConsumerBlocked}
 s,err:=g.Devices.Verify(ctx,token,deviceID,audience)
 if err!=nil||g.Evaluator==nil{return C068ConsumerDecision{},ErrC068ConsumerBlocked}
 d,err:=g.Evaluator.EvaluateForConsumer(ctx,audience,s.Scope)
 if err!=nil||d.Audience!=audience||d.Scope!=s.Scope||d.Outcome!="ALLOW"||
 !digestValid(d.EvidenceDigest){return C068ConsumerDecision{},ErrC068ConsumerBlocked}
 if err=g.Devices.RevalidateSession(ctx,token,s);err!=nil{return C068ConsumerDecision{},ErrC068ConsumerBlocked}
 return d,nil
}
