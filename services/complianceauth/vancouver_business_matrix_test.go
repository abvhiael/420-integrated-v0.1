package complianceauth

import "testing"

func TestC045VancouverSeparateBusinessPermissions(t *testing.T){
 base:=VancouverBusinessEvidence{RetailerEntityID:"retailer-licence-holder",CourierEntityID:"doobr-courier",RetailProvincialLicence:true,RetailMunicipalLicence:true,RetailDevelopmentPermit:true,RetailZoningApproved:true,RetailSiteRestrictionsChecked:true,RetailLicenceCurrent:true,CourierOperatingInVancouver:true,CourierMunicipalBusinessLicenceVerified:true,CourierClassificationIndependentlyApproved:true,CourierBusinessAuthorityCurrent:true,Jurisdiction:"Vancouver, BC"}
 got:=EvaluateVancouverBusiness(base)
 if got.Outcome!="CANDIDATE_REVIEW_REQUIRED"||got.Authorized||len(got.ProvisionRefs)!=3{t.Fatalf("candidate result %+v",got)}
 cases:=[]struct{name string; mutate func(*VancouverBusinessEvidence)}{
 {"no province",func(x *VancouverBusinessEvidence){x.RetailProvincialLicence=false}},
 {"no municipality",func(x *VancouverBusinessEvidence){x.RetailMunicipalLicence=false}},
 {"no development permit",func(x *VancouverBusinessEvidence){x.RetailDevelopmentPermit=false}},
 {"no zoning approval",func(x *VancouverBusinessEvidence){x.RetailZoningApproved=false}},
 {"site restrictions unknown",func(x *VancouverBusinessEvidence){x.RetailSiteRestrictionsChecked=false}},
 {"retailer revoked",func(x *VancouverBusinessEvidence){x.RetailLicenceCurrent=false}},
 {"same business ambiguous",func(x *VancouverBusinessEvidence){x.CourierEntityID=x.RetailerEntityID}},
 {"missing courier business licence",func(x *VancouverBusinessEvidence){x.CourierMunicipalBusinessLicenceVerified=false}},
 {"courier classification unresolved",func(x *VancouverBusinessEvidence){x.CourierClassificationIndependentlyApproved=false}},
 {"courier authority stale",func(x *VancouverBusinessEvidence){x.CourierBusinessAuthorityCurrent=false}},
 {"outside city",func(x *VancouverBusinessEvidence){x.Jurisdiction="Burnaby, BC"}},
 }
 for _,tc:=range cases{x:=base;tc.mutate(&x);out:=EvaluateVancouverBusiness(x);if out.Outcome=="CANDIDATE_REVIEW_REQUIRED"||out.Authorized{t.Fatalf("%s wrongly accepted: %+v",tc.name,out)}}
}
