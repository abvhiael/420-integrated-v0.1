package complianceauth

import (
 "context"
 "errors"
 "time"
)

// C05.7 keeps policy coverage, legal eligibility and physical courier supply
// separate. This projection is read-only and cannot authorize checkout.
type CourierSupplyEvidence struct {
 Region string
 ProviderID string
 Qualified bool
 Available bool
 Revoked bool
 ActiveUntil time.Time
 LastVerifiedAt time.Time
 PrivateCourierCount int
}
type CourierSupplySource interface {
 CurrentSupply(context.Context,string)(CourierSupplyEvidence,error)
}
type TravelPresence struct {
 Region string `json:"region"`
 PolicyCoverage string `json:"policy_coverage"`
 LegalEligibility string `json:"legal_eligibility"`
 CourierSupply string `json:"courier_supply"`
 Visible bool `json:"visible"`
 PolicyVersion string `json:"policy_version,omitempty"`
 ExpiresAt string `json:"expires_at,omitempty"`
}
type TravelPresenceAdapter struct{
 Guidance TravelGuidanceAdapter
 Supply CourierSupplySource
 MinimumPrivateCohort int
 MaxSupplyAge time.Duration
}
var ErrPresenceUnavailable=errors.New("travel provider presence unavailable")
func(a TravelPresenceAdapter) Read(ctx context.Context,region string,now time.Time)(TravelPresence,error){
 out:=TravelPresence{Region:region,PolicyCoverage:"UNKNOWN",LegalEligibility:"UNVERIFIED",CourierSupply:"UNKNOWN"}
 if ctx==nil||ctx.Err()!=nil||!c051Scope(region)||a.Supply==nil||a.MinimumPrivateCohort<2||a.MaxSupplyAge<=0||a.MaxSupplyAge>24*time.Hour||now.IsZero(){return out,ErrPresenceUnavailable}
 // Coverage visibility is distinct from independent legal authorization.
 advice,e:=a.Guidance.Read(ctx,region,"TRANSPORT",now)
 if e!=nil{return out,ErrPresenceUnavailable}
 out.PolicyCoverage=advice.CoverageStatus
 out.PolicyVersion=advice.PolicyVersion
 if advice.CoverageStatus!="REVIEWED" {return out,nil}
 supply,e:=a.Supply.CurrentSupply(ctx,region)
 if e!=nil||ctx.Err()!=nil{return out,ErrPresenceUnavailable}
 if supply.Region!=region||!c051Scope(supply.ProviderID)||!supply.Qualified||supply.Revoked||!supply.Available||supply.ActiveUntil.IsZero()||!now.Before(supply.ActiveUntil)||supply.LastVerifiedAt.IsZero()||supply.LastVerifiedAt.After(now)||now.Sub(supply.LastVerifiedAt)>a.MaxSupplyAge{return out,nil}
 // No provider, count, availability units, identity, vehicle, order or
 // customer location is ever serialized. Small private cohorts stay hidden.
 if supply.PrivateCourierCount<a.MinimumPrivateCohort{return out,nil}
 out.CourierSupply="AVAILABLE"
 out.Visible=true
 out.ExpiresAt=supply.ActiveUntil.UTC().Format(time.RFC3339)
 return out,nil
}
