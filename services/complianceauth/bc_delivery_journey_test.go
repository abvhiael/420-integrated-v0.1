package complianceauth

import ("testing";"time")
func TestC046BCDeliveryJourneyAdversarial(t *testing.T) {
 now:=time.Date(2026,10,11,5,0,0,0,time.UTC)
 base:=BCDeliveryEvidence{Class:BCDeliveryPerson,RetailStoreAuthorized:true,OrderFromOriginStore:true,PreparedInsideStore:true,PaidBeforeDispatch:true,RecipientAdultVerified:true,RecipientNameAndSignature:true,DeliveryInBC:true,ToPurchasedAddress:true,DriverOver19Verified:true,SellingItRightValid:true,DeliveryWithinApprovedHours:true,NoMinorsInVehicle:true,SecureTransport:true}
 journey:=BCDeliveryJourney{Carrier:base,OrderID:"order",OriginStoreID:"retailer",ManifestStoreID:"retailer",PaymentCapturedBeforeDispatch:true,TransportCustodyRecorded:true,RecipientIdentityVerified:true,RecipientAgeVerified:true,RecipientSignatureRecorded:true,DispatchAt:now.Add(-time.Hour),CompletionAt:now.Add(-time.Minute),RecordOrder:true,RecordInvoice:true,RecordRecipient:true,RecordDelivery:true}
 for _,class:=range []BCDeliveryClass{BCLicenseeEmployee,BCDeliveryPerson,BCCommonCarrier}{
  x:=journey;x.Carrier.Class=class
  x.Carrier.StaffCarriesLicenceCopy=true
  x.Carrier.CommonCarrierFederalPackagingVerified=true
  x.Carrier.CommonCarrierInaccessibleInMotion=true
  got:=EvaluateBCDeliveryJourney(x,now)
  if got.Outcome!="CANDIDATE_REVIEW_REQUIRED"||got.Authorized{t.Fatalf("%s %+v",class,got)}
 }
 for _,tc:=range []struct{name string;alter func(*BCDeliveryJourney)}{
  {"wrong origin",func(x *BCDeliveryJourney){x.ManifestStoreID="different"}},
  {"payment not captured",func(x *BCDeliveryJourney){x.PaymentCapturedBeforeDispatch=false}},
  {"no custody",func(x *BCDeliveryJourney){x.TransportCustodyRecorded=false}},
  {"no invoice",func(x *BCDeliveryJourney){x.RecordInvoice=false}},
  {"no recipient age",func(x *BCDeliveryJourney){x.RecipientAgeVerified=false}},
  {"no recipient record",func(x *BCDeliveryJourney){x.RecordRecipient=false}},
  {"no signature",func(x *BCDeliveryJourney){x.RecipientSignatureRecorded=false}},
  {"completion before dispatch",func(x *BCDeliveryJourney){x.CompletionAt=x.DispatchAt.Add(-time.Second)}},
  {"refusal without return",func(x *BCDeliveryJourney){x.DeliveryRefused=true}},
  {"unavailable no return",func(x *BCDeliveryJourney){x.RecipientUnavailable=true}},
  {"unverified class",func(x *BCDeliveryJourney){x.Carrier.Class="UNKNOWN"}},
 } {
  x:=journey;tc.alter(&x);got:=EvaluateBCDeliveryJourney(x,now)
  if got.Outcome=="CANDIDATE_REVIEW_REQUIRED"||got.Authorized{t.Fatalf("%s %+v",tc.name,got)}
 }
 returned:=journey;returned.DeliveryRefused=true;returned.RecordRefusal=true;returned.RecordReturn=true;returned.GoodsReturnedToOrigin=true;returned.ReturnCustodyRecorded=true;returned.ReturnAt=now.Add(-time.Second);returned.Carrier.SameDayReturn=true
 result:=EvaluateBCDeliveryJourney(returned,now)
 if result.Stage!="RETURN"||result.Authorized||result.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("refused returned order completed %+v",result)}
 returned.Carrier.SameDayReturn=false
 result=EvaluateBCDeliveryJourney(returned,now)
 if result.Stage!="RETURN"||len(result.Reasons)==0||result.Reasons[0]!="SAME_DAY_RETURN_NOT_PROVEN"{t.Fatalf("same-day duty missed %+v",result)}
}
