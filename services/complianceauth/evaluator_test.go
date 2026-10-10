package complianceauth
import("testing";"time";"crypto/ed25519";"crypto/rand")
func TestEvaluatorFailsClosed(t *testing.T){
 pub,priv,_:=ed25519.GenerateKey(rand.Reader)
 now:=time.Date(2026,10,10,12,0,0,0,time.UTC)
 m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest([]byte("approved-rule")),ReviewDigest:Digest([]byte("signed-review")),Domain:"delivery",Jurisdiction:"BC",Audience:"doobr",Environment:"test",KeyID:"key-a",Sequence:1,RevocationEpoch:1,EffectiveFrom:now.Add(-time.Minute),EffectiveUntil:now.Add(time.Hour),ReviewExpiresAt:now.Add(time.Hour)}
 signed,err:=Publish(m,Approval{Digest:m.PolicyDigest,AuthorID:"a",ReviewerID:"b",PublisherID:"c",IndependentlyVerified:true},priv);if err!=nil{t.Fatal(err)}
 trust:=Trust{Keys:map[string]Key{"key-a":{Public:pub,Environment:"test"}},MinimumSequence:1,MinimumEpoch:1,Environment:"test",Audience:"doobr",Domain:"delivery",Jurisdiction:"BC"}
 policy:=ReviewedPolicy{Manifest:signed,ReviewID:"review",Approved:true,Rules:[]Requirement{{ID:"R1",Fact:"valid_age",Mandatory:true}}}
 request:=EvaluationRequest{TenantID:"tenant",OperationRef:"order",Action:"dispatch",Stage:"dispatch",Domain:"delivery",Jurisdiction:"BC",Audience:"doobr",FactsDigest:Digest([]byte("verified")),Evidence:Evidence{SourceVerified:true,CredentialsVerified:true,GeographyVerified:true,CurrentRevocation:true,PartnerVerified:true,RequiredFacts:map[string]bool{"valid_age":true}}}
 if got:=trust.Evaluate(policy,request,now);got.Outcome!="ALLOW"||got.RequestDigest==""||got.PolicyDigest!=m.PolicyDigest{t.Fatalf("expected scoped positive policy result: %+v",got)}
 cases:=[]struct{name string;mutate func(*ReviewedPolicy,*EvaluationRequest)}{
 {"no approval",func(p *ReviewedPolicy,_ *EvaluationRequest){p.Approved=false}},
 {"no review",func(p *ReviewedPolicy,_ *EvaluationRequest){p.ReviewID=""}},
 {"no rules",func(p *ReviewedPolicy,_ *EvaluationRequest){p.Rules=nil}},
 {"missing tenant",func(_ *ReviewedPolicy,r *EvaluationRequest){r.TenantID=""}},
 {"wrong audience",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Audience="travel"}},
 {"missing credential",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.CredentialsVerified=false}},
 {"missing partner",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.PartnerVerified=false}},
 {"missing jurisdiction proof",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.GeographyVerified=false}},
 {"missing revocation",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.CurrentRevocation=false}},
 {"missing source",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.SourceVerified=false}},
 {"bad facts digest",func(_ *ReviewedPolicy,r *EvaluationRequest){r.FactsDigest="fake"}},
 {"wrong action context",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Stage=""}},
 {"tampered policy",func(p *ReviewedPolicy,_ *EvaluationRequest){p.Manifest.Manifest.PolicyDigest=Digest([]byte("other"))}},
 {"required fact false",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.RequiredFacts=map[string]bool{"valid_age":false}}},
 {"required fact absent",func(_ *ReviewedPolicy,r *EvaluationRequest){r.Evidence.RequiredFacts=nil}},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){p:=policy;r:=request;tc.mutate(&p,&r);if got:=trust.Evaluate(p,r,now);got.Outcome=="ALLOW"{t.Fatalf("unsafe ALLOW: %+v",got)}})}
 if got:=trust.Evaluate(policy,request,now.Add(2*time.Hour));got.Outcome=="ALLOW"{t.Fatal("expired permit accepted")}
}
