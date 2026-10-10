package complianceauth
import("context";"crypto/ed25519";"crypto/rand";"testing";"time")
type fixtureApprovalProvider struct{approval PublicationApproval}
func(p fixtureApprovalProvider)Approval(context.Context,PublicationFence,PublicationFence)(PublicationApproval,error){return p.approval,nil}
func TestC038IndependentSignatureAuthorization(t *testing.T){
 pub,priv,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
 now:=time.Date(2026,10,10,21,0,0,0,time.UTC)
 old:=PublicationFence{Scope:"BC/doobr",Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("policy1")),DependencyDigest:Digest([]byte("dep1")),ExpiresAt:now.Add(time.Hour)}
 next:=old;next.Sequence=2;next.PolicyDigest=Digest([]byte("policy2"))
 approval:=PublicationApproval{KeyID:"trusted-external-key",ReviewerID:"legal-reviewer",PublisherID:"publisher",Before:old,After:next,ValidUntil:now.Add(time.Minute)}
 payload,err:=publicationApprovalBytes(approval);if err!=nil{t.Fatal(err)}
 approval.Signature=ed25519.Sign(priv,payload)
 verifier:=SignedIndependentPublicationAuthority{TrustedReviewerKeys:map[string]ed25519.PublicKey{approval.KeyID:pub},Provider:fixtureApprovalProvider{approval},Clock:func()time.Time{return now}}
 if err:=verifier.VerifyPublication(context.Background(),old,next);err!=nil{t.Fatal("signed independent approval rejected",err)}
 bad:=next;bad.PolicyDigest=Digest([]byte("attacker"))
 if err:=verifier.VerifyPublication(context.Background(),old,bad);err==nil{t.Fatal("altered policy approved")}
 copyApproval:=approval;copyApproval.PublisherID=copyApproval.ReviewerID
 verifier.Provider=fixtureApprovalProvider{copyApproval}
 if err:=verifier.VerifyPublication(context.Background(),old,next);err==nil{t.Fatal("same publisher reviewer allowed")}
 verifier.Provider=fixtureApprovalProvider{approval};verifier.Clock=func()time.Time{return now.Add(2*time.Minute)}
 if err:=verifier.VerifyPublication(context.Background(),old,next);err==nil{t.Fatal("expired approval allowed")}
 verifier.Clock=func()time.Time{return now};verifier.TrustedReviewerKeys=nil
 if err:=verifier.VerifyPublication(context.Background(),old,next);err==nil{t.Fatal("untrusted signer allowed")}
}
