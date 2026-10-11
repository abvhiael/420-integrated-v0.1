package complianceauth

import (
 "errors"
 "math/big"
 "time"
)

var ErrFederalProductReview = errors.New("federal product policy review required")

// FederalProductPolicy is an externally reviewed candidate, never a built-in
// interpretation of the Cannabis Act or Regulations. Numeric thresholds must
// arrive from the approved, versioned jurisdiction-specific legal source.
type FederalProductPolicy struct {
 PolicyDigest string
 SourceDigest string
 ReviewDigest string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 NonMedical bool
 ClassEquivalencies map[string]PolicyEquivalency
 PackagingRequired bool
 PromotionProhibited bool
 PaymentRouteReviewed bool
}
type PolicyEquivalency struct {
 Unit string
 Numerator string
 Denominator string
}
type FederalProductFacts struct {
 Class string
 Unit string
 Quantity string
 PackageVerified bool
 PromotionPresent bool
 MedicalClaim bool
 PaymentRoute string
}
type FederalProductAssessment struct {
 State string
 Reasons []string
 EquivalentNumerator string
 EquivalentDenominator string
 PolicyAuthorized bool
}

// AssessFederalProduct returns a review candidate, never an ALLOW or payment
// authorization. A legal decision requires separate official-source,
// jurisdiction, licence, reviewer and live revocation gates.
func AssessFederalProduct(p FederalProductPolicy, f FederalProductFacts,now time.Time) FederalProductAssessment {
 result:=FederalProductAssessment{State:"REVIEW_REQUIRED"}
 fail:=func(code string) FederalProductAssessment {result.Reasons=[]string{code};return result}
 if now.IsZero()||!digestValid(p.PolicyDigest)||!digestValid(p.SourceDigest)||!digestValid(p.ReviewDigest)||p.EffectiveFrom.IsZero()||p.EffectiveUntil.IsZero()||now.Before(p.EffectiveFrom)||!now.Before(p.EffectiveUntil){return fail("FEDERAL_POLICY_UNREVIEWED_OR_EXPIRED")}
 if !p.NonMedical||f.MedicalClaim{return fail("MEDICAL_SCOPE_SEPARATE_REVIEW")}
 if f.Class==""||f.Unit==""||f.Quantity==""{return fail("PRODUCT_EVIDENCE_MISSING")}
 eq,ok:=p.ClassEquivalencies[f.Class]
 if !ok||eq.Unit!=f.Unit{return fail("PRODUCT_CLASS_OR_UNIT_UNREVIEWED")}
 quantity,qerr:=exactUnsignedDecimal(f.Quantity)
 num,nerr:=exactUnsignedDecimal(eq.Numerator)
 den,derr:=exactUnsignedDecimal(eq.Denominator)
 if qerr!=nil||nerr!=nil||derr!=nil||num.Sign()==0||den.Sign()==0{return fail("INVALID_EQUIVALENCY_OR_QUANTITY")}
 // Exact rational math, without floating point rounding or overflow.
 product:=new(big.Int).Mul(quantity,num)
 if product.BitLen()>256{return fail("EQUIVALENCY_BUDGET_EXCEEDED")}
 result.EquivalentNumerator=product.String()
 result.EquivalentDenominator=den.String()
 if !p.PackagingRequired||!f.PackageVerified{return fail("PACKAGING_UNVERIFIED")}
 if !p.PromotionProhibited||f.PromotionPresent{return fail("PROMOTION_REVIEW_OR_PROHIBITION")}
 if f.PaymentRoute==""||!p.PaymentRouteReviewed{return fail("PAYMENT_ROUTE_LEGAL_REVIEW_REQUIRED")}
 result.State="CANDIDATE_REVIEW_REQUIRED"
 result.Reasons=[]string{"INDEPENDENT_LEGAL_AND_OPERATIONAL_AUTHORITY_REQUIRED"}
 return result
}
