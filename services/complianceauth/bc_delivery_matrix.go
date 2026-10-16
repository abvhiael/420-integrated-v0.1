package complianceauth

import "time"

// BCDeliveryClass is not a business licence or proof of authority.
type BCDeliveryClass string
const (
 BCLicenseeEmployee BCDeliveryClass = "LICENSEE_EMPLOYEE"
 BCDeliveryPerson BCDeliveryClass = "DELIVERY_PERSON"
 BCCommonCarrier BCDeliveryClass = "COMMON_CARRIER"
)
type BCDeliveryEvidence struct {
 Class BCDeliveryClass
 RetailStoreAuthorized bool
 OrderFromOriginStore bool
 PreparedInsideStore bool
 PaidBeforeDispatch bool
 RecipientAdultVerified bool
 RecipientNameAndSignature bool
 DeliveryInBC bool
 ToPurchasedAddress bool
 CurbsideImmediatelyOutsideStore bool
 StaffCarriesLicenceCopy bool
 DriverOver19Verified bool
 SellingItRightValid bool
 CommonCarrierFederalPackagingVerified bool
 CommonCarrierInaccessibleInMotion bool
 DeliveryWithinApprovedHours bool
 NoMinorsInVehicle bool
 SecureTransport bool
 FailedDelivery bool
 ReturnedToOriginStore bool
 SameDayReturn bool
}
type BCDeliveryRuleResult struct{ Outcome string; RequiredReview []string; MatchedProvisions []string; Authorized bool }

// EvaluateBCDeliveryMatrix tests separate carrier classifications against
// traced BC provisions. An internally consistent candidate is not a legal ALLOW.
func EvaluateBCDeliveryMatrix(e BCDeliveryEvidence,now time.Time) BCDeliveryRuleResult {
 r:=BCDeliveryRuleResult{Outcome:"REVIEW_REQUIRED"}
 fail:=func(s,provision string) BCDeliveryRuleResult {r.RequiredReview=append(r.RequiredReview,s);r.MatchedProvisions=append(r.MatchedProvisions,provision);return r}
 if now.IsZero(){return fail("TIME_UNVERIFIED","BC CLR s.5(2.1)")}
 if e.Class!=BCLicenseeEmployee&&e.Class!=BCDeliveryPerson&&e.Class!=BCCommonCarrier{return fail("UNKNOWN_CARRIER_CLASS","BC CLR s.1,5(2.1)(a)")}
 if !e.RetailStoreAuthorized||!e.OrderFromOriginStore||!e.PreparedInsideStore||!e.PaidBeforeDispatch{return fail("RETAILER_OR_ORIGIN_UNVERIFIED","BC CLR s.5(2.1); CRS Handbook 4.5")}
 if !e.DeliveryInBC||!e.SecureTransport||!e.NoMinorsInVehicle{return fail("TRANSPORT_SCOPE_UNVERIFIED","BC CLR s.5(2.1); CRS Handbook 4.5")}
 if !e.RecipientAdultVerified||!e.RecipientNameAndSignature{return fail("RECIPIENT_OR_RECEIPT_UNVERIFIED","BC CLR s.5(2.1)(d)-(e)")}
 if e.FailedDelivery {
  if !e.ReturnedToOriginStore{return fail("RETURN_UNVERIFIED","CRS Handbook 4.5")}
  if e.Class!=BCCommonCarrier&&!e.SameDayReturn{return fail("NONCARRIER_SAME_DAY_RETURN_REQUIRED","CRS Handbook 4.5")}
  return fail("FAILED_DELIVERY_NO_COMPLETION","BC CLR s.5(2.1)(e)")
 }
 switch e.Class{
 case BCLicenseeEmployee:
  if !e.DeliveryWithinApprovedHours||!e.StaffCarriesLicenceCopy{return fail("LICENSEE_HOURS_OR_LICENCE_COPY","BC CLR s.5(2.1)(b); CRS Handbook 4.5.16")}
  if !e.ToPurchasedAddress&&!e.CurbsideImmediatelyOutsideStore{return fail("LICENSEE_DELIVERY_LOCATION","BC CLR s.5(2.1)(b)(ii)")}
  r.MatchedProvisions=append(r.MatchedProvisions,"BC CLR s.5(2.1)(a)(i),(b)")
 case BCDeliveryPerson:
  if !e.DriverOver19Verified||!e.SellingItRightValid||!e.DeliveryWithinApprovedHours||!e.ToPurchasedAddress||e.CurbsideImmediatelyOutsideStore{return fail("DELIVERY_PERSON_REQUIREMENTS","BC CLR s.5(2.1)(c); CRS Handbook 4.5")}
  r.MatchedProvisions=append(r.MatchedProvisions,"BC CLR s.1,5(2.1)(a)(ii),(c),5.1")
 case BCCommonCarrier:
  if !e.DriverOver19Verified||!e.ToPurchasedAddress||e.CurbsideImmediatelyOutsideStore||!e.CommonCarrierFederalPackagingVerified||!e.CommonCarrierInaccessibleInMotion{return fail("COMMON_CARRIER_REQUIREMENTS","BC CLR s.5(2.1)(a)(iii),5.1; CCLA s.82; CRS Handbook 4.5.13")}
  r.MatchedProvisions=append(r.MatchedProvisions,"BC CLR s.1,5(2.1)(a)(iii),5.1; CCLA s.82")
 }
 r.Outcome="CANDIDATE_REVIEW_REQUIRED"
 r.RequiredReview=[]string{"INDEPENDENT_LEGAL_CARRIER_CLASSIFICATION_AND_LICENCE_REVIEW"}
 return r
}
