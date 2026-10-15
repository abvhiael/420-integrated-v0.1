package complianceauth

import (
 "errors"
 "time"
)

var ErrInvalidSourceHealth=errors.New("invalid compliance source health")

type SourceHealthInput struct {
 SourceID string
 CollectedAt time.Time
 LastSuccessfulAt time.Time
 CollectionFailed bool
 SourceMissing bool
 UnreadableUpdate bool
 ReviewExpiresAt time.Time
 ReviewedPolicyDigest string
 MaxSourceAge time.Duration
}
type SourceHealthDecision struct {
 SourceID string
 Status string
 Reasons []string
 Escalation string
 MayAuthorize bool
 ReviewRenewed bool
}
// AssessSourceHealth never renews legal review on a successful HTTP fetch.
// Collection status and legal review expiry are independent security clocks.
func AssessSourceHealth(in SourceHealthInput,now time.Time)(SourceHealthDecision,error){
 out:=SourceHealthDecision{SourceID:in.SourceID,Status:"BLOCKED_REVIEW_REQUIRED",MayAuthorize:false,ReviewRenewed:false}
 if in.SourceID==""||now.IsZero()||in.MaxSourceAge<=0||in.LastSuccessfulAt.After(now)||in.CollectedAt.After(now)||(!in.ReviewExpiresAt.IsZero()&&in.ReviewExpiresAt.After(now.Add(365*24*time.Hour))){return out,ErrInvalidSourceHealth}
 if in.CollectionFailed {out.Reasons=append(out.Reasons,"COLLECTION_FAILED")}
 if in.SourceMissing {out.Reasons=append(out.Reasons,"SOURCE_DISAPPEARED")}
 if in.UnreadableUpdate {out.Reasons=append(out.Reasons,"UNREADABLE_UPDATE")}
 if in.LastSuccessfulAt.IsZero()||now.Sub(in.LastSuccessfulAt)>in.MaxSourceAge {out.Reasons=append(out.Reasons,"SOURCE_STALE")}
 if in.ReviewExpiresAt.IsZero()||!now.Before(in.ReviewExpiresAt) {out.Reasons=append(out.Reasons,"LEGAL_REVIEW_EXPIRED")}
 if in.ReviewedPolicyDigest==""||!digestValid(in.ReviewedPolicyDigest){out.Reasons=append(out.Reasons,"REVIEW_EVIDENCE_MISSING")}
 if len(out.Reasons)>0{
  out.Escalation="BLOCK_TRANSACTION_AND_ESCALATE_TO_SOURCE_OWNER_AND_INDEPENDENT_REVIEWER"
  return out,nil
 }
 // Healthy collection and unexpired reviewed digest are necessary, never sufficient.
 out.Status="SOURCE_HEALTHY_REVIEW_CURRENT_AUTHORIZATION_UNPROVEN"
 out.Escalation="NONE"
 return out,nil
}
