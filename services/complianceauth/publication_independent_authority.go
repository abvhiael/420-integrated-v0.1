package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/sha256"
 "encoding/json"
 "errors"
 "time"
)

// PublicationApproval must originate from a separately controlled legal
// authorization service. The signing private key is never stored here.
type PublicationApproval struct {
 KeyID string
 ReviewerID string
 PublisherID string
 Before PublicationFence
 After PublicationFence
 ValidUntil time.Time
 Signature []byte
}
type PublicationApprovalProvider interface {
 Approval(context.Context,PublicationFence,PublicationFence)(PublicationApproval,error)
}
type SignedIndependentPublicationAuthority struct{
 TrustedReviewerKeys map[string]ed25519.PublicKey
 Provider PublicationApprovalProvider
 Clock func()time.Time
}
func publicationApprovalBytes(a PublicationApproval)([]byte,error){
 // Domain separation prevents signature reuse from other subsystems.
 return json.Marshal(struct{
  Domain string
  KeyID string
  ReviewerID string
  PublisherID string
  Before PublicationFence
  After PublicationFence
  ValidUntil time.Time
 }{"420compliance-independent-publication/v1",a.KeyID,a.ReviewerID,a.PublisherID,a.Before,a.After,a.ValidUntil})
}
func(a SignedIndependentPublicationAuthority) VerifyPublication(ctx context.Context,old,next PublicationFence)error{
 if ctx==nil||ctx.Err()!=nil||a.Provider==nil||a.Clock==nil{return ErrUnauthorized}
 approval,err:=a.Provider.Approval(ctx,old,next)
 if err!=nil{return errors.Join(ErrUnauthorized,err)}
 key,ok:=a.TrustedReviewerKeys[approval.KeyID]
 now:=a.Clock()
 if !ok||len(key)!=ed25519.PublicKeySize||approval.KeyID==""||approval.ReviewerID==""||approval.PublisherID==""||approval.ReviewerID==approval.PublisherID||
 approval.Before!=old||approval.After!=next||now.IsZero()||!now.Before(approval.ValidUntil)||approval.ValidUntil.After(now.Add(5*time.Minute))||len(approval.Signature)!=ed25519.SignatureSize{return ErrUnauthorized}
 payload,err:=publicationApprovalBytes(approval)
 if err!=nil||!ed25519.Verify(key,payload,approval.Signature){return ErrUnauthorized}
 return nil
}
var _ IndependentPublicationAuthority=SignedIndependentPublicationAuthority{}
var _ = sha256.Size
