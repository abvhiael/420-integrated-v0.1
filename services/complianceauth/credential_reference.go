package complianceauth

import (
 "context"
 "errors"
 "strings"
 "time"
)

var ErrCredentialReference = errors.New("invalid canonical credential reference")

// CredentialReference describes a credential without embedding private attributes
// or implying that 420Verify's software-verification results prove legal licensing.
type CredentialReference struct {
 Scheme string // 420compliance-credential/v1
 IssuerID string
 SubjectID string
 CredentialID string
 Kind string
 JurisdictionID string
 EvidenceDigest string
}

type CredentialVerification struct {
 Reference CredentialReference
 State string // VERIFIED, REVOKED, NOT_FOUND, UNAVAILABLE, UNKNOWN
 VerifiedAt time.Time
 ValidFrom time.Time
 ValidUntil time.Time
 RevokedAt time.Time
 TrustedIssuer bool
 EvidenceDigest string
}

// CredentialVerifier must be implemented by an independently trusted source.
// This package has no production regulator, licensing, or issuer adapter.
type CredentialVerifier interface {
 VerifyCredential(context.Context, CredentialReference) (CredentialVerification,error)
}

type CredentialAssessment struct {
 State string // VALID_REFERENCE, DENIED, UNAVAILABLE, REVIEW_REQUIRED
 ReasonCodes []string
 CredentialID string
 PolicyAuthorized bool
}

func validCredentialReference(ref CredentialReference) bool {
 if ref.Scheme!="420compliance-credential/v1" || !digestValid(ref.EvidenceDigest) {return false}
 for _,v:=range []string{ref.IssuerID,ref.SubjectID,ref.CredentialID,ref.Kind,ref.JurisdictionID} {
  if v==""||strings.TrimSpace(v)!=v||len(v)>128||strings.ContainsAny(v,"\x00\n\r") {return false}
 }
 return true
}

// AssessCredential always fails closed on stale, unavailable or unverified issuers.
// A verified credential is a necessary fact, never transaction authorization.
func AssessCredential(ctx context.Context, verifier CredentialVerifier, ref CredentialReference, now time.Time, maxAge time.Duration) CredentialAssessment {
 out:=CredentialAssessment{State:"REVIEW_REQUIRED",CredentialID:ref.CredentialID}
 if !validCredentialReference(ref)||now.IsZero()||maxAge<=0 {
  out.ReasonCodes=[]string{"INVALID_CREDENTIAL_REQUEST"};return out
 }
 if verifier==nil {out.State="UNAVAILABLE";out.ReasonCodes=[]string{"VERIFIER_UNAVAILABLE"};return out}
 if ctx==nil||ctx.Err()!=nil {out.State="UNAVAILABLE";out.ReasonCodes=[]string{"VERIFICATION_INTERRUPTED"};return out}
 v,err:=verifier.VerifyCredential(ctx,ref)
 if err!=nil {out.State="UNAVAILABLE";out.ReasonCodes=[]string{"VERIFIER_UNAVAILABLE"};return out}
 if v.Reference!=ref||v.EvidenceDigest!=ref.EvidenceDigest||!v.TrustedIssuer {
  out.ReasonCodes=[]string{"UNTRUSTED_CREDENTIAL_EVIDENCE"};return out
 }
 switch v.State {
 case "REVOKED":
  out.State="DENIED";out.ReasonCodes=[]string{"CREDENTIAL_REVOKED"};return out
 case "NOT_FOUND":
  out.State="DENIED";out.ReasonCodes=[]string{"CREDENTIAL_NOT_FOUND"};return out
 case "UNAVAILABLE":
  out.State="UNAVAILABLE";out.ReasonCodes=[]string{"VERIFIER_UNAVAILABLE"};return out
 case "UNKNOWN":
  out.ReasonCodes=[]string{"CREDENTIAL_UNKNOWN"};return out
 case "VERIFIED":
 default:
  out.ReasonCodes=[]string{"UNKNOWN_VERIFICATION_STATUS"};return out
 }
 if v.VerifiedAt.IsZero()||v.VerifiedAt.After(now)||now.Sub(v.VerifiedAt)>maxAge {
  out.ReasonCodes=[]string{"VERIFICATION_STALE"};return out
 }
 if v.ValidFrom.IsZero()||now.Before(v.ValidFrom)||v.ValidUntil.IsZero()||!now.Before(v.ValidUntil) {
  out.State="DENIED";out.ReasonCodes=[]string{"CREDENTIAL_OUTSIDE_VALIDITY"};return out
 }
 if !v.RevokedAt.IsZero() {
  if !now.Before(v.RevokedAt){out.State="DENIED";out.ReasonCodes=[]string{"CREDENTIAL_REVOKED"};return out}
  out.ReasonCodes=[]string{"CONTRADICTORY_REVOCATION_EVIDENCE"};return out
 }
 out.State="VALID_REFERENCE"
 out.ReasonCodes=[]string{"CREDENTIAL_CURRENT_NO_POLICY_AUTHORIZATION"}
 return out
}
