package complianceauth

import (
 "time"
)

// TravelContext is externally verified coverage data, not a geolocation or
// legal determination. An unknown boundary or venue must never inherit an ALLOW.
type TravelContext struct {
 Domain string
 Jurisdiction string
 VenueID string
 Activity string
 CrossingBorder bool
 IndigenousJurisdictionUnreviewed bool
 LocationValidated bool
 VenueValidated bool
 AdultVerified bool
 PublicConsumption bool
 DriverOperating bool
 VehicleStorageSecure bool
 QuantityDecimal string
 QuantityUnit string
}
type TravelPolicyPack struct {
 PolicyDigest string
 SourceDigest string
 ReviewDigest string
 Jurisdiction string
 Domain string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 ApprovedLocations map[string]bool
 ApprovedVenues map[string]bool
 ReviewedActivities map[string]bool
 MaximumQuantities map[string]string
}
type TravelAdvice struct {
 Outcome string
 Reasons []string
 LegalAuthorization bool
 PolicyDigest string
}
func EvaluateTravelGuidance(p TravelPolicyPack,c TravelContext,now time.Time) TravelAdvice{
 r:=TravelAdvice{Outcome:"REVIEW_REQUIRED"}
 fail:=func(s string)TravelAdvice{r.Reasons=[]string{s};return r}
 if c.CrossingBorder{return fail("BORDER_CROSSING_SEPARATE_LEGAL_REVIEW")}
 if c.IndigenousJurisdictionUnreviewed{return fail("INDIGENOUS_OR_OVERLAPPING_AUTHORITY_UNREVIEWED")}
 if now.IsZero()||!digestValid(p.PolicyDigest)||!digestValid(p.SourceDigest)||!digestValid(p.ReviewDigest)||p.EffectiveFrom.IsZero()||p.EffectiveUntil.IsZero()||now.Before(p.EffectiveFrom)||!now.Before(p.EffectiveUntil){return fail("POLICY_MISSING_OR_STALE")}
 if c.Jurisdiction==""||c.Domain==""||c.Jurisdiction!=p.Jurisdiction||c.Domain!=p.Domain{return fail("JURISDICTION_OR_DOMAIN_UNREVIEWED")}
 if !c.LocationValidated||!p.ApprovedLocations[c.Jurisdiction]||!c.VenueValidated||c.VenueID==""||!p.ApprovedVenues[c.VenueID]{return fail("LOCATION_OR_VENUE_UNREVIEWED")}
 if c.Activity!="POSSESSION"&&c.Activity!="TRANSPORT"&&c.Activity!="CONSUMPTION"{return fail("ACTIVITY_UNREVIEWED")}
 if !p.ReviewedActivities[c.Activity]||!c.AdultVerified{return fail("ACTIVITY_OR_AGE_UNVERIFIED")}
 if c.DriverOperating && c.Activity=="CONSUMPTION"{return fail("IMPAIRED_DRIVER_CONSUMPTION")}
 if c.Activity=="TRANSPORT"&&!c.VehicleStorageSecure{return fail("VEHICLE_STORAGE_UNVERIFIED")}
 if c.Activity=="CONSUMPTION"&&c.PublicConsumption{return fail("PUBLIC_CONSUMPTION_SITE_REVIEW_REQUIRED")}
 max,ok:=p.MaximumQuantities[c.QuantityUnit]
 if !ok{return fail("QUANTITY_UNIT_UNREVIEWED")}
 actual,e1:=exactUnsignedDecimal(c.QuantityDecimal);limit,e2:=exactUnsignedDecimal(max)
 if e1!=nil||e2!=nil||limit.Sign()==0{return fail("INVALID_QUANTITY")}
 if actual.Cmp(limit)>0{return fail("REVIEWED_QUANTITY_LIMIT_EXCEEDED")}
 // No positive legal permission can originate from a fixture policy pack.
 r.Outcome="CANDIDATE_GUIDANCE_REVIEW_REQUIRED"
 r.Reasons=[]string{"INDEPENDENT_LEGAL_AND_LOCAL_VENUE_AUTHORITY_REQUIRED"}
 r.PolicyDigest=p.PolicyDigest
 return r
}
