package complianceauth

import ("testing";"time")
func TestC043FederalProductCandidateBoundaries(t *testing.T){
 now:=time.Date(2026,10,11,0,0,0,0,time.UTC)
 p:=FederalProductPolicy{PolicyDigest:Digest([]byte("policy")),SourceDigest:Digest([]byte("source")),ReviewDigest:Digest([]byte("review")),EffectiveFrom:now.Add(-time.Hour),EffectiveUntil:now.Add(time.Hour),NonMedical:true,ClassEquivalencies:map[string]PolicyEquivalency{"sample":{Unit:"mg",Numerator:"2",Denominator:"3"}},PackagingRequired:true,PromotionProhibited:true,PaymentRouteReviewed:true}
 f:=FederalProductFacts{Class:"sample",Unit:"mg",Quantity:"9",PackageVerified:true,PaymentRoute:"external-reviewed-route"}
 result:=AssessFederalProduct(p,f,now)
 if result.State!="CANDIDATE_REVIEW_REQUIRED"||result.PolicyAuthorized||result.EquivalentNumerator!="18"||result.EquivalentDenominator!="3"{t.Fatalf("candidate/quantity incorrect %+v",result)}
 check:=func(name string,policy FederalProductPolicy,facts FederalProductFacts,at time.Time){t.Helper();r:=AssessFederalProduct(policy,facts,at);if r.State=="CANDIDATE_REVIEW_REQUIRED"||r.PolicyAuthorized{t.Fatalf("%s unexpectedly eligible: %+v",name,r)}}
 changed:=p;changed.NonMedical=false;check("medical scope",changed,f,now)
 changed=p;changed.PaymentRouteReviewed=false;check("payment route",changed,f,now)
 changed=p;changed.PolicyDigest="";check("unreviewed digest",changed,f,now)
 check("expired",p,f,now.Add(time.Hour))
 bad:=f;bad.PackageVerified=false;check("packaging",p,bad,now)
 bad=f;bad.PromotionPresent=true;check("promotion",p,bad,now)
 bad=f;bad.MedicalClaim=true;check("medical claim",p,bad,now)
 bad=f;bad.PaymentRoute="";check("unreviewed payment",p,bad,now)
 bad=f;bad.Class="unknown";check("unknown product",p,bad,now)
 bad=f;bad.Quantity="-3";check("negative",p,bad,now)
 bad=f;bad.Quantity="999999999999999999999999999999999999999";check("overflow",p,bad,now)
 changed=p;changed.ClassEquivalencies=map[string]PolicyEquivalency{"sample":{Unit:"mg",Numerator:"1",Denominator:"0"}};check("zero denominator",changed,f,now)
}
