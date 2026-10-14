package complianceauth

import("context";"testing";"time")

// C04.11 retains the full BC/Vancouver non-authorizing cross-policy boundary
// under one test, preventing isolated positive fixtures from hiding a mismatch.
func TestC0411BCVancouverMilestoneIntegration(t *testing.T){
 now:=time.Date(2026,10,11,18,0,0,0,time.UTC)
 v:=VancouverBusinessEvidence{RetailerEntityID:"store",CourierEntityID:"independent-doobr",RetailProvincialLicence:true,RetailMunicipalLicence:true,RetailDevelopmentPermit:true,RetailZoningApproved:true,RetailSiteRestrictionsChecked:true,RetailLicenceCurrent:true,CourierOperatingInVancouver:true,CourierMunicipalBusinessLicenceVerified:true,CourierClassificationIndependentlyApproved:true,CourierBusinessAuthorityCurrent:true,Jurisdiction:"Vancouver, BC"}
 b:=BCDeliveryEvidence{Class:BCDeliveryPerson,RetailStoreAuthorized:true,OrderFromOriginStore:true,PreparedInsideStore:true,PaidBeforeDispatch:true,RecipientAdultVerified:true,RecipientNameAndSignature:true,DeliveryInBC:true,ToPurchasedAddress:true,DriverOver19Verified:true,SellingItRightValid:true,DeliveryWithinApprovedHours:true,NoMinorsInVehicle:true,SecureTransport:true}
 j:=BCDeliveryJourney{Carrier:b,OrderID:"order",OriginStoreID:"store",ManifestStoreID:"store",PaymentCapturedBeforeDispatch:true,TransportCustodyRecorded:true,RecipientIdentityVerified:true,RecipientAgeVerified:true,RecipientSignatureRecorded:true,DispatchAt:now.Add(-time.Hour),CompletionAt:now.Add(-time.Minute),RecordOrder:true,RecordInvoice:true,RecordRecipient:true,RecordDelivery:true}
 if r:=EvaluateVancouverBusiness(v);r.Outcome!="CANDIDATE_REVIEW_REQUIRED"||r.Authorized{t.Fatalf("city integration %+v",r)}
 if r:=EvaluateBCDeliveryJourney(j,now);r.Outcome!="CANDIDATE_REVIEW_REQUIRED"||r.Authorized{t.Fatalf("delivery integration %+v",r)}
 v.CourierClassificationIndependentlyApproved=false
 if r:=EvaluateVancouverBusiness(v);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatal("retail authority improperly inherited by courier")}
 j.Carrier.Class=BCCommonCarrier;j.Carrier.CommonCarrierFederalPackagingVerified=true;j.Carrier.CommonCarrierInaccessibleInMotion=true
 if r:=EvaluateBCDeliveryJourney(j,now);r.Outcome!="CANDIDATE_REVIEW_REQUIRED"{t.Fatalf("common carrier fixture %+v",r)}
 j.Carrier.CommonCarrierInaccessibleInMotion=false
 if r:=EvaluateBCDeliveryJourney(j,now);r.Outcome=="CANDIDATE_REVIEW_REQUIRED"{t.Fatal("carrier crossover allowed")}
 old:=PublicationFence{Scope:"delivery/BC",Sequence:8,RevocationEpoch:3,PolicyDigest:Digest([]byte("previous BC policy")),DependencyDigest:Digest([]byte("upstream")),ExpiresAt:now.Add(time.Hour)}
 next:=old;next.Sequence=9;next.PolicyDigest=Digest([]byte("new reviewed BC policy"))
 store:=&MemoryPublicationStore{entries:map[string]PublicationFence{old.Scope:next}}
 receipt:=BoundDecisionReceipt{ReceiptID:"previous",OperationRef:"order",PolicyDigest:old.PolicyDigest}
 impact,err:=AssessActivationImpact(context.Background(),store,&PublicationCache{},old,next,[]ActivationOrder{{OrderID:"order",Scope:old.Scope,Stage:"IN_TRANSIT",PreviousReceipt:receipt}},now)
 if err!=nil||impact.Authorized||len(impact.Impacts)!=1||impact.Impacts[0].Action!="STOP_REASSESS_RETURN_REVIEW"||impact.Impacts[0].PreviousPolicyDigest!=old.PolicyDigest{t.Fatalf("unsafe activation %+v %v",impact,err)}
}
