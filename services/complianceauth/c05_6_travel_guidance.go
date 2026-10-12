package complianceauth

import (
 "context"
 "errors"
 "net/url"
 "strings"
 "time"
)

// TravelGuidanceSource is a reviewed public-policy publication boundary.
// No private courier, customer, address, GPS, or checkout object is accepted.
type TravelGuidanceSource interface {
 CurrentTravelPolicy(context.Context,string,string)(TravelPolicyPublication,error)
}
type TravelPolicyPublication struct {
 Region string
 Domain string
 PolicyVersion string
 PolicyDigest string
 SourceDigest string
 ReviewDigest string
 LastReviewedAt time.Time
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 Coverage string // REVIEWED, PARTIAL, UNKNOWN
 PublicSummary string
 PublicDeepLink string
}
type TravelPublicGuidance struct {
 Region string `json:"region"`
 Domain string `json:"domain"`
 CoverageStatus string `json:"coverage_status"`
 LastReviewedAt string `json:"last_review_date,omitempty"`
 PolicyVersion string `json:"policy_version,omitempty"`
 PolicyDigest string `json:"policy_digest,omitempty"`
 Summary string `json:"summary"`
 DeepLink string `json:"deep_link,omitempty"`
 LegalAuthorization bool `json:"legal_authorization"`
}
type TravelGuidanceAdapter struct{ Source TravelGuidanceSource; AllowedPublicHost string }
var ErrTravelGuidanceUnavailable=errors.New("travel guidance source unavailable")

func (a TravelGuidanceAdapter) Read(ctx context.Context,region,domain string,now time.Time)(TravelPublicGuidance,error){
 zero:=TravelPublicGuidance{Region:region,Domain:domain,CoverageStatus:"UNKNOWN",Summary:"Current policy coverage requires review"}
 if ctx==nil||ctx.Err()!=nil||a.Source==nil||now.IsZero()||!c051Scope(region)||!c051Scope(domain)||a.AllowedPublicHost=="" {return TravelPublicGuidance{},ErrTravelGuidanceUnavailable}
 p,e:=a.Source.CurrentTravelPolicy(ctx,region,domain)
 if e!=nil||ctx.Err()!=nil{return zero,ErrTravelGuidanceUnavailable}
 if p.Region!=region||p.Domain!=domain||!c051Scope(p.PolicyVersion)||!digestValid(p.PolicyDigest)||!digestValid(p.SourceDigest)||!digestValid(p.ReviewDigest)||p.LastReviewedAt.IsZero()||p.LastReviewedAt.After(now)||p.EffectiveFrom.IsZero()||p.EffectiveUntil.IsZero()||!p.EffectiveUntil.After(p.EffectiveFrom){return zero,ErrTravelGuidanceUnavailable}
 if p.Coverage!="REVIEWED"&&p.Coverage!="PARTIAL"&&p.Coverage!="UNKNOWN"{return zero,ErrTravelGuidanceUnavailable}
 // If the publication expires or is not effective, never show REVIEWED.
 coverage:=p.Coverage
 if now.Before(p.EffectiveFrom)||!now.Before(p.EffectiveUntil){coverage="UNKNOWN"}
 // Restrict summaries to a small printable public-safe vocabulary. Never
 // reflect markup, URLs, sensitive references, or full policy source.
 summary:=p.PublicSummary
 if len(summary)==0||len(summary)>400||strings.ContainsAny(summary,"<>\r\n@")||strings.Contains(strings.ToLower(summary),"checkout")||strings.Contains(strings.ToLower(summary),"courier")||strings.Contains(strings.ToLower(summary),"address"){return zero,ErrTravelGuidanceUnavailable}
 u,e:=url.Parse(p.PublicDeepLink)
 if e!=nil||u.Scheme!="https"||u.Host!=a.AllowedPublicHost||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||!strings.HasPrefix(u.Path,"/travel/policy/")||strings.Contains(u.Path,"..")||len(u.Path)>200{return zero,ErrTravelGuidanceUnavailable}
 return TravelPublicGuidance{Region:region,Domain:domain,CoverageStatus:coverage,LastReviewedAt:p.LastReviewedAt.UTC().Format("2006-01-02"),PolicyVersion:p.PolicyVersion,PolicyDigest:p.PolicyDigest,Summary:summary,DeepLink:u.String(),LegalAuthorization:false},nil
}
