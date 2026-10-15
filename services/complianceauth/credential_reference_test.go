package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type fixtureCredentialVerifier struct{
 result CredentialVerification
 err error
 calls int
}
func (f *fixtureCredentialVerifier) VerifyCredential(_ context.Context,_ CredentialReference)(CredentialVerification,error){f.calls++;return f.result,f.err}

func TestC036CanonicalCredentialReferences(t *testing.T){
 now:=time.Date(2026,10,10,21,0,0,0,time.UTC)
 ref:=CredentialReference{Scheme:"420compliance-credential/v1",IssuerID:"fixture-regulator",SubjectID:"fixture-retailer",CredentialID:"license-ref-1",Kind:"RETAILER_LICENSE",JurisdictionID:"CA-BC",EvidenceDigest:Digest([]byte("fixture-verified-evidence"))}
 v:=CredentialVerification{Reference:ref,State:"VERIFIED",VerifiedAt:now.Add(-time.Minute),ValidFrom:now.Add(-24*time.Hour),ValidUntil:now.Add(time.Hour),TrustedIssuer:true,EvidenceDigest:ref.EvidenceDigest}
 makeCheck:=func(x CredentialVerification,err error) CredentialAssessment {f:=&fixtureCredentialVerifier{result:x,err:err};out:=AssessCredential(context.Background(),f,ref,now,5*time.Minute);if f.calls!=1 {t.Fatalf("verifier called %d times",f.calls)};if out.PolicyAuthorized{t.Fatal("credential permitted policy")};return out}
 good:=makeCheck(v,nil);if good.State!="VALID_REFERENCE"{t.Fatalf("good fixture %+v",good)}
 cases:=[]struct{name,expected string;update func(*CredentialVerification)}{
 {"revoked","DENIED",func(x *CredentialVerification){x.State="REVOKED"}},
 {"not found","DENIED",func(x *CredentialVerification){x.State="NOT_FOUND"}},
 {"provider unavailable","UNAVAILABLE",func(x *CredentialVerification){x.State="UNAVAILABLE"}},
 {"unknown","REVIEW_REQUIRED",func(x *CredentialVerification){x.State="UNKNOWN"}},
 {"untrusted issuer","REVIEW_REQUIRED",func(x *CredentialVerification){x.TrustedIssuer=false}},
 {"issuer mismatch","REVIEW_REQUIRED",func(x *CredentialVerification){x.Reference.IssuerID="attacker"}},
 {"source digest mismatch","REVIEW_REQUIRED",func(x *CredentialVerification){x.EvidenceDigest=Digest([]byte("other"))}},
 {"stale","REVIEW_REQUIRED",func(x *CredentialVerification){x.VerifiedAt=now.Add(-6*time.Minute)}},
 {"future verification","REVIEW_REQUIRED",func(x *CredentialVerification){x.VerifiedAt=now.Add(time.Minute)}},
 {"not yet valid","DENIED",func(x *CredentialVerification){x.ValidFrom=now.Add(time.Minute)}},
 {"expired","DENIED",func(x *CredentialVerification){x.ValidUntil=now}},
 {"already revoked","DENIED",func(x *CredentialVerification){x.RevokedAt=now.Add(-time.Minute)}},
 {"conflicting revocation","REVIEW_REQUIRED",func(x *CredentialVerification){x.RevokedAt=now.Add(time.Hour)}},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){x:=v;tc.update(&x);d:=makeCheck(x,nil);if d.State!=tc.expected||len(d.ReasonCodes)==0{t.Fatalf("unexpected result %+v",d)}})}
 if d:=makeCheck(v,errors.New("outage"));d.State!="UNAVAILABLE"{t.Fatalf("outage %+v",d)}
 if d:=AssessCredential(context.Background(),nil,ref,now,5*time.Minute);d.State!="UNAVAILABLE"||d.PolicyAuthorized{t.Fatalf("nil provider %+v",d)}
 altered:=ref;altered.CredentialID=""
 f:=&fixtureCredentialVerifier{result:v}
 if d:=AssessCredential(context.Background(),f,altered,now,5*time.Minute);d.State!="REVIEW_REQUIRED"||f.calls!=0{t.Fatalf("invalid ref contacted provider %+v",d)}
 if d:=AssessCredential(context.Background(),f,ref,now,0);d.State!="REVIEW_REQUIRED"||f.calls!=0{t.Fatalf("invalid freshness contacted provider %+v",d)}
 cancelled,cancel:=context.WithCancel(context.Background());cancel()
 if d:=AssessCredential(cancelled,f,ref,now,5*time.Minute);d.State!="UNAVAILABLE"||f.calls!=0{t.Fatalf("cancelled verification %+v",d)}
}
