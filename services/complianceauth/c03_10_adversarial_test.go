package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "encoding/json"
 "math"
 "strings"
 "testing"
 "time"
)

// C03.10 is the cross-layer adversarial qualification of previously introduced
// policy controls. Every malformed input must be denied or require review.
func TestC0310AdversarialCrossLayer(t *testing.T) {
 now:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 t.Run("unknown border and jurisdiction ambiguity",func(t *testing.T){
  graph:=AuthorityGraph{Version:"graph1",AsOf:now,Nodes:[]AuthorityNode{{ID:"federal",Kind:"FEDERAL",LegalJurisdictionID:"CA",SourceDigest:Digest([]byte("fed")),EffectiveFrom:now.Add(-time.Hour)}}}
  for _,confidence:=range []string{BoundaryUnknown,BoundaryBorder,BoundaryAmbiguous}{
   location:=AuthorityLocation{OperatingZoneID:"delivery-zone",CandidateJurisdictions:[]string{"CA"},Confidence:confidence,BoundaryEvidenceDigest:Digest([]byte("boundary"))}
   result,err:=ResolveAuthority(graph,location)
   if err==nil||result.PolicyAuthorized||result.State=="RESOLVED"{t.Fatalf("uncertain border allowed %+v %v",result,err)}
  }
 })
 t.Run("contradictory rules cannot allow",func(t *testing.T){
  rule:=func(outcome string)ComposedRequirement{return ComposedRequirement{Scope:"delivery",Jurisdiction:"CA",RuleID:"rule",PolicyDigest:Digest([]byte("policy")),ReviewDigest:Digest([]byte("review")),ReviewState:"INDEPENDENTLY_REVIEWED",Outcome:outcome}}
  result,err:=ComposeReviewedPolicy(CompositionRequest{RequiredScopes:[]string{"delivery"},ApplicableJurisdictions:[]string{"CA"},Requirements:[]ComposedRequirement{rule("ALLOW_CANDIDATE"),rule("DENY")}})
  if err!=nil||result.Outcome!="DENY"||result.PolicyAuthorized{t.Fatalf("conflicting authorities allowed %+v %v",result,err)}
 })
 t.Run("quantity overflow and strict units",func(t *testing.T){
  for _,bad:=range []string{strings.Repeat("9",39),"-1","1.1","1e9", "+1"}{
   p:=CompiledPolicy{Version:"420compliance-bounded/v1",Limits:[]PolicyLimit{{RuleID:"limit",Fact:"quantity",Unit:"mg",MaximumDecimal:bad,Obligation:"record"}}}
   if _,err:=CompileBoundedPolicy(p);err==nil{t.Fatalf("numeric overflow/noninteger accepted %q",bad)}
  }
  p:=CompiledPolicy{Version:"420compliance-bounded/v1",Limits:[]PolicyLimit{{RuleID:"limit",Fact:"quantity",Unit:"mg",MaximumDecimal:"9223372036854775807",Obligation:"record"}}}
  for _,q:=range []PolicyQuantity{{Unit:"mg",Decimal:"9223372036854775808"},{Unit:"g",Decimal:"1"},{Unit:"mg",Decimal:"184467440737095516160000000000000000000"}}{
   decision:=EvaluateBoundedPolicy(p,PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":q}})
   if decision.PolicyAuthorized||decision.Outcome=="CANDIDATE_AUTHORIZATION_REQUIRED"{t.Fatalf("unsafe numeric decision %+v",decision)}
  }
  _=math.MaxInt64
 })
 t.Run("schema downgrade and incompatible version",func(t *testing.T){
  p:=CompiledPolicy{Version:"420compliance-bounded/v0",Limits:[]PolicyLimit{{RuleID:"r",Fact:"f",Unit:"mg",MaximumDecimal:"1",Obligation:"record"}}}
  if _,err:=CompileBoundedPolicy(p);err==nil{t.Fatal("version downgrade compiled")}
  result:=EvaluateBoundedPolicy(p,PolicyEvalInput{Facts:map[string]PolicyQuantity{"f":{Unit:"mg",Decimal:"1"}}})
  if result.PolicyAuthorized||result.Outcome!="REVIEW_REQUIRED"{t.Fatalf("incompatible schema authorized %+v",result)}
 })
 t.Run("credential clock skew stale and revoked",func(t *testing.T){
  ref:=CredentialReference{Scheme:"420compliance-credential/v1",IssuerID:"trusted",SubjectID:"actor",CredentialID:"reference",Kind:"license",JurisdictionID:"CA",EvidenceDigest:Digest([]byte("evidence"))}
  base:=CredentialVerification{Reference:ref,State:"VERIFIED",VerifiedAt:now.Add(-time.Minute),ValidFrom:now.Add(-time.Hour),ValidUntil:now.Add(time.Hour),TrustedIssuer:true,EvidenceDigest:ref.EvidenceDigest}
  for _,variation:=range []struct{name string;change func(*CredentialVerification);state string}{
   {"future evidence",func(x *CredentialVerification){x.VerifiedAt=now.Add(time.Second)},"REVIEW_REQUIRED"},
   {"stale evidence",func(x *CredentialVerification){x.VerifiedAt=now.Add(-10*time.Minute)},"REVIEW_REQUIRED"},
   {"expired credential",func(x *CredentialVerification){x.ValidUntil=now},"DENIED"},
   {"revoked",func(x *CredentialVerification){x.State="REVOKED"},"DENIED"},
  }{
   t.Run(variation.name,func(t *testing.T){v:=base;variation.change(&v);out:=AssessCredential(context.Background(),&fixtureCredentialVerifier{result:v},ref,now,5*time.Minute);if out.State!=variation.state||out.PolicyAuthorized{t.Fatalf("%+v",out)}})
  }
 })
 t.Run("policy signature expiry skew and downgrade",func(t *testing.T){
  pub,priv,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
  rules:=[]Requirement{{ID:"r",Fact:"age",Mandatory:true}}
  raw,_:=json.Marshal(rules)
  m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest(raw),ReviewDigest:Digest([]byte("review")),Domain:"delivery",Jurisdiction:"CA",Audience:"doobr",Environment:"test",KeyID:"key",Sequence:5,RevocationEpoch:3,EffectiveFrom:now.Add(-time.Minute),EffectiveUntil:now.Add(time.Minute),ReviewExpiresAt:now.Add(time.Minute)}
  signed,err:=Publish(m,Approval{Digest:m.PolicyDigest,AuthorID:"a",ReviewerID:"b",PublisherID:"c",IndependentlyVerified:true},priv);if err!=nil{t.Fatal(err)}
  trust:=Trust{Keys:map[string]Key{"key":{Public:pub,Environment:"test"}},MinimumSequence:5,MinimumEpoch:3,Environment:"test",Audience:"doobr",Domain:"delivery",Jurisdiction:"CA"}
  if err:=trust.Verify(signed,now);err!=nil{t.Fatal(err)}
  for _,badTime:=range []time.Time{now.Add(-2*time.Minute),now.Add(time.Minute),now.Add(time.Hour)}{if trust.Verify(signed,badTime)==nil{t.Fatalf("expired or not yet valid policy accepted at %v",badTime)}}
  stricter:=trust;stricter.MinimumSequence=6
  if stricter.Verify(signed,now)==nil{t.Fatal("publication downgrade accepted")}
  stricter=trust;stricter.MinimumEpoch=4
  if stricter.Verify(signed,now)==nil{t.Fatal("revocation downgrade accepted")}
  tampered:=signed;tampered.Manifest.Schema="420compliance-policy/v0"
  if trust.Verify(tampered,now)==nil{t.Fatal("incompatible manifest accepted")}
 })
}
