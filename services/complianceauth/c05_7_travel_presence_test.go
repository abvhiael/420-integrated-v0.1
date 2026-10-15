package complianceauth

import (
 "context"
 "encoding/json"
 "errors"
 "strings"
 "testing"
 "time"
)
type c057Supply struct{v CourierSupplyEvidence;err error}
func(s c057Supply)CurrentSupply(context.Context,string)(CourierSupplyEvidence,error){return s.v,s.err}
func TestC057TravelPresencePrivacyExpiryAndSeparation(t *testing.T){
 now:=time.Date(2026,10,11,22,0,0,0,time.UTC)
 policy:=TravelPolicyPublication{Region:"BC",Domain:"TRANSPORT",PolicyVersion:"v4",PolicyDigest:Digest([]byte("policy")),SourceDigest:Digest([]byte("source")),ReviewDigest:Digest([]byte("review")),LastReviewedAt:now.Add(-time.Hour),EffectiveFrom:now.Add(-2*time.Hour),EffectiveUntil:now.Add(time.Hour),Coverage:"REVIEWED",PublicSummary:"REVIEW_RULES",PublicDeepLink:"https://travel.420integrated.org/travel/policy/bc-transport"}
 supply:=CourierSupplyEvidence{Region:"BC",ProviderID:"private-provider",Qualified:true,Available:true,ActiveUntil:now.Add(10*time.Minute),LastVerifiedAt:now.Add(-time.Minute),PrivateCourierCount:5}
 run:=func(p TravelPolicyPublication,s CourierSupplyEvidence,e error)(TravelPresence,error){
  a:=TravelPresenceAdapter{Guidance:TravelGuidanceAdapter{Source:c056Source{publication:p},AllowedPublicHost:"travel.420integrated.org"},Supply:c057Supply{v:s,err:e},MinimumPrivateCohort:3,MaxSupplyAge:5*time.Minute}
  return a.Read(context.Background(),"BC",now)
 }
 result,err:=run(policy,supply,nil)
 if err!=nil||!result.Visible||result.PolicyCoverage!="REVIEWED"||result.LegalEligibility!="UNVERIFIED"||result.CourierSupply!="AVAILABLE"{t.Fatalf("positive candidate %+v %v",result,err)}
 raw,_:=json.Marshal(result)
 for _,private:=range []string{"private-provider","courier_count","privatecouriercount","checkout","recipient","vehicle","customer","private_address"}{if strings.Contains(strings.ToLower(string(raw)),private){t.Fatalf("leaked %s",raw)}}
 cases:=[]struct{name string;change func(*TravelPolicyPublication,*CourierSupplyEvidence)}{
  {"partial legal policy",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){p.Coverage="PARTIAL"}},
  {"expired policy",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){p.EffectiveUntil=now}},
  {"provider unqualified",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.Qualified=false}},
  {"provider revoked",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.Revoked=true}},
  {"supply empty",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.Available=false}},
  {"supply expired",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.ActiveUntil=now}},
  {"stale source",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.LastVerifiedAt=now.Add(-time.Hour)}},
  {"future timestamp",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.LastVerifiedAt=now.Add(time.Hour)}},
  {"cross region",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.Region="AB"}},
  {"privacy threshold",func(p *TravelPolicyPublication,s *CourierSupplyEvidence){s.PrivateCourierCount=2}},
 }
 for _,tc:=range cases {p,s:=policy,supply;tc.change(&p,&s);got,e:=run(p,s,nil);if got.Visible||got.CourierSupply=="AVAILABLE"{t.Fatalf("%s leaked presence %+v %v",tc.name,got,e)}}
 if got,e:=run(policy,supply,errors.New("outage"));e==nil||got.Visible{t.Fatalf("outage fail-open %+v %v",got,e)}
}
