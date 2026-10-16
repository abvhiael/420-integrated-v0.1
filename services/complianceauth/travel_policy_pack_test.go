package complianceauth

import ("testing";"time")
func TestC047TravelCoverageBoundaries(t *testing.T){
 now:=time.Date(2026,10,11,5,0,0,0,time.UTC)
 p:=TravelPolicyPack{PolicyDigest:Digest([]byte("policy")),SourceDigest:Digest([]byte("source")),ReviewDigest:Digest([]byte("review")),Domain:"travel",Jurisdiction:"BC",EffectiveFrom:now.Add(-time.Hour),EffectiveUntil:now.Add(time.Hour),ApprovedLocations:map[string]bool{"BC":true},ApprovedVenues:map[string]bool{"approved-private-venue":true},ReviewedActivities:map[string]bool{"POSSESSION":true,"TRANSPORT":true,"CONSUMPTION":true},MaximumQuantities:map[string]string{"mg":"100"}}
 c:=TravelContext{Domain:"travel",Jurisdiction:"BC",VenueID:"approved-private-venue",Activity:"POSSESSION",LocationValidated:true,VenueValidated:true,AdultVerified:true,QuantityDecimal:"50",QuantityUnit:"mg",VehicleStorageSecure:true}
 good:=EvaluateTravelGuidance(p,c,now);if good.Outcome!="CANDIDATE_GUIDANCE_REVIEW_REQUIRED"||good.LegalAuthorization{t.Fatalf("candidate %+v",good)}
 for _,activity:=range []string{"POSSESSION","TRANSPORT","CONSUMPTION"}{x:=c;x.Activity=activity;r:=EvaluateTravelGuidance(p,x,now);if r.Outcome!="CANDIDATE_GUIDANCE_REVIEW_REQUIRED"||r.LegalAuthorization{t.Fatalf("%s %+v",activity,r)}}
 checks:=[]struct{name string;mutate func(*TravelContext)}{
 {"border",func(x *TravelContext){x.CrossingBorder=true}},
 {"unreviewed Indigenous authority",func(x *TravelContext){x.IndigenousJurisdictionUnreviewed=true}},
 {"unknown locality",func(x *TravelContext){x.Jurisdiction="AB"}},
 {"unknown venue",func(x *TravelContext){x.VenueID="street"}},
 {"missing venue confirmation",func(x *TravelContext){x.VenueValidated=false}},
 {"unreviewed activity",func(x *TravelContext){x.Activity="DELIVERY"}},
 {"minor",func(x *TravelContext){x.AdultVerified=false}},
 {"unsecured transport",func(x *TravelContext){x.Activity="TRANSPORT";x.VehicleStorageSecure=false}},
 {"consumption while driving",func(x *TravelContext){x.Activity="CONSUMPTION";x.DriverOperating=true}},
 {"public consumption",func(x *TravelContext){x.Activity="CONSUMPTION";x.PublicConsumption=true}},
 {"unknown quantity units",func(x *TravelContext){x.QuantityUnit="g"}},
 {"over quantity limit",func(x *TravelContext){x.QuantityDecimal="101"}},
 {"negative",func(x *TravelContext){x.QuantityDecimal="-1"}},
 }
 for _,tc:=range checks{x:=c;tc.mutate(&x);r:=EvaluateTravelGuidance(p,x,now);if r.Outcome=="CANDIDATE_GUIDANCE_REVIEW_REQUIRED"||r.LegalAuthorization{t.Fatalf("%s %+v",tc.name,r)}}
 if r:=EvaluateTravelGuidance(p,c,now.Add(time.Hour));r.Outcome=="CANDIDATE_GUIDANCE_REVIEW_REQUIRED"{t.Fatal("stale policy")}
}
