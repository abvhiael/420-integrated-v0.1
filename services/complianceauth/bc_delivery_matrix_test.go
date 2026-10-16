package complianceauth

import("testing";"time")
func TestC044BCDeliveryClassMatrix(t *testing.T){
 now:=time.Date(2026,10,11,1,0,0,0,time.UTC)
 base:=BCDeliveryEvidence{RetailStoreAuthorized:true,OrderFromOriginStore:true,PreparedInsideStore:true,PaidBeforeDispatch:true,RecipientAdultVerified:true,RecipientNameAndSignature:true,DeliveryInBC:true,ToPurchasedAddress:true,StaffCarriesLicenceCopy:true,DriverOver19Verified:true,SellingItRightValid:true,CommonCarrierFederalPackagingVerified:true,CommonCarrierInaccessibleInMotion:true,DeliveryWithinApprovedHours:true,NoMinorsInVehicle:true,SecureTransport:true}
 for _,class:=range []BCDeliveryClass{BCLicenseeEmployee,BCDeliveryPerson,BCCommonCarrier}{
  e:=base;e.Class=class
  got:=EvaluateBCDeliveryMatrix(e,now)
  if got.Outcome!="CANDIDATE_REVIEW_REQUIRED"||got.Authorized||len(got.MatchedProvisions)==0{t.Fatalf("%s candidate %+v",class,got)}
  cases:=map[string]func(*BCDeliveryEvidence){
   "retailer":func(x *BCDeliveryEvidence){x.RetailStoreAuthorized=false},
   "wrong store":func(x *BCDeliveryEvidence){x.OrderFromOriginStore=false},
   "prepayment":func(x *BCDeliveryEvidence){x.PaidBeforeDispatch=false},
   "recipient":func(x *BCDeliveryEvidence){x.RecipientAdultVerified=false},
   "signature":func(x *BCDeliveryEvidence){x.RecipientNameAndSignature=false},
   "outside BC":func(x *BCDeliveryEvidence){x.DeliveryInBC=false},
   "minor in vehicle":func(x *BCDeliveryEvidence){x.NoMinorsInVehicle=false},
   "transport":func(x *BCDeliveryEvidence){x.SecureTransport=false},
   "failed unreturned":func(x *BCDeliveryEvidence){x.FailedDelivery=true},
  }
  for name,mutate:=range cases{x:=e;mutate(&x);r:=EvaluateBCDeliveryMatrix(x,now);if r.Outcome=="CANDIDATE_REVIEW_REQUIRED"||r.Authorized{t.Fatalf("%s %s accepted %+v",class,name,r)}}
 }
 staff:=base;staff.Class=BCLicenseeEmployee;staff.CurbsideImmediatelyOutsideStore=true;staff.ToPurchasedAddress=false
 if r:=EvaluateBCDeliveryMatrix(staff,now);r.Outcome!="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("staff curbside %v",r)}
 for _,class:=range []BCDeliveryClass{BCDeliveryPerson,BCCommonCarrier}{x:=staff;x.Class=class;if r:=EvaluateBCDeliveryMatrix(x,now);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("%s curbside wrongly allowed",class)}}
 person:=base;person.Class=BCDeliveryPerson;person.SellingItRightValid=false;if r:=EvaluateBCDeliveryMatrix(person,now);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatal("unqualified delivery person")}
 carrier:=base;carrier.Class=BCCommonCarrier;carrier.CommonCarrierInaccessibleInMotion=false;if r:=EvaluateBCDeliveryMatrix(carrier,now);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatal("accessible carrier cargo")}
 carrier=base;carrier.Class=BCCommonCarrier;carrier.CommonCarrierFederalPackagingVerified=false;if r:=EvaluateBCDeliveryMatrix(carrier,now);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatal("unverified carrier packaging")}
 for _,class:=range []BCDeliveryClass{BCLicenseeEmployee,BCDeliveryPerson,BCCommonCarrier}{
  x:=base;x.Class=class;x.FailedDelivery=true;x.ReturnedToOriginStore=true;x.SameDayReturn=class!=BCCommonCarrier
  if r:=EvaluateBCDeliveryMatrix(x,now);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("failed delivery completed: %s",class)}
 }
}
