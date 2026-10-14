package complianceauth

import (
 "context"
 "encoding/json"
 "errors"
 "strings"
 "testing"
 "time"
)
type c053Resolver struct { evidence LocationApplicabilityEvidence; err error }
func(r c053Resolver)ResolveLocation(context.Context,string,string)(LocationApplicabilityEvidence,error){return r.evidence,r.err}
func TestC053LocationMapsPrivacyAndAuthority(t *testing.T){
 now:=time.Date(2026,10,11,19,0,0,0,time.UTC)
 e:=LocationApplicabilityEvidence{TenantID:"tenant",OperationRef:"order",Jurisdiction:"BC",CoarseRegion:"BC",PrivateAddressRef:"private-ref",PlaceID:"verified-place",AddressValidated:true,PlaceAssociationAuthorized:true,JurisdictionReviewed:true,SourceExpiresAt:now.Add(time.Hour)}
 evaluate:=func(ev LocationApplicabilityEvidence,exact bool)(LocationApplicability,error){return (LocationApplicabilityAdapter{Resolver:c053Resolver{evidence:ev}}).Evaluate(context.Background(),"tenant","order",exact,now)}
 r,err:=evaluate(e,true);if err!=nil||r.Outcome!="CANDIDATE_REVIEW_REQUIRED"||r.Region!="BC"{t.Fatalf("valid scoped evidence %+v %v",r,err)}
 payload,_:=json.Marshal(r);if strings.Contains(string(payload),"private-ref")||strings.Contains(string(payload),"verified-place")||strings.Contains(string(payload),"order"){t.Fatalf("private location leaked: %s",payload)}
 cases:=[]struct{name string;change func(*LocationApplicabilityEvidence)}{
  {"GPS-only",func(x *LocationApplicabilityEvidence){x.GPSOnly=true}},
  {"unauthorized place",func(x *LocationApplicabilityEvidence){x.PlaceAssociationAuthorized=false}},
  {"unreviewed jurisdiction",func(x *LocationApplicabilityEvidence){x.JurisdictionReviewed=false}},
  {"expired",func(x *LocationApplicabilityEvidence){x.SourceExpiresAt=now}},
  {"cross tenant",func(x *LocationApplicabilityEvidence){x.TenantID="attacker"}},
  {"cross order",func(x *LocationApplicabilityEvidence){x.OperationRef="other"}},
  {"address missing",func(x *LocationApplicabilityEvidence){x.PrivateAddressRef=""}},
  {"address not validated",func(x *LocationApplicabilityEvidence){x.AddressValidated=false}},
  {"place missing",func(x *LocationApplicabilityEvidence){x.PlaceID=""}},
 }
 for _,tc:=range cases{x:=e;tc.change(&x);if got,er:=evaluate(x,true);er==nil||got.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("%s accepted %+v %v",tc.name,got,er)}}
 coarse:=e;coarse.AddressValidated=false;coarse.PrivateAddressRef="";coarse.PlaceID=""
 if got,er:=evaluate(coarse,false);er!=nil||got.Outcome!="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("nonexact reviewed region %+v %v",got,er)}
 if _,er:=(LocationApplicabilityAdapter{Resolver:c053Resolver{err:errors.New("provider outage")}}).Evaluate(context.Background(),"tenant","order",true,now);er==nil{t.Fatal("provider outage accepted")}
 if _,er:=(LocationApplicabilityAdapter{}).Evaluate(context.Background(),"tenant","order",true,now);er==nil{t.Fatal("missing provider accepted")}
}
