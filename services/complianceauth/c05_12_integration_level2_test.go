package complianceauth

import (
 "context"
 "crypto/ed25519"
 "crypto/rand"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

// C05.12 retains an app-scoped integration boundary across the published
// evaluation API, policy invalidation, order stages and Travel presence.
func TestC0512IntegrationLevel2Adversarial(t *testing.T) {
 ctx:=context.Background()
 now:=time.Date(2026,10,12,17,0,0,0,time.UTC)
 policyDigest:=Digest([]byte("phase-policy"))
 facts:=Digest([]byte("order-facts"))
 api:=C051API{Backend:c051Backend{},Auth:c051Auth{}}
 body:=`{"tenant_id":"tenant","operation_ref":"order","stage":"dispatch","action":"review","policy_digest":"`+policyDigest+`","facts_digest":"`+facts+`"}`
 post:=func(token,requestBody string,backend C051Backend)int{
  handler:=C051API{Backend:backend,Auth:api.Auth}
  req:=httptest.NewRequest(http.MethodPost,"/api/v1/evaluate",strings.NewReader(requestBody))
  req.Header.Set("Content-Type","application/json")
  if token!=""{req.Header.Set("Authorization","Bearer "+token)}
  response:=httptest.NewRecorder();handler.ServeHTTP(response,req);return response.Code
 }
 if got:=post("valid",body,c051Backend{});got!=200{t.Fatalf("authenticated assessment: %d",got)}
 if got:=post("",body,c051Backend{});got!=401{t.Fatalf("anonymous policy evaluation: %d",got)}
 if got:=post("valid",strings.Replace(body,"tenant_id\":\"tenant","tenant_id\":\"other",1),c051Backend{});got!=403{t.Fatalf("cross-tenant API: %d",got)}
 if got:=post("valid",body,c051Unavailable{});got!=503{t.Fatalf("policy backend outage: %d",got)}

 pub,secret,err:=ed25519.GenerateKey(rand.Reader);if err!=nil{t.Fatal(err)}
 change,err:=SignComplianceImpact(ComplianceImpactEvent{EventID:"mid-order",Scope:"BC",Sequence:3,RevocationEpoch:2,PolicyDigest:policyDigest,Kind:"POLICY_REVOKED",IssuedAt:now,KeyID:"publisher"},secret)
 if err!=nil{t.Fatal(err)}
 stale:=PublicationFence{Scope:"BC",Sequence:2,RevocationEpoch:1,PolicyDigest:policyDigest}
 if err:=ConsumeComplianceImpact(ctx,change,pub,c059Policy{f:stale});err==nil{t.Fatal("mid-order revocation consumed with stale policy")}
 current:=PublicationFence{Scope:"BC",Sequence:3,RevocationEpoch:2,PolicyDigest:policyDigest}
 if err:=ConsumeComplianceImpact(ctx,change,pub,c059Policy{f:current});err!=nil{t.Fatalf("fresh canonical re-read %v",err)}
 if err:=ConsumeComplianceImpact(ctx,change,pub,c059Policy{err:errors.New("outage")});err==nil{t.Fatal("canonical policy unavailable but permission reused")}

 state:=DOOBrStageState{TenantID:"tenant",OrderID:"order",Revision:1}
 stages:=&MemoryDOOBrStageStore{States:map[string]DOOBrStageState{doobrKey("tenant","order"):state}}
 request:=DOOBrStageRequest{TenantID:"tenant",OrderID:"order",ActorID:"carrier",Stage:DOOBrAccept,Entry:EntryMobileReplay,IdempotencyKey:"offline",FactsDigest:facts,ExpectedRevision:1}
 if _,err:=AdvanceDOOBrStage(ctx,stages,c054Authority{denied:true},request,now);err==nil{t.Fatal("revoked mid-order stage accepted")}
 request.TenantID="other"
 if _,err:=AdvanceDOOBrStage(ctx,stages,c054Authority{},request,now);err==nil{t.Fatal("cross-tenant stale offline replay accepted")}

 publication:=TravelPolicyPublication{Region:"BC",Domain:"TRANSPORT",PolicyVersion:"v1",PolicyDigest:policyDigest,SourceDigest:Digest([]byte("source")),ReviewDigest:Digest([]byte("review")),LastReviewedAt:now.Add(-time.Hour),EffectiveFrom:now.Add(-time.Hour),EffectiveUntil:now.Add(-time.Second),Coverage:"REVIEWED",PublicSummary:"REVIEW_RULES",PublicDeepLink:"https://travel.420integrated.org/travel/policy/bc"}
 supply:=CourierSupplyEvidence{Region:"BC",ProviderID:"private-source",Qualified:true,Available:true,ActiveUntil:now.Add(time.Hour),LastVerifiedAt:now,PrivateCourierCount:10}
 presence:=TravelPresenceAdapter{Guidance:TravelGuidanceAdapter{Source:c056Source{publication:publication},AllowedPublicHost:"travel.420integrated.org"},Supply:c057Supply{v:supply},MinimumPrivateCohort:3,MaxSupplyAge:time.Minute}
 out,err:=presence.Read(ctx,"BC",now)
 if err!=nil||out.Visible||out.PolicyCoverage!="UNKNOWN"||out.LegalEligibility!="UNVERIFIED"{t.Fatalf("stale policy leaked Travel presence: %+v %v",out,err)}
 presence.Supply=c057Supply{v:supply,err:errors.New("provider outage")}
 publication.EffectiveUntil=now.Add(time.Hour)
 presence.Guidance.Source=c056Source{publication:publication}
 if out,err=presence.Read(ctx,"BC",now);err==nil||out.Visible{t.Fatalf("provider outage visible %+v %v",out,err)}
}
