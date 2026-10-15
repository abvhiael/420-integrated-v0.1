package complianceauth

import (
 "context"
 "errors"
 "time"
)

// LocationApplicabilityEvidence is private. No public JSON endpoint may
// serialize this structure: coordinates and address are stage-scoped evidence.
type LocationApplicabilityEvidence struct {
 TenantID string
 OperationRef string
 Jurisdiction string
 CoarseRegion string
 PrivateAddressRef string
 PlaceID string
 AddressValidated bool
 PlaceAssociationAuthorized bool
 JurisdictionReviewed bool
 SourceExpiresAt time.Time
 GPSOnly bool
}
type TrustedLocationResolver interface {
 ResolveLocation(context.Context,string,string)(LocationApplicabilityEvidence,error)
}
type LocationApplicability struct{
 Region string
 Outcome string
 Reason string
 EvidenceDigest string
}
type LocationApplicabilityAdapter struct { Resolver TrustedLocationResolver }
func (a LocationApplicabilityAdapter) Evaluate(ctx context.Context,tenant,operation string,requireExactAddress bool,now time.Time)(LocationApplicability,error){
 empty:=LocationApplicability{Outcome:"REVIEW_REQUIRED",Reason:"LOCATION_AUTHORITY_UNAVAILABLE"}
 if ctx==nil||ctx.Err()!=nil||a.Resolver==nil||!c051Scope(tenant)||!c051Scope(operation)||now.IsZero(){return empty,ErrUnavailable}
 evidence,err:=a.Resolver.ResolveLocation(ctx,tenant,operation)
 if err!=nil {return empty,errors.Join(ErrUnavailable,err)}
 if evidence.TenantID!=tenant||evidence.OperationRef!=operation||!c051Scope(evidence.Jurisdiction)||
 !c051Scope(evidence.CoarseRegion)||evidence.GPSOnly||!evidence.PlaceAssociationAuthorized||!evidence.JurisdictionReviewed||
 evidence.SourceExpiresAt.IsZero()||!now.Before(evidence.SourceExpiresAt) {
  return empty,ErrUnauthorized
 }
 if requireExactAddress && (!evidence.AddressValidated||!c051Scope(evidence.PrivateAddressRef)||!c051Scope(evidence.PlaceID)) {
  return empty,ErrUnauthorized
 }
 // Coarse region only: private address, place association and coordinates are
 // never included in the public-safe applicability projection.
 return LocationApplicability{Region:evidence.CoarseRegion,Outcome:"CANDIDATE_REVIEW_REQUIRED",Reason:"LOCATION_SCOPE_VERIFIED_NOT_LEGAL_AUTHORIZATION"},nil
}
