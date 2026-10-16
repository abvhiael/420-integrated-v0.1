package complianceauth
import("errors";"testing";"time")
func TestC032PolicySchemaFailClosed(t *testing.T){
 at:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 p:=CompliancePolicySchema{Version:"420compliance-policy-schema/v1",PolicyID:"fixture",AuthorityGraphVersion:"graph-v1",LegalJurisdictionID:"CA-BC",SourceDigest:Digest([]byte("source")),EffectiveFrom:at,Actors:[]PolicyActor{{Role:"retailer",IssuerID:"verified-issuer-required"}},Products:[]PolicyProduct{{Class:"flower",Unit:"gram",EquivalencyNumerator:1,EquivalencyDenominator:1}},Stages:[]PolicyStage{{Name:"delivery",RequiredCredentials:[]string{"license","identity"},RecipientVerification:"must verify recipient",PaymentPrerequisite:"payment preauthorized",ReturnDuty:"return if rejected",RecordObligation:"retain delivery evidence"}},Hours:PolicyHours{Timezone:"America/Vancouver",StartLocal:"09:00",EndLocal:"21:00"},RequiredRecords:[]string{"delivery receipt"},ReviewState:"DRAFT_REVIEW_REQUIRED"}
 if e:=ValidatePolicySchema(p);e!=nil{t.Fatalf("valid structure: %v",e)}
 cases:=[]struct{name string;mutate func(*CompliancePolicySchema)}{
 {"no issuer",func(x *CompliancePolicySchema){x.Actors[0].IssuerID=""}},
 {"zero equivalency",func(x *CompliancePolicySchema){x.Products[0].EquivalencyDenominator=0}},
 {"overflow equivalency",func(x *CompliancePolicySchema){x.Products[0].EquivalencyNumerator=9223372036854775807;x.Products[0].EquivalencyDenominator=2}},
 {"stage without recipient",func(x *CompliancePolicySchema){x.Stages[0].RecipientVerification=""}},
 {"stage without payment",func(x *CompliancePolicySchema){x.Stages[0].PaymentPrerequisite=""}},
 {"stage without return duty",func(x *CompliancePolicySchema){x.Stages[0].ReturnDuty=""}},
 {"stage without records",func(x *CompliancePolicySchema){x.Stages[0].RecordObligation=""}},
 {"missing credentials",func(x *CompliancePolicySchema){x.Stages[0].RequiredCredentials=nil}},
 {"invalid zone",func(x *CompliancePolicySchema){x.Hours.Timezone="bad/zone"}},
 {"invalid hour",func(x *CompliancePolicySchema){x.Hours.StartLocal="25:00"}},
 {"overnight undeclared",func(x *CompliancePolicySchema){x.Hours.StartLocal="22:00"}},
 {"missing authority",func(x *CompliancePolicySchema){x.AuthorityGraphVersion=""}},
 {"untrusted status",func(x *CompliancePolicySchema){x.ReviewState="APPROVED"}},
 {"missing records",func(x *CompliancePolicySchema){x.RequiredRecords=nil}},
 {"invalid digest",func(x *CompliancePolicySchema){x.SourceDigest="tampered"}},
 {"invalid interval",func(x *CompliancePolicySchema){x.EffectiveUntil=at}},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){q:=p;q.Actors=append([]PolicyActor(nil),p.Actors...);q.Products=append([]PolicyProduct(nil),p.Products...);q.Stages=append([]PolicyStage(nil),p.Stages...);tc.mutate(&q);if e:=ValidatePolicySchema(q);!errors.Is(e,ErrInvalidPolicySchema){t.Fatalf("accepted invalid schema: %v",e)}})}
}
