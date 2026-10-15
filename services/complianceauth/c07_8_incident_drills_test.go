package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "testing"
 "time"
)

// C07.8 exercises security boundaries, not simulated incident labels.
// Incident recovery never authorizes publication, review, or a transaction.
func TestC078IncidentDrills(t *testing.T) {
 ctx:=context.Background()
 now:=time.Date(2026,10,13,20,0,0,0,time.UTC)
 t.Run("false approval and rollback",func(t *testing.T){
  old:=PublicationFence{Scope:"BC/doobr/delivery",Sequence:7,RevocationEpoch:3,PolicyDigest:Digest([]byte("previous")),DependencyDigest:Digest([]byte("dependencies")),ExpiresAt:now.Add(time.Hour)}
  newer:=old;newer.Sequence=8;newer.RevocationEpoch=4;newer.PolicyDigest=Digest([]byte("corrected"))
  store:=&MemoryPublicationStore{entries:map[string]PublicationFence{old.Scope:old}}
  if err:=AdvancePublication(ctx,store,old,newer,now);err!=nil{t.Fatal(err)}
  cache:=&PublicationCache{}
  if _,err:=cache.ReadCurrent(ctx,store,old,now);err==nil{t.Fatal("incident: revoked prior publication still served")}
  if err:=AdvancePublication(ctx,store,newer,old,now);err==nil{t.Fatal("incident: rollback reactivated false approval")}
  if _,err:=cache.ReadCurrent(ctx,store,newer,now);err!=nil{t.Fatal("corrected version unavailable",err)}
 })
 t.Run("malicious and stale source",func(t *testing.T){
  valid:=SourceHealthInput{SourceID:"FED-ACT",CollectedAt:now,LastSuccessfulAt:now,ReviewExpiresAt:now.Add(time.Hour),ReviewedPolicyDigest:Digest([]byte("approved")),MaxSourceAge:time.Hour}
  for name,mutate:=range map[string]func(*SourceHealthInput){
   "unreadable tampering":func(s *SourceHealthInput){s.UnreadableUpdate=true},
   "failed retrieval":func(s *SourceHealthInput){s.CollectionFailed=true},
   "missing authority":func(s *SourceHealthInput){s.SourceMissing=true},
   "stale evidence":func(s *SourceHealthInput){s.LastSuccessfulAt=now.Add(-2*time.Hour)},
   "expired independent review":func(s *SourceHealthInput){s.ReviewExpiresAt=now},
   "mismatched review digest":func(s *SourceHealthInput){s.ReviewedPolicyDigest="invalid"},
  }{
   t.Run(name,func(t *testing.T){s:=valid;mutate(&s);out,err:=AssessSourceHealth(s,now);if err!=nil||out.MayAuthorize||out.ReviewRenewed||out.Escalation!="BLOCK_TRANSACTION_AND_ESCALATE_TO_SOURCE_OWNER_AND_INDEPENDENT_REVIEWER"{t.Fatalf("source incident escaped containment: %+v %v",out,err)}})
  }
 })
 t.Run("compromised reviewer and publication key",func(t *testing.T){
  digest:=Digest([]byte("reviewed"))
  request:=ReviewAuthorizationRequest{ReviewerID:"reviewer",AuthorID:"author",ApproverID:"approver",PublisherID:"publisher",SessionID:"session",Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,Role:"reviewer",Now:now}
  authority:=c042Authority{grant:ReviewerGrant{SubjectID:"reviewer",DelegatedBy:"delegator",Role:"reviewer",Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),QualificationExpiresAt:now.Add(time.Hour)},session:ReviewerSession{SubjectID:"reviewer",SessionID:"session",Audience:"420compliance-review",IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),AuthenticatedAt:now.Add(-time.Minute),MFAAuthenticatedAt:now.Add(-time.Minute)}}
  if _,err:=AuthorizeReview(ctx,authority,request);err!=nil{t.Fatal("baseline independent review unavailable",err)}
  compromised:=authority;compromised.grant.Revoked=true
  if _,err:=AuthorizeReview(ctx,compromised,request);err==nil{t.Fatal("revoked reviewer could approve")}
  compromised=authority;compromised.session.Revoked=true
  if _,err:=AuthorizeReview(ctx,compromised,request);err==nil{t.Fatal("revoked reviewer session could approve")}
  pub,priv,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
  old:=PublicationFence{Scope:"BC/doobr",Sequence:1,RevocationEpoch:1,PolicyDigest:Digest([]byte("old")),DependencyDigest:Digest([]byte("deps")),ExpiresAt:now.Add(time.Hour)}
  next:=old;next.Sequence=2;next.PolicyDigest=Digest([]byte("new"))
  approval:=PublicationApproval{KeyID:"external-key",ReviewerID:"reviewer",PublisherID:"publisher",Before:old,After:next,ValidUntil:now.Add(time.Minute)}
  bytes,err:=publicationApprovalBytes(approval);if err!=nil{t.Fatal(err)};approval.Signature=ed25519.Sign(priv,bytes)
  verifier:=SignedIndependentPublicationAuthority{TrustedReviewerKeys:map[string]ed25519.PublicKey{approval.KeyID:pub},Provider:fixtureApprovalProvider{approval},Clock:func()time.Time{return now}}
  if err:=verifier.VerifyPublication(ctx,old,next);err!=nil{t.Fatal(err)}
  verifier.TrustedReviewerKeys=nil
  if err:=verifier.VerifyPublication(ctx,old,next);err==nil{t.Fatal("withdrawn signer still authorizes")}
 })
 t.Run("bad geography",func(t *testing.T){
  e:=LocationApplicabilityEvidence{TenantID:"tenant",OperationRef:"order",Jurisdiction:"BC",CoarseRegion:"BC",PrivateAddressRef:"private",PlaceID:"verified",AddressValidated:true,PlaceAssociationAuthorized:true,JurisdictionReviewed:true,SourceExpiresAt:now.Add(time.Hour)}
  e.JurisdictionReviewed=false
  got,err:=(LocationApplicabilityAdapter{Resolver:c053Resolver{evidence:e}}).Evaluate(ctx,"tenant","order",true,now)
  if err==nil||got.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("unreviewed geography accepted: %+v %v",got,err)}
  e.JurisdictionReviewed=true;e.TenantID="attacker"
  got,err=(LocationApplicabilityAdapter{Resolver:c053Resolver{evidence:e}}).Evaluate(ctx,"tenant","order",true,now)
  if err==nil||got.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("cross-tenant geography accepted: %+v %v",got,err)}
 })
 t.Run("expired credential",func(t *testing.T){
  digest:=Digest([]byte("reviewed"))
  request:=ReviewAuthorizationRequest{ReviewerID:"reviewer",AuthorID:"author",ApproverID:"approver",PublisherID:"publisher",SessionID:"session",Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,Role:"reviewer",Now:now}
  authority:=c042Authority{grant:ReviewerGrant{SubjectID:"reviewer",DelegatedBy:"delegator",Role:"reviewer",Domain:"delivery",Jurisdiction:"BC",PolicyDigest:digest,IssuedAt:now.Add(-time.Minute),ExpiresAt:now,QualificationExpiresAt:now.Add(time.Hour)},session:ReviewerSession{SubjectID:"reviewer",SessionID:"session",Audience:"420compliance-review",IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute),AuthenticatedAt:now.Add(-time.Minute),MFAAuthenticatedAt:now.Add(-time.Minute)}}
  if _,err:=AuthorizeReview(ctx,authority,request);err==nil{t.Fatal("expired reviewer credential authorized")}
  authority.grant.ExpiresAt=now.Add(time.Minute);authority.session.ExpiresAt=now
  if _,err:=AuthorizeReview(ctx,authority,request);err==nil{t.Fatal("expired session authorized")}
 })
 t.Run("regulator restriction",func(t *testing.T){
  old:=PublicationFence{Scope:"BC/doobr/delivery",Sequence:10,RevocationEpoch:5,PolicyDigest:Digest([]byte("permitted")),DependencyDigest:Digest([]byte("authority")),ExpiresAt:now.Add(time.Hour)}
  restricted:=old;restricted.Sequence++;restricted.RevocationEpoch++;restricted.PolicyDigest=Digest([]byte("restricted"))
  store:=&MemoryPublicationStore{entries:map[string]PublicationFence{old.Scope:old}}
  if err:=AdvancePublication(ctx,store,old,restricted,now);err!=nil{t.Fatal("restriction publication failed",err)}
  if _,err:=(&PublicationCache{}).ReadCurrent(ctx,store,old,now);err==nil{t.Fatal("old permission served after regulator restriction")}
  replay:=old;replay.Sequence=restricted.Sequence+1
  if err:=AdvancePublication(ctx,store,restricted,replay,now);err==nil{t.Fatal("regulatory epoch rolled back")}
  if _,err:=(&PublicationCache{}).ReadCurrent(ctx,nil,restricted,now);err==nil{t.Fatal("authority outage permitted serving")}
 })
}
