package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "encoding/json"
 "testing"
 "time"
)

// c0311TenantBoundEvidence models an independently authenticated carrier adapter.\n// The generic evaluator delegates tenant/operation validation to this authority.\ntype c0311TenantBoundEvidence struct { delegate CredentialAuthority; tenant string }\nfunc (a c0311TenantBoundEvidence) VerifyEvidence(r EvaluationRequest, at time.Time)(Evidence,error){\n if r.TenantID!=a.tenant{return Evidence{},ErrUnauthorized}\n return a.delegate.VerifyEvidence(r,at)\n}\n\n// C03.11: replay a historical reviewed decision with its original authority
// snapshot, then show a current publication/revocation cannot inherit that
// historical permission. These are fixtures, not production legal approvals.
func TestC0311EngineLevel2ReplayAndCarrierBoundary(t *testing.T) {
 ctx:=context.Background()
 historical:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 current:=historical.Add(30*time.Minute)
 pub,priv,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
 rules:=[]Requirement{{ID:"age",Fact:"age",Mandatory:true}}
 raw,err:=json.Marshal(rules);if err!=nil{t.Fatal(err)}
 evidence:=Evidence{SourceVerified:true,CredentialsVerified:true,GeographyVerified:true,CurrentRevocation:true,PartnerVerified:true,RequiredFacts:map[string]bool{"age":true}}
 eb,err:=json.Marshal(evidence);if err!=nil{t.Fatal(err)}
 manifest:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest(raw),ReviewDigest:Digest([]byte("review")),Domain:"delivery",Jurisdiction:"BC",Audience:"doobr",Environment:"test",KeyID:"key",Sequence:7,RevocationEpoch:3,EffectiveFrom:historical.Add(-time.Hour),EffectiveUntil:current.Add(time.Hour),ReviewExpiresAt:current.Add(time.Hour)}
 signed,err:=Publish(manifest,Approval{Digest:manifest.PolicyDigest,AuthorID:"author",ReviewerID:"reviewer",PublisherID:"publisher",IndependentlyVerified:true},priv);if err!=nil{t.Fatal(err)}
 policy:=ReviewedPolicy{Manifest:signed,ReviewID:"review-1",ApprovalToken:"approved",Rules:rules}
 service:=EvaluationService{Trust:Trust{Keys:map[string]Key{"key":{Public:pub,Environment:"test"}},MinimumSequence:7,MinimumEpoch:3,Environment:"test",Audience:"doobr",Domain:"delivery",Jurisdiction:"BC"},Approvals:stubApproval{true},Credentials:stubEvidence{true,evidence}}
 service.Credentials=c0311TenantBoundEvidence{delegate:service.Credentials,tenant:"tenant"}\n request:=EvaluationRequest{TenantID:"tenant",OperationRef:"operation",Stage:"prepare",Action:"prepare",Audience:"doobr",Domain:"delivery",Jurisdiction:"BC",FactsDigest:Digest(eb)}

 graph:=AuthorityGraph{Version:"historical-geography-v1",AsOf:historical,Nodes:[]AuthorityNode{{ID:"federal",Kind:"FEDERAL",LegalJurisdictionID:"CA",SourceDigest:Digest([]byte("ca")),EffectiveFrom:historical.Add(-time.Hour)},{ID:"province",Kind:"PROVINCE",ParentID:"federal",LegalJurisdictionID:"BC",SourceDigest:Digest([]byte("bc")),EffectiveFrom:historical.Add(-time.Hour)}}}
 location:=AuthorityLocation{OperatingZoneID:"test-service-zone",CandidateJurisdictions:[]string{"BC"},Confidence:BoundaryVerified,BoundaryEvidenceDigest:Digest([]byte("boundary"))}
 resolved,err:=ResolveAuthority(graph,location)
 if err!=nil||resolved.State!="RESOLVED"||resolved.PolicyAuthorized||len(resolved.Jurisdictions)!=2{t.Fatalf("authority replay: %+v %v",resolved,err)}
 version:=TemporalVersion{EvidenceID:"historical-evidence",SourceDigest:Digest([]byte("source")),RecordedAt:historical.Add(-2*time.Hour),EffectiveFrom:historical.Add(-time.Hour)}
 temporal:=TemporalRequest{At:historical,KnowledgeAt:historical,Timezone:"UTC",StartLocal:"00:00",EndLocal:"23:59",Versions:[]TemporalVersion{version}}
 applicable,err:=EvaluateTemporalApplicability(temporal)
 if err!=nil||applicable.State!="TEMPORALLY_APPLICABLE_REVIEW_REQUIRED"||applicable.PolicyAuthorized{t.Fatalf("temporal replay: %+v %v",applicable,err)}

 scope:="BC/doobr/delivery"
 fence:=PublicationFence{Scope:scope,Sequence:7,RevocationEpoch:3,PolicyDigest:manifest.PolicyDigest,DependencyDigest:Digest([]byte("dependencies-v1")),ExpiresAt:current.Add(time.Hour)}
 store:=&MemoryPublicationStore{entries:map[string]PublicationFence{scope:fence}}
 cache:=&PublicationCache{}
 if _,err:=cache.ReadCurrent(ctx,store,fence,historical);err!=nil{t.Fatal(err)}
 old:=service.Evaluate(policy,request,historical)
 replay:=service.Evaluate(policy,request,historical)
 if old.Outcome!="ALLOW"||(old.Outcome!=replay.Outcome||old.PolicyDigest!=replay.PolicyDigest||old.RequestDigest!=replay.RequestDigest||!old.ExpiresAt.Equal(replay.ExpiresAt)){t.Fatalf("historical decision not reproducible: %+v %+v",old,replay)}
 if old.RequestDigest==""||old.PolicyDigest!=fence.PolicyDigest{t.Fatal("historical commitments unbound")}

 ledger:=&ReceiptLedger{}
 receipt,err:=ledger.Issue(service,policy,request,historical,time.Minute,"historical-nonce");if err!=nil{t.Fatal(err)}
 next:=request;next.Stage="dispatch";next.Action="dispatch"
 if err:=ledger.ConsumeAndReevaluate(service,policy,receipt,request,next,historical.Add(time.Second));err!=nil{t.Fatalf("fresh transition rejected: %v",err)}
 if err:=ledger.ConsumeAndReevaluate(service,policy,receipt,request,next,historical.Add(2*time.Second));err==nil{t.Fatal("carrier replay allowed")}

 upgraded:=fence;upgraded.Sequence=8;upgraded.RevocationEpoch=4;upgraded.DependencyDigest=Digest([]byte("dependencies-v2"))
 if err:=AdvancePublication(ctx,store,fence,upgraded,current);err!=nil{t.Fatal(err)}
 if _,err:=cache.ReadCurrent(ctx,store,fence,current);err==nil{t.Fatal("stale carrier publication accepted")}
 if _,err:=cache.ReadCurrent(ctx,store,upgraded,current);err!=nil{t.Fatal(err)}
 revised:=service;revised.Trust.MinimumSequence=8;revised.Trust.MinimumEpoch=4
 denied:=revised.Evaluate(policy,request,current)
 if denied.Outcome=="ALLOW"{t.Fatal("superseded reviewed policy allowed at current epoch")}
 manifestCurrent:=manifest
 manifestCurrent.Sequence=8;manifestCurrent.RevocationEpoch=4
 signedCurrent,err:=Publish(manifestCurrent,Approval{Digest:manifestCurrent.PolicyDigest,AuthorID:"author",ReviewerID:"reviewer",PublisherID:"publisher",IndependentlyVerified:true},priv);if err!=nil{t.Fatal(err)}
 currentPolicy:=policy;currentPolicy.Manifest=signedCurrent
 currentDecision:=revised.Evaluate(currentPolicy,request,current)
 currentReplay:=revised.Evaluate(currentPolicy,request,current)
 if currentDecision.Outcome!="ALLOW"||currentReplay.Outcome!=currentDecision.Outcome||currentReplay.PolicyDigest!=currentDecision.PolicyDigest||currentReplay.RequestDigest!=currentDecision.RequestDigest||!currentReplay.ExpiresAt.Equal(currentDecision.ExpiresAt){t.Fatalf("current decision not reproducible: %+v %+v",currentDecision,currentReplay)}
 if again:=service.Evaluate(policy,request,historical);again.Outcome!=old.Outcome||again.RequestDigest!=old.RequestDigest{t.Fatal("historical snapshot mutated")}

 impact,err:=SimulatePolicyImpact([]SimulationFlow{{FlowID:"carrier-flow",OperationRef:request.OperationRef,Stage:request.Stage,InFlight:true,Before:old.Outcome,After:denied.Outcome,BeforePolicyDigest:fence.PolicyDigest,AfterPolicyDigest:upgraded.PolicyDigest}})
 if err!=nil||impact.PolicyAuthorized||len(impact.Items)!=1||!impact.Items[0].RequiresReevaluation{t.Fatalf("unsafe impact report: %+v %v",impact,err)}
 for _,bad:=range []EvaluationRequest{
  func() EvaluationRequest {x:=request;x.Audience="travel";return x}(),
  func() EvaluationRequest {x:=request;x.TenantID="other";return x}(),
  func() EvaluationRequest {x:=request;x.FactsDigest=Digest([]byte("forged"));return x}(),
 }{
  if d:=service.Evaluate(policy,bad,historical);d.Outcome=="ALLOW"{t.Fatalf("carrier context substitution authorized: %+v",bad)}
 }
 unknown:=location;unknown.Confidence=BoundaryUnknown
 if got,err:=ResolveAuthority(graph,unknown);err==nil||got.State=="RESOLVED"{t.Fatal("unknown boundary authorized")}
 if _,err:=cache.ReadCurrent(ctx,nil,upgraded,current);err==nil{t.Fatal("publication outage authorized")}
}
