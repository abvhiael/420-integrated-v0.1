package complianceauth

import "time"

// BCDeliveryJourney is a read-only stage assessment. Assertions must be
// independently verified before use by any deployed system.
type BCDeliveryJourney struct {
 Carrier BCDeliveryEvidence
 OrderID string
 OriginStoreID string
 ManifestStoreID string
 PaymentCapturedBeforeDispatch bool
 TransportCustodyRecorded bool
 RecipientIdentityVerified bool
 RecipientAgeVerified bool
 RecipientSignatureRecorded bool
 DeliveryRefused bool
 RecipientUnavailable bool
 GoodsReturnedToOrigin bool
 ReturnCustodyRecorded bool
 ReturnAt time.Time
 DispatchAt time.Time
 CompletionAt time.Time
 RecordOrder bool
 RecordInvoice bool
 RecordRecipient bool
 RecordDelivery bool
 RecordRefusal bool
 RecordReturn bool
}
type BCJourneyResult struct {
 Outcome string
 Stage string
 Reasons []string
 ApplicableProvisions []string
 Authorized bool
}
func EvaluateBCDeliveryJourney(j BCDeliveryJourney, now time.Time) BCJourneyResult {
 r:=BCJourneyResult{Outcome:"REVIEW_REQUIRED"}
 fail:=func(stage,reason,provision string) BCJourneyResult {
  r.Stage=stage;r.Reasons=[]string{reason};r.ApplicableProvisions=[]string{provision};return r
 }
 if now.IsZero()||j.OrderID==""||j.OriginStoreID==""||j.ManifestStoreID==""||j.OriginStoreID!=j.ManifestStoreID||!j.Carrier.RetailStoreAuthorized||!j.Carrier.OrderFromOriginStore||!j.Carrier.PreparedInsideStore {
  return fail("ORIGIN","ORIGIN_AND_ORDER_EVIDENCE_REQUIRED","BC CLR s.5(2.1); CRS Handbook 4.5")
 }
 if !j.Carrier.PaidBeforeDispatch||!j.PaymentCapturedBeforeDispatch||j.DispatchAt.IsZero()||j.DispatchAt.After(now) {
  return fail("PAYMENT","PREPAID_DISPATCH_PROOF_REQUIRED","BC CLR s.5(2.1); CRS Handbook 4.5")
 }
 if !j.TransportCustodyRecorded||!j.Carrier.SecureTransport||!j.Carrier.DeliveryInBC||!j.Carrier.NoMinorsInVehicle {
  return fail("TRANSPORT","CUSTODY_OR_TRANSPORT_UNVERIFIED","BC CLR s.5(2.1)")
 }
 if !j.RecordOrder||!j.RecordInvoice||!j.RecordDelivery {
  return fail("RECORDS","ORDER_INVOICE_DELIVERY_RECORD_MISSING","CRS Handbook 4.5")
 }
 // No refusal or absence can be interpreted as a delivered order.
 if j.DeliveryRefused||j.RecipientUnavailable||j.Carrier.FailedDelivery {
  if !j.RecordRefusal||!j.RecordReturn||!j.GoodsReturnedToOrigin||!j.ReturnCustodyRecorded||j.ReturnAt.IsZero()||j.ReturnAt.Before(j.DispatchAt)||j.ReturnAt.After(now) {
   return fail("RETURN","REFUSAL_AND_RETURN_EVIDENCE_REQUIRED","CRS Handbook 4.5")
  }
  if j.Carrier.Class!=BCCommonCarrier&&!j.Carrier.SameDayReturn {
   return fail("RETURN","SAME_DAY_RETURN_NOT_PROVEN","CRS Handbook 4.5")
  }
  return fail("RETURN","FAILED_DELIVERY_CANNOT_COMPLETE","CRS Handbook 4.5")
 }
 if !j.RecipientIdentityVerified||!j.RecipientAgeVerified||!j.Carrier.RecipientAdultVerified||!j.RecordRecipient {
  return fail("RECIPIENT","ELIGIBLE_RECIPIENT_UNVERIFIED","BC CLR s.5(2.1)(d)")
 }
 if !j.RecipientSignatureRecorded||!j.Carrier.RecipientNameAndSignature||j.CompletionAt.IsZero()||j.CompletionAt.Before(j.DispatchAt)||j.CompletionAt.After(now) {
  return fail("HANDOVER","SIGNATURE_OR_CHRONOLOGY_UNVERIFIED","BC CLR s.5(2.1)(e)")
 }
 class:=EvaluateBCDeliveryMatrix(j.Carrier,now)
 if class.Outcome!="CANDIDATE_REVIEW_REQUIRED" {
  return fail("CLASSIFICATION","CARRIER_CLASS_DUTIES_UNVERIFIED","BC CLR s.1,5(2.1),5.1")
 }
 r.Stage="REVIEW";r.Outcome="CANDIDATE_REVIEW_REQUIRED"
 r.Reasons=[]string{"INDEPENDENT_CARRIER_CLASS_AND_RECORD_DUTIES_REVIEW"}
 r.ApplicableProvisions=append([]string(nil),class.MatchedProvisions...)
 return r
}
