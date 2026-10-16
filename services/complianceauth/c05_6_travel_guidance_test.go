package complianceauth

import (
 "context"
 "encoding/json"
 "errors"
 "strings"
 "testing"
 "time"
)
type c056Source struct{ publication TravelPolicyPublication; err error }
func(s c056Source)CurrentTravelPolicy(context.Context,string,string)(TravelPolicyPublication,error){return s.publication,s.err}
func TestC056TravelSourcedPublicGuidance(t *testing.T){
 now:=time.Date(2026,10,11,20,0,0,0,time.UTC)
 p:=TravelPolicyPublication{Region:"BC",Domain:"POSSESSION",PolicyVersion:"v3",PolicyDigest:Digest([]byte("policy")),SourceDigest:Digest([]byte("source")),ReviewDigest:Digest([]byte("review")),LastReviewedAt:now.Add(-time.Hour),EffectiveFrom:now.Add(-2*time.Hour),EffectiveUntil:now.Add(time.Hour),Coverage:"REVIEWED",PublicSummary:"REVIEW_RULES",PublicDeepLink:"https://travel.420integrated.org/travel/policy/bc-possession"}
 run:=func(p TravelPolicyPublication,e error)(TravelPublicGuidance,error){return (TravelGuidanceAdapter{Source:c056Source{publication:p,err:e},AllowedPublicHost:"travel.420integrated.org"}).Read(context.Background(),"BC","POSSESSION",now)}
 result,err:=run(p,nil)
 if err!=nil||result.CoverageStatus!="REVIEWED"||result.PolicyVersion!="v3"||result.LastReviewedAt!="2026-10-11"||result.LegalAuthorization{t.Fatalf("valid guidance %+v %v",result,err)}
 serialized,_:=json.Marshal(result)
 for _,private:=range []string{"courier","checkout","private_address","delivery_token","recipient_id"} {if strings.Contains(strings.ToLower(string(serialized)),private){t.Fatalf("private/commerce field in Travel: %s",serialized)}}
 stale:=p;stale.EffectiveUntil=now
 result,err=run(stale,nil);if err!=nil||result.CoverageStatus!="UNKNOWN"||result.LegalAuthorization{t.Fatalf("expired coverage %+v %v",result,err)}
 for _,tc:=range []struct{name string;mutate func(*TravelPolicyPublication)}{
  {"cross region",func(x *TravelPolicyPublication){x.Region="AB"}},
  {"cross domain",func(x *TravelPolicyPublication){x.Domain="CONSUMPTION"}},
  {"missing review",func(x *TravelPolicyPublication){x.ReviewDigest=""}},
  {"future review",func(x *TravelPolicyPublication){x.LastReviewedAt=now.Add(time.Hour)}},
  {"unrecognized coverage",func(x *TravelPolicyPublication){x.Coverage="AUTHORIZED"}},
  {"checkout deep link",func(x *TravelPolicyPublication){x.PublicDeepLink="https://doobr.example/checkout"}},
  {"redirect-like query",func(x *TravelPolicyPublication){x.PublicDeepLink+="?next=checkout"}},
  {"url username",func(x *TravelPolicyPublication){x.PublicDeepLink="https://admin@travel.420integrated.org/travel/policy/item"}},
  {"private courier leak",func(x *TravelPolicyPublication){x.PublicSummary="Courier private address"}},
  {"markup",func(x *TravelPolicyPublication){x.PublicSummary="<script>"}},
  {"unreviewed free-form summary",func(x *TravelPolicyPublication){x.PublicSummary="Area approved, courier contact details available"}},
 }{copy:=p;tc.mutate(&copy);if got,e:=run(copy,nil);e==nil||got.CoverageStatus=="REVIEWED"{t.Fatalf("%s accepted: %+v %v",tc.name,got,e)}}
 if got,e:=run(p,errors.New("unavailable"));e==nil||got.CoverageStatus!="UNKNOWN"{t.Fatalf("outage %+v %v",got,e)}
}
