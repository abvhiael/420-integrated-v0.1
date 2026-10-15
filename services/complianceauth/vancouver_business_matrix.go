package complianceauth

// VancouverBusinessEvidence keeps retailer and independent courier entities
// separate. Verified fields must come from independent official registries.
type VancouverBusinessEvidence struct {
 RetailerEntityID string
 CourierEntityID string
 RetailProvincialLicence bool
 RetailMunicipalLicence bool
 RetailDevelopmentPermit bool
 RetailZoningApproved bool
 RetailSiteRestrictionsChecked bool
 RetailLicenceCurrent bool
 CourierOperatingInVancouver bool
 CourierMunicipalBusinessLicenceVerified bool
 CourierClassificationIndependentlyApproved bool
 CourierBusinessAuthorityCurrent bool
 Jurisdiction string
}
type VancouverBusinessResult struct {
 Outcome string
 Reasons []string
 ProvisionRefs []string
 Authorized bool
}
func EvaluateVancouverBusiness(e VancouverBusinessEvidence) VancouverBusinessResult{
 r:=VancouverBusinessResult{Outcome:"REVIEW_REQUIRED",ProvisionRefs:[]string{
  "Vancouver cannabis retail store licence application Steps 1-4",
  "Vancouver Zoning and Development By-law s.11 cannabis-store use",
  "Vancouver business licence requirements",
 }}
 bad:=func(reason string)VancouverBusinessResult{r.Reasons=append(r.Reasons,reason);return r}
 if e.Jurisdiction!="Vancouver, BC"{return bad("JURISDICTION_UNVERIFIED")}
 if e.RetailerEntityID==""||!e.RetailProvincialLicence||!e.RetailMunicipalLicence||!e.RetailDevelopmentPermit||!e.RetailZoningApproved||!e.RetailSiteRestrictionsChecked||!e.RetailLicenceCurrent{return bad("RETAILER_PERMITS_OR_ZONING_UNVERIFIED")}
 if e.CourierEntityID==""||e.CourierEntityID==e.RetailerEntityID{return bad("INDEPENDENT_COURIER_ENTITY_CLASSIFICATION_REQUIRED")}
 if !e.CourierOperatingInVancouver||!e.CourierMunicipalBusinessLicenceVerified{return bad("COURIER_MUNICIPAL_LICENCE_UNVERIFIED")}
 if !e.CourierClassificationIndependentlyApproved||!e.CourierBusinessAuthorityCurrent{return bad("DOOBR_BUSINESS_CLASSIFICATION_AND_AUTHORITY_UNVERIFIED")}
 r.Outcome="CANDIDATE_REVIEW_REQUIRED"
 r.Reasons=[]string{"BC_DELIVERY_AND_LEGAL_APPROVAL_STILL_REQUIRED"}
 return r
}
