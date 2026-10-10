package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "time"
)
// Signer is deliberately independent of the HTTP request path. Production implementations
// must use managed non-exportable keys and authenticate the signing workload.
type Signer interface {
 Sign(context.Context,string,[]byte)([]byte,error)
 PublicKey(context.Context,string)(ed25519.PublicKey,error)
}
type ManagedPublisher struct { Signer Signer; Trust Trust; Approvals ApprovalAuthority }
func (p ManagedPublisher) Publish(ctx context.Context,m Manifest,a Approval)(SignedManifest,error){
 if p.Signer==nil || p.Approvals==nil || p.Approvals.VerifyApproval(m.PolicyDigest,m.ReviewDigest,a.Digest,time.Now().UTC())!=nil || !a.IndependentlyVerified || a.AuthorID=="" || a.ReviewerID=="" || a.PublisherID=="" || a.AuthorID==a.ReviewerID || a.AuthorID==a.PublisherID || a.ReviewerID==a.PublisherID || !digestValid(m.PolicyDigest) || !digestValid(m.ReviewDigest) || subtle.ConstantTimeCompare([]byte(a.Digest),[]byte(m.PolicyDigest))!=1 {return SignedManifest{},ErrUnauthorized}
 if m.Environment!=p.Trust.Environment || m.Audience!=p.Trust.Audience || m.Domain!=p.Trust.Domain || m.Jurisdiction!=p.Trust.Jurisdiction || m.Sequence<p.Trust.MinimumSequence || m.RevocationEpoch<p.Trust.MinimumEpoch || m.Sequence==0 || m.Schema!="420compliance-policy/v1" {return SignedManifest{},ErrUnauthorized}
 key,ok:=p.Trust.Keys[m.KeyID];if !ok||key.Revoked||key.Environment!=p.Trust.Environment{return SignedManifest{},ErrUnauthorized}
 payload,err:=canonical(m);if err!=nil{return SignedManifest{},err}
 signature,err:=p.Signer.Sign(ctx,m.KeyID,payload);if err!=nil{return SignedManifest{},ErrUnavailable}
 result:=SignedManifest{Manifest:m,Signature:signature}
 pub,err:=p.Signer.PublicKey(ctx,m.KeyID);if err!=nil||len(pub)!=ed25519.PublicKeySize || !ed25519.Verify(pub,payload,signature)||!ed25519.PublicKey(key.Public).Equal(pub) {return SignedManifest{},ErrUnauthorized}
 return result,nil
}
type Evidence struct {
 SourceVerified bool `json:"source_verified"`
 CredentialsVerified bool `json:"credentials_verified"`
 GeographyVerified bool `json:"geography_verified"`
 CurrentRevocation bool `json:"current_revocation"`
 PartnerVerified bool `json:"partner_verified"`
 RequiredFacts map[string]bool `json:"required_facts"`
}
type EvaluationRequest struct {
 TenantID string `json:"tenant_id"`
 Audience string `json:"audience"`
 OperationRef string `json:"operation_ref"`
 Stage string `json:"stage"`
 Action string `json:"action"`
 Domain string `json:"domain"`
 Jurisdiction string `json:"jurisdiction"`
 FactsDigest string `json:"facts_digest"`
}
type Requirement struct { ID string `json:"id"`; Fact string `json:"fact"`; Mandatory bool `json:"mandatory"` }
type ReviewedPolicy struct{
 Manifest SignedManifest
 ReviewID string
 Rules []Requirement
 ApprovalToken string // opaque external approval reference, not supplied by transaction caller.
}
type Decision struct {
 Outcome string `json:"outcome"`
 ReasonCodes []string `json:"reason_codes"`
 PolicyDigest string `json:"policy_digest,omitempty"`
 RequestDigest string `json:"request_digest,omitempty"`
 ExpiresAt time.Time `json:"expires_at,omitempty"`
}
func deny(outcome,reason string)Decision{return Decision{Outcome:outcome,ReasonCodes:[]string{reason}}}
// Evaluate produces policy evidence, never a bearer entitlement, payment authorization,
// or DOOBr workflow capability. Deployment must enforce trusted evidence adapters.
type ApprovalAuthority interface { VerifyApproval(policyDigest,reviewDigest,approvalToken string,now time.Time) error }
type CredentialAuthority interface { VerifyEvidence(request EvaluationRequest,now time.Time) (Evidence,error) }
// EvaluationService accepts evidence only from external independent verified adapters.
type EvaluationService struct { Trust Trust; Approvals ApprovalAuthority; Credentials CredentialAuthority }
func (service EvaluationService) Evaluate(p ReviewedPolicy,r EvaluationRequest,now time.Time)Decision {
 t:=service.Trust
 if service.Approvals==nil||service.Credentials==nil{return deny("UNKNOWN","INDEPENDENT_AUTHORITIES_UNAVAILABLE")}
 if p.ApprovalToken==""||service.Approvals.VerifyApproval(p.Manifest.Manifest.PolicyDigest,p.Manifest.Manifest.ReviewDigest,p.ApprovalToken,now)!=nil{return deny("UNKNOWN","LEGAL_REVIEW_UNVERIFIED")}
 checked,err:=service.Credentials.VerifyEvidence(r,now);if err!=nil{return deny("UNKNOWN","EVIDENCE_UNVERIFIED")}
 r.Evidence=checked
 if err:=t.Verify(p.Manifest,now);err!=nil{return deny("UNKNOWN","POLICY_UNAVAILABLE")}
 if p.ReviewID=="" || len(p.Rules)==0{return deny("UNKNOWN","REVIEW_OR_POLICY_MISSING")}
 if r.TenantID==""||r.OperationRef==""||r.Action==""||r.Stage==""||r.FactsDigest==""||!digestValid(r.FactsDigest)||r.Audience!=t.Audience||r.Domain!=t.Domain||r.Jurisdiction!=t.Jurisdiction{return deny("REVIEW_REQUIRED","CONTEXT_INCOMPLETE")}
 e:=r.Evidence
 if !e.SourceVerified||!e.CredentialsVerified||!e.GeographyVerified||!e.CurrentRevocation||!e.PartnerVerified{return deny("UNKNOWN","MANDATORY_EVIDENCE_UNAVAILABLE")}
 for _,rule:=range p.Rules {
   if rule.ID==""||rule.Fact=="" {return deny("UNKNOWN","INVALID_RULE")}
   ok,exists:=e.RequiredFacts[rule.Fact]
   if !exists {return deny("REVIEW_REQUIRED","FACT_MISSING")}
   if rule.Mandatory && !ok{return deny("DENY","REQUIREMENT_FAILED")}
 }
 bytes,err:=json.Marshal(r);if err!=nil{return deny("UNKNOWN","INPUT_ERROR")}
 hash:=sha256.Sum256(bytes)
 expires:=p.Manifest.EffectiveUntil
 if p.Manifest.ReviewExpiresAt.Before(expires){expires=p.Manifest.ReviewExpiresAt}
 if !now.Before(expires){return deny("UNKNOWN","EXPIRED")}
 return Decision{Outcome:"ALLOW",ReasonCodes:[]string{"REVIEWED_REQUIREMENTS_MET"},PolicyDigest:p.Manifest.PolicyDigest,RequestDigest:hex.EncodeToString(hash[:]),ExpiresAt:expires}
}
