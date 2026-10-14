package complianceauth
import("crypto/ed25519";"crypto/rand";"encoding/json";"sync";"testing";"time")
func TestC037BoundDecisionReceiptReplayAndStages(t *testing.T){
 pub,priv,_:=ed25519.GenerateKey(rand.Reader);now:=time.Date(2026,10,10,21,0,0,0,time.UTC)
 evidence:=Evidence{SourceVerified:true,CredentialsVerified:true,GeographyVerified:true,CurrentRevocation:true,PartnerVerified:true,RequiredFacts:map[string]bool{"age":true}}
 rules:=[]Requirement{{ID:"age",Fact:"age",Mandatory:true}};raw,_:=json.Marshal(rules);facts,_:=json.Marshal(evidence)
 m:=Manifest{Schema:"420compliance-policy/v1",PolicyDigest:Digest(raw),ReviewDigest:Digest([]byte("review")),Domain:"delivery",Jurisdiction:"BC",Audience:"doobr",Environment:"test",KeyID:"key",Sequence:1,RevocationEpoch:1,EffectiveFrom:now.Add(-time.Minute),EffectiveUntil:now.Add(time.Hour),ReviewExpiresAt:now.Add(time.Hour)}
 signed,err:=Publish(m,Approval{Digest:m.PolicyDigest,AuthorID:"a",ReviewerID:"b",PublisherID:"c",IndependentlyVerified:true},priv);if err!=nil{t.Fatal(err)}
 policy:=ReviewedPolicy{Manifest:signed,ReviewID:"review",ApprovalToken:"approved",Rules:rules}
 service:=EvaluationService{Trust:Trust{Keys:map[string]Key{"key":{Public:pub,Environment:"test"}},MinimumSequence:1,MinimumEpoch:1,Environment:"test",Audience:"doobr",Domain:"delivery",Jurisdiction:"BC"},Approvals:stubApproval{true},Credentials:stubEvidence{true,evidence}}
 req:=EvaluationRequest{TenantID:"t",OperationRef:"order",Action:"prepare",Stage:"prepare",Audience:"doobr",Domain:"delivery",Jurisdiction:"BC",FactsDigest:Digest(facts)}
 ledger:=&ReceiptLedger{};receipt,err:=ledger.Issue(service,policy,req,now,time.Minute,"nonce-1");if err!=nil{t.Fatal(err)}
 if receipt.RequestDigest==""||receipt.PolicyDigest!=m.PolicyDigest||!receipt.ExpiresAt.Equal(now.Add(time.Minute)){t.Fatal("incomplete receipt",receipt)}
 if _,err:=ledger.Issue(service,policy,req,now,time.Minute,"nonce-1");err==nil{t.Fatal("duplicate nonce issued")}
 next:=req;next.Stage="dispatch";next.Action="dispatch"
 altered:=req;altered.FactsDigest=Digest([]byte("tampered"))
 if ledger.ConsumeAndReevaluate(service,policy,receipt,altered,next,now.Add(time.Second))==nil{t.Fatal("changed input allowed")}
 if ledger.ConsumeAndReevaluate(service,policy,receipt,req,req,now.Add(time.Second))==nil{t.Fatal("same-stage reuse allowed")}
 if ledger.ConsumeAndReevaluate(service,policy,receipt,req,next,now.Add(time.Second))!=nil{t.Fatal("valid fresh stage rejected")}
 if ledger.ConsumeAndReevaluate(service,policy,receipt,req,next,now.Add(time.Second))==nil{t.Fatal("replayed receipt allowed")}
 second,_:=ledger.Issue(service,policy,req,now,time.Minute,"nonce-2")
 changed:=next;changed.OperationRef="other"
 if ledger.ConsumeAndReevaluate(service,policy,second,req,changed,now.Add(time.Second))==nil{t.Fatal("cross-operation allowed")}
 if ledger.ConsumeAndReevaluate(service,policy,second,req,next,now.Add(time.Minute))==nil{t.Fatal("expiry boundary allowed")}
 third,_:=ledger.Issue(service,policy,req,now,time.Minute,"nonce-3")
 unavailable:=service;unavailable.Credentials=stubEvidence{valid:false}
 if ledger.ConsumeAndReevaluate(unavailable,policy,third,req,next,now.Add(time.Second))==nil{t.Fatal("offline reevaluation allowed")}
 if ledger.ConsumeAndReevaluate(service,policy,third,req,next,now.Add(time.Second))==nil{t.Fatal("failed recheck receipt replayed")}
 fourth,_:=ledger.Issue(service,policy,req,now,time.Minute,"nonce-4")
 var wg sync.WaitGroup;var successes int;var mu sync.Mutex
 for i:=0;i<32;i++{wg.Add(1);go func(){defer wg.Done();if ledger.ConsumeAndReevaluate(service,policy,fourth,req,next,now.Add(time.Second))==nil{mu.Lock();successes++;mu.Unlock()}}()}
 wg.Wait();if successes!=1{t.Fatalf("concurrent replay successes %d",successes)}
}
